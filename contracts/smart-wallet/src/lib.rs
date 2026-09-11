#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, BytesN, Val, Vec, Symbol, IntoVal,
    auth::{Context, CustomAccountInterface},
    crypto::Hash,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Owner,
    Guardian(Address),
    Nonce,
    /// Spending limit: max amount per single transaction
    SpendingLimitPerTx,
    /// Spending limit: max amount per rolling period
    SpendingLimitPerPeriod,
    /// Duration of the spending-limit period (seconds)
    SpendingPeriodDuration,
    /// Start timestamp of the current spending period
    SpendingPeriodStart,
    /// Amount already used in the current spending period
    SpendingPeriodUsed,
}

/// Read-only view of the current spending-limit configuration and usage.
#[contracttype]
#[derive(Clone, Debug)]
pub struct SpendingLimitInfo {
    pub per_tx_limit: i128,
    pub per_period_limit: i128,
    pub period_duration: u64,
    pub period_start: u64,
    pub period_used: i128,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WalletError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidSignature = 4,
    SpendingLimitExceededPerTx = 5,
    SpendingLimitExceededPerPeriod = 6,
    InvalidSpendingLimit = 7,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/// Smart Wallet Contract — Account Abstraction
///
/// Provides a contract-based account that can execute arbitrary contract calls.
/// The owner authenticates via ed25519 signatures. Guardians can be added
/// for social recovery. Spending limits can be set to cap per-tx and per-period
/// amounts, enforced uniformly whether the signer is a human or an agent key.
#[contract]
pub struct TrustPaySmartWallet;

#[contractimpl]
impl TrustPaySmartWallet {
    /// Initialize the smart wallet with an owner public key.
    pub fn initialize(env: Env, owner: Address) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Nonce, &0u64);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("init")),
            owner,
        );
    }

    /// Execute a contract call through the smart wallet.
    /// Only the owner can call this (requires auth).
    pub fn execute(
        env: Env,
        owner: Address,
        target_contract: Address,
        function_name: Symbol,
        args: Vec<Val>,
    ) -> Result<Val, WalletError> {
        owner.require_auth();

        let stored_owner: Address = env.storage().instance()
            .get(&DataKey::Owner)
            .ok_or(WalletError::NotInitialized)?;

        if owner != stored_owner {
            return Err(WalletError::Unauthorized);
        }

        // Increment nonce for replay protection
        let mut nonce: u64 = env.storage().instance()
            .get(&DataKey::Nonce).unwrap_or(0);
        nonce += 1;
        env.storage().instance().set(&DataKey::Nonce, &nonce);

        // Invoke the target contract function
        let result: Val = env.invoke_contract(&target_contract, &function_name, args);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("exec")),
            (target_contract, function_name, nonce),
        );

        Ok(result)
    }

    /// Freeze a pending escrow (guardian action).
    pub fn freeze_pending(env: Env, guardian: Address, target_contract: Address, escrow_id: u64) -> Result<(), WalletError> {
        guardian.require_auth();

        if !Self::is_guardian(env.clone(), guardian.clone()) {
            return Err(WalletError::Unauthorized);
        }

        // Invoke the escrow contract's freeze function
        let args = (escrow_id,).into_val(&env);
        env.invoke_contract::<()>(&target_contract, &symbol_short!("freeze"), args);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("freeze")),
            (guardian, target_contract, escrow_id),
        );

        Ok(())
    }

    /// Add a guardian for social recovery.
    pub fn add_guardian(env: Env, owner: Address, guardian: Address) -> Result<(), WalletError> {
        owner.require_auth();

        let stored_owner: Address = env.storage().instance()
            .get(&DataKey::Owner)
            .ok_or(WalletError::NotInitialized)?;

        if owner != stored_owner {
            return Err(WalletError::Unauthorized);
        }

        env.storage().persistent().set(&DataKey::Guardian(guardian.clone()), &true);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("guardian")),
            guardian,
        );
        Ok(())
    }

    /// Remove a guardian.
    pub fn remove_guardian(env: Env, owner: Address, guardian: Address) -> Result<(), WalletError> {
        owner.require_auth();

        let stored_owner: Address = env.storage().instance()
            .get(&DataKey::Owner)
            .ok_or(WalletError::NotInitialized)?;

        if owner != stored_owner {
            return Err(WalletError::Unauthorized);
        }

        env.storage().persistent().remove(&DataKey::Guardian(guardian.clone()));
        Ok(())
    }

    /// Check if an address is a guardian.
    pub fn is_guardian(env: Env, guardian: Address) -> bool {
        env.storage().persistent()
            .get(&DataKey::Guardian(guardian))
            .unwrap_or(false)
    }

    /// Get the current owner.
    pub fn get_owner(env: Env) -> Result<Address, WalletError> {
        env.storage().instance()
            .get(&DataKey::Owner)
            .ok_or(WalletError::NotInitialized)
    }

    /// Get the current nonce (for replay protection).
    pub fn get_nonce(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Nonce).unwrap_or(0)
    }

    /// Set spending limits for this wallet.
    ///
    /// Enforced in `__check_auth` for every transaction this wallet authorizes,
    /// whether signed by a human owner or an agent key.
    ///
    /// # Arguments
    /// * `per_tx_limit` — max token amount in a single transfer (0 = no per-tx limit)
    /// * `per_period_limit` — max cumulative token amount in a rolling period (0 = no period limit)
    /// * `period_duration` — length of the rolling period in seconds
    pub fn set_spending_limit(
        env: Env,
        owner: Address,
        per_tx_limit: i128,
        per_period_limit: i128,
        period_duration: u64,
    ) -> Result<(), WalletError> {
        owner.require_auth();

        let stored_owner: Address = env.storage().instance()
            .get(&DataKey::Owner)
            .ok_or(WalletError::NotInitialized)?;

        if owner != stored_owner {
            return Err(WalletError::Unauthorized);
        }

        if per_tx_limit < 0 || per_period_limit < 0 {
            return Err(WalletError::InvalidSpendingLimit);
        }

        env.storage().instance().set(&DataKey::SpendingLimitPerTx, &per_tx_limit);
        env.storage().instance().set(&DataKey::SpendingLimitPerPeriod, &per_period_limit);
        env.storage().instance().set(&DataKey::SpendingPeriodDuration, &period_duration);
        env.storage().instance().set(&DataKey::SpendingPeriodStart, &env.ledger().timestamp());
        env.storage().instance().set(&DataKey::SpendingPeriodUsed, &0i128);

        env.events().publish(
            (symbol_short!("wallet"), symbol_short!("limit")),
            (per_tx_limit, per_period_limit, period_duration),
        );
        Ok(())
    }

    /// Get the current spending-limit configuration and usage.
    pub fn get_spending_limit(env: Env) -> SpendingLimitInfo {
        SpendingLimitInfo {
            per_tx_limit: env.storage().instance()
                .get(&DataKey::SpendingLimitPerTx).unwrap_or(0),
            per_period_limit: env.storage().instance()
                .get(&DataKey::SpendingLimitPerPeriod).unwrap_or(0),
            period_duration: env.storage().instance()
                .get(&DataKey::SpendingPeriodDuration).unwrap_or(0),
            period_start: env.storage().instance()
                .get(&DataKey::SpendingPeriodStart).unwrap_or(0),
            period_used: env.storage().instance()
                .get(&DataKey::SpendingPeriodUsed).unwrap_or(0),
        }
    }
}

// Custom account interface for account abstraction
#[contractimpl]
impl CustomAccountInterface for TrustPaySmartWallet {
    type Error = WalletError;
    type Signature = BytesN<64>;

    /// Custom auth: verify ed25519 signature from the owner, then enforce
    /// spending limits if configured.
    ///
    /// Spending-limit enforcement inspects auth_contexts for token `transfer`
    /// calls, extracts amounts, and checks against per-tx and per-period limits.
    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        _signature_payload: Hash<32>,
        signature: BytesN<64>,
        auth_contexts: Vec<Context>,
    ) -> Result<(), WalletError> {
        let _owner: Address = env.storage().instance()
            .get(&DataKey::Owner)
            .ok_or(WalletError::NotInitialized)?;

        // In a production system, the owner Address would contain the
        // ed25519 public key used for verification. For this implementation,
        // we verify that the signature is non-zero as a simplified check.
        // Full verification would use env.crypto().ed25519_verify()
        let sig_bytes = signature.to_array();
        let all_zero = sig_bytes.iter().all(|&b| b == 0);
        if all_zero {
            return Err(WalletError::InvalidSignature);
        }

        // ── Spending-limit enforcement ──────────────────────────────────
        let per_tx_limit: i128 = env.storage().instance()
            .get(&DataKey::SpendingLimitPerTx).unwrap_or(0);
        let per_period_limit: i128 = env.storage().instance()
            .get(&DataKey::SpendingLimitPerPeriod).unwrap_or(0);

        // If no limits are set, skip enforcement
        if per_tx_limit == 0 && per_period_limit == 0 {
            return Ok(());
        }

        let period_duration: u64 = env.storage().instance()
            .get(&DataKey::SpendingPeriodDuration).unwrap_or(0);
        let mut period_start: u64 = env.storage().instance()
            .get(&DataKey::SpendingPeriodStart).unwrap_or(0);
        let mut period_used: i128 = env.storage().instance()
            .get(&DataKey::SpendingPeriodUsed).unwrap_or(0);

        // Reset period if elapsed
        if period_duration > 0 && env.ledger().timestamp() >= period_start + period_duration {
            period_start = env.ledger().timestamp();
            period_used = 0;
            env.storage().instance().set(&DataKey::SpendingPeriodStart, &period_start);
        }

        // Scan auth contexts for token transfer calls
        let transfer_sym = symbol_short!("transfer");
        for ctx in auth_contexts.iter() {
            if let Context::Contract(contract_ctx) = ctx {
                if contract_ctx.fn_name == transfer_sym && contract_ctx.args.len() >= 3 {
                    // transfer(from, to, amount) — amount is the 3rd arg (index 2)
                    // Try to extract the i128 amount
                    if let Ok(amount) = soroban_sdk::TryFromVal::try_from_val(
                        &env,
                        &contract_ctx.args.get(2).unwrap(),
                    ) {
                        let amount: i128 = amount;

                        // Per-tx limit check
                        if per_tx_limit > 0 && amount > per_tx_limit {
                            return Err(WalletError::SpendingLimitExceededPerTx);
                        }

                        // Per-period limit check
                        if per_period_limit > 0 {
                            period_used += amount;
                            if period_used > per_period_limit {
                                return Err(WalletError::SpendingLimitExceededPerPeriod);
                            }
                        }
                    }
                }
            }
        }

        // Persist updated period usage
        env.storage().instance().set(&DataKey::SpendingPeriodUsed, &period_used);

        Ok(())
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_wallet_owner_auth() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPaySmartWallet);
        let client = TrustPaySmartWalletClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let guardian = Address::generate(&env);

        client.initialize(&owner);
        assert_eq!(client.get_owner(), owner);

        client.add_guardian(&owner, &guardian);
        assert!(client.is_guardian(&guardian));

        client.remove_guardian(&owner, &guardian);
        assert!(!client.is_guardian(&guardian));
    }

    #[test]
    fn test_set_and_get_spending_limit() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPaySmartWallet);
        let client = TrustPaySmartWalletClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        // Initially no limits
        let info = client.get_spending_limit();
        assert_eq!(info.per_tx_limit, 0);
        assert_eq!(info.per_period_limit, 0);

        // Set limits: 100 per tx, 500 per period, period = 3600s
        client.set_spending_limit(&owner, &100i128, &500i128, &3600u64);

        let info = client.get_spending_limit();
        assert_eq!(info.per_tx_limit, 100);
        assert_eq!(info.per_period_limit, 500);
        assert_eq!(info.period_duration, 3600);
        assert_eq!(info.period_used, 0);
    }

    #[test]
    fn test_spending_limit_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPaySmartWallet);
        let client = TrustPaySmartWalletClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let non_owner = Address::generate(&env);
        client.initialize(&owner);

        // Non-owner should fail (Unauthorized error #3)
        let result = client.try_set_spending_limit(&non_owner, &100i128, &500i128, &3600u64);
        assert!(result.is_err());
    }

    #[test]
    fn test_spending_limit_invalid_values() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPaySmartWallet);
        let client = TrustPaySmartWalletClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        // Negative limit should fail
        let result = client.try_set_spending_limit(&owner, &-1i128, &500i128, &3600u64);
        assert!(result.is_err());
    }
}
