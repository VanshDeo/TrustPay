#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    token, symbol_short,
    Address, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Escrow(u64),
    EscrowCounter,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EscrowStatus {
    Pending,
    Released,
    Cancelled,
    TimedOut,
}

/// What happens when an escrow's deadline passes without resolution.
/// Extensible — Phase 3 will add `EscalateArbitrator`.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TimeoutFallback {
    RefundSender,
    ReleaseBeneficiary,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowData {
    pub escrow_id: u64,
    pub sender: Address,
    pub beneficiary: Address,
    pub token: Address,
    pub amount: i128,
    pub approval_contract: Address,
    pub threshold: u32,
    pub status: EscrowStatus,
    pub created_at: u64,
    /// Ledger timestamp after which check_timeout() can be called.
    /// 0 means no deadline (timeout rule is disabled).
    pub deadline: u64,
    /// Action taken when deadline is reached. Only meaningful if deadline > 0.
    pub fallback: TimeoutFallback,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    EscrowNotFound = 1,
    InvalidStatus = 2,
    Unauthorized = 3,
    ApprovalNotMet = 4,
    InvalidAmount = 5,
    DeadlineNotReached = 6,
    InvalidDeadline = 7,
    NoDeadlineSet = 8,
}

// Inter-contract call interface for the Approval contract
mod approval_client {
    use soroban_sdk::{contractclient, Env};
    #[allow(dead_code)]
    #[contractclient(name = "ApprovalClient")]
    pub trait ApprovalContract {
        fn is_approved(env: Env, escrow_id: u64) -> bool;
    }
}

#[contract]
pub struct TrustPayEscrow;

#[contractimpl]
impl TrustPayEscrow {
    // Initialize with admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EscrowCounter, &0u64);
    }

    /// Create escrow: lock tokens and store agreement.
    ///
    /// # Arguments
    /// * `deadline` — ledger timestamp after which timeout activates. Pass 0 for no deadline.
    /// * `fallback` — what happens on timeout (RefundSender or ReleaseBeneficiary).
    pub fn create_escrow(
        env: Env,
        sender: Address,
        beneficiary: Address,
        token: Address,
        amount: i128,
        approval_contract: Address,
        threshold: u32,
        deadline: u64,
        fallback: TimeoutFallback,
    ) -> Result<u64, EscrowError> {
        sender.require_auth();
        if amount <= 0 { return Err(EscrowError::InvalidAmount); }

        // If a deadline is set, it must be in the future
        if deadline != 0 && deadline <= env.ledger().timestamp() {
            return Err(EscrowError::InvalidDeadline);
        }

        let mut counter: u64 = env.storage().instance()
            .get(&DataKey::EscrowCounter).unwrap_or(0);
        counter += 1;

        // Transfer tokens from sender to this contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let escrow = EscrowData {
            escrow_id: counter,
            sender: sender.clone(),
            beneficiary: beneficiary.clone(),
            token: token.clone(),
            amount,
            approval_contract,
            threshold,
            status: EscrowStatus::Pending,
            created_at: env.ledger().timestamp(),
            deadline,
            fallback,
        };

        env.storage().persistent().set(&DataKey::Escrow(counter), &escrow);
        env.storage().instance().set(&DataKey::EscrowCounter, &counter);

        // Emit event for off-chain indexing
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("created")),
            (counter, sender, beneficiary, amount),
        );
        Ok(counter)
    }

    // Release escrow: cross-contract call to Approval, then transfer funds
    pub fn release_escrow(env: Env, escrow_id: u64) -> Result<(), EscrowError> {
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Pending {
            return Err(EscrowError::InvalidStatus);
        }

        // Inter-contract call to check approval threshold
        let client = approval_client::ApprovalClient::new(&env, &escrow.approval_contract);
        if !client.is_approved(&escrow_id) {
            return Err(EscrowError::ApprovalNotMet);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &env.current_contract_address(), &escrow.beneficiary, &escrow.amount,
        );

        escrow.status = EscrowStatus::Released;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("released")),
            (escrow_id, escrow.beneficiary.clone(), escrow.amount),
        );
        Ok(())
    }

    // Cancel escrow: sender-only, returns funds
    pub fn cancel_escrow(env: Env, sender: Address, escrow_id: u64) -> Result<(), EscrowError> {
        sender.require_auth();
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.sender != sender { return Err(EscrowError::Unauthorized); }
        if escrow.status != EscrowStatus::Pending { return Err(EscrowError::InvalidStatus); }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &env.current_contract_address(), &escrow.sender, &escrow.amount,
        );

        escrow.status = EscrowStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("cancel")),
            (escrow_id, sender),
        );
        Ok(())
    }

    /// Check and execute timeout for an escrow whose deadline has passed.
    ///
    /// Keeper pattern: anyone can call this — no require_auth.
    /// The caller pays gas; no special permissions needed.
    pub fn check_timeout(env: Env, escrow_id: u64) -> Result<(), EscrowError> {
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Pending {
            return Err(EscrowError::InvalidStatus);
        }

        // No deadline = no timeout rule
        if escrow.deadline == 0 {
            return Err(EscrowError::NoDeadlineSet);
        }

        // Deadline must have passed
        if env.ledger().timestamp() < escrow.deadline {
            return Err(EscrowError::DeadlineNotReached);
        }

        // Apply the fallback action
        let token_client = token::Client::new(&env, &escrow.token);
        match escrow.fallback {
            TimeoutFallback::RefundSender => {
                token_client.transfer(
                    &env.current_contract_address(), &escrow.sender, &escrow.amount,
                );
            }
            TimeoutFallback::ReleaseBeneficiary => {
                token_client.transfer(
                    &env.current_contract_address(), &escrow.beneficiary, &escrow.amount,
                );
            }
        }

        escrow.status = EscrowStatus::TimedOut;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("timeout")),
            (escrow_id, escrow.amount),
        );
        Ok(())
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<EscrowData, EscrowError> {
        env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)
    }

    pub fn get_escrow_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::EscrowCounter).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token::{StellarAssetClient, TokenClient}, Env};
    use soroban_sdk::testutils::Ledger;

    mod approval_mock {
        use soroban_sdk::{contract, contractimpl, Env};
        #[contract]
        pub struct ApprovalMock;
        #[contractimpl]
        impl ApprovalMock {
            pub fn is_approved(_env: Env, _escrow_id: u64) -> bool { true }
        }
    }

    #[test]
    fn test_create_and_release() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayEscrow);
        let client = TrustPayEscrowClient::new(&env, &contract_id);
        let approval_id = env.register_contract(None, approval_mock::ApprovalMock);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        let token = TokenClient::new(&env, &sac.address());
        token_admin.mint(&sender, &1_000_000_000);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &500_000_000i128, &approval_id, &2u32,
            &0u64, // no deadline
            &TimeoutFallback::RefundSender,
        );
        assert_eq!(id, 1);
        assert_eq!(token.balance(&contract_id), 500_000_000);

        client.release_escrow(&id);
        assert_eq!(token.balance(&beneficiary), 500_000_000);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::Released);
    }

    #[test]
    fn test_cancel() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayEscrow);
        let client = TrustPayEscrowClient::new(&env, &contract_id);
        let approval_id = env.register_contract(None, approval_mock::ApprovalMock);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        let token = TokenClient::new(&env, &sac.address());
        token_admin.mint(&sender, &1_000_000_000);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &300_000_000i128, &approval_id, &2u32,
            &0u64,
            &TimeoutFallback::RefundSender,
        );

        client.cancel_escrow(&sender, &id);
        assert_eq!(token.balance(&sender), 1_000_000_000);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::Cancelled);
    }

    #[test]
    fn test_check_timeout_refund() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayEscrow);
        let client = TrustPayEscrowClient::new(&env, &contract_id);
        let approval_id = env.register_contract(None, approval_mock::ApprovalMock);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        let token = TokenClient::new(&env, &sac.address());
        token_admin.mint(&sender, &1_000_000_000);

        // Set ledger timestamp to 50
        env.ledger().with_mut(|li| { li.timestamp = 50; });

        client.initialize(&admin);

        // Create escrow with deadline at 100, fallback = RefundSender
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &500_000_000i128, &approval_id, &2u32,
            &100u64,
            &TimeoutFallback::RefundSender,
        );

        assert_eq!(token.balance(&contract_id), 500_000_000);

        // Advance ledger past deadline
        env.ledger().with_mut(|li| { li.timestamp = 101; });

        // Anyone can call check_timeout (keeper pattern)
        client.check_timeout(&id);

        // Funds refunded to sender
        assert_eq!(token.balance(&sender), 1_000_000_000);
        assert_eq!(token.balance(&contract_id), 0);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::TimedOut);
    }

    #[test]
    fn test_check_timeout_release() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayEscrow);
        let client = TrustPayEscrowClient::new(&env, &contract_id);
        let approval_id = env.register_contract(None, approval_mock::ApprovalMock);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        let token = TokenClient::new(&env, &sac.address());
        token_admin.mint(&sender, &1_000_000_000);

        env.ledger().with_mut(|li| { li.timestamp = 50; });

        client.initialize(&admin);

        // Create escrow with deadline at 200, fallback = ReleaseBeneficiary
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &400_000_000i128, &approval_id, &2u32,
            &200u64,
            &TimeoutFallback::ReleaseBeneficiary,
        );

        // Advance past deadline
        env.ledger().with_mut(|li| { li.timestamp = 201; });

        client.check_timeout(&id);

        // Funds released to beneficiary
        assert_eq!(token.balance(&beneficiary), 400_000_000);
        assert_eq!(token.balance(&contract_id), 0);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::TimedOut);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn test_check_timeout_not_reached() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayEscrow);
        let client = TrustPayEscrowClient::new(&env, &contract_id);
        let approval_id = env.register_contract(None, approval_mock::ApprovalMock);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        token_admin.mint(&sender, &1_000_000_000);

        env.ledger().with_mut(|li| { li.timestamp = 50; });

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &500_000_000i128, &approval_id, &2u32,
            &1000u64, // deadline far in the future
            &TimeoutFallback::RefundSender,
        );

        // Try to timeout before deadline — should fail with DeadlineNotReached (#6)
        client.check_timeout(&id);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #8)")]
    fn test_check_timeout_no_deadline() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayEscrow);
        let client = TrustPayEscrowClient::new(&env, &contract_id);
        let approval_id = env.register_contract(None, approval_mock::ApprovalMock);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let beneficiary = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &sac.address());
        token_admin.mint(&sender, &1_000_000_000);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &500_000_000i128, &approval_id, &2u32,
            &0u64, // no deadline
            &TimeoutFallback::RefundSender,
        );

        // Try to timeout with no deadline set — should fail with NoDeadlineSet (#8)
        client.check_timeout(&id);
    }
}
