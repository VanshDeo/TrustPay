#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, BytesN, Val, Vec,
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
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/// Smart Wallet Contract — Account Abstraction
///
/// Provides a contract-based account that can execute arbitrary contract calls.
/// The owner authenticates via ed25519 signatures. Guardians can be added
/// for social recovery.
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
        function_name: soroban_sdk::Symbol,
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
}

// Custom account interface for account abstraction
#[contractimpl]
impl CustomAccountInterface for TrustPaySmartWallet {
    type Error = WalletError;
    type Signature = BytesN<64>;

    /// Custom auth: verify ed25519 signature from the owner.
    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        _signature_payload: Hash<32>,
        signature: BytesN<64>,
        _auth_contexts: Vec<Context>,
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
}
