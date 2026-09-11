#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    token, symbol_short,
    Address, Env, Vec, BytesN, Bytes,
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
    Released, // Set when all milestones are released
    Cancelled,
    TimedOut,
    Frozen,
}

/// What happens when an escrow's deadline passes without resolution.
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
    pub milestone_amounts: Vec<i128>,
    pub released_milestones: Vec<u32>, // Indices of released milestones
    pub approval_contract: Address,
    pub threshold: u32,
    pub status: EscrowStatus,
    pub created_at: u64,
    /// Ledger timestamp after which check_timeout() can be called.
    /// 0 means no deadline (timeout rule is disabled).
    pub deadline: u64,
    /// Action taken when deadline is reached. Only meaningful if deadline > 0.
    pub fallback: TimeoutFallback,
    /// Optional evidence hash for disputes (empty bytes = none)
    pub evidence_hash: Bytes,
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
    InvalidMilestone = 9,
    MilestoneAlreadyReleased = 10,
}

// Inter-contract call interface for the Approval contract
mod approval_client {
    use soroban_sdk::{contractclient, Env};
    #[allow(dead_code)]
    #[contractclient(name = "ApprovalClient")]
    pub trait ApprovalContract {
        fn is_approved(env: Env, escrow_id: u64, milestone_id: u32) -> bool;
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
    pub fn create_escrow(
        env: Env,
        sender: Address,
        beneficiary: Address,
        token: Address,
        milestone_amounts: Vec<i128>,
        approval_contract: Address,
        threshold: u32,
        deadline: u64,
        fallback: TimeoutFallback,
    ) -> Result<u64, EscrowError> {
        sender.require_auth();
        
        let mut total_amount: i128 = 0;
        for amount in milestone_amounts.iter() {
            if amount <= 0 { return Err(EscrowError::InvalidAmount); }
            total_amount += amount;
        }
        if total_amount == 0 { return Err(EscrowError::InvalidAmount); }

        // If a deadline is set, it must be in the future
        if deadline != 0 && deadline <= env.ledger().timestamp() {
            return Err(EscrowError::InvalidDeadline);
        }

        let mut counter: u64 = env.storage().instance()
            .get(&DataKey::EscrowCounter).unwrap_or(0);
        counter += 1;

        // Transfer tokens from sender to this contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &total_amount);

        let released_milestones: Vec<u32> = Vec::new(&env);

        let escrow = EscrowData {
            escrow_id: counter,
            sender: sender.clone(),
            beneficiary: beneficiary.clone(),
            token: token.clone(),
            milestone_amounts,
            released_milestones,
            approval_contract,
            threshold,
            status: EscrowStatus::Pending,
            created_at: env.ledger().timestamp(),
            deadline,
            fallback,
            evidence_hash: Bytes::new(&env),
        };

        env.storage().persistent().set(&DataKey::Escrow(counter), &escrow);
        env.storage().instance().set(&DataKey::EscrowCounter, &counter);

        // Emit event for off-chain indexing
        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("created")),
            (counter, sender, beneficiary, total_amount),
        );
        Ok(counter)
    }

    // Release a specific milestone of the escrow
    pub fn release_escrow(env: Env, escrow_id: u64, milestone_id: u32) -> Result<(), EscrowError> {
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Pending {
            return Err(EscrowError::InvalidStatus);
        }
        
        if milestone_id >= escrow.milestone_amounts.len() {
            return Err(EscrowError::InvalidMilestone);
        }
        
        if escrow.released_milestones.contains(&milestone_id) {
            return Err(EscrowError::MilestoneAlreadyReleased);
        }

        // Inter-contract call to check approval threshold
        let client = approval_client::ApprovalClient::new(&env, &escrow.approval_contract);
        if !client.is_approved(&escrow_id, &milestone_id) {
            return Err(EscrowError::ApprovalNotMet);
        }
        
        let amount_to_release = escrow.milestone_amounts.get(milestone_id).unwrap();

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &env.current_contract_address(), &escrow.beneficiary, &amount_to_release,
        );
        
        escrow.released_milestones.push_back(milestone_id);
        
        if escrow.released_milestones.len() == escrow.milestone_amounts.len() {
            escrow.status = EscrowStatus::Released;
        }
        
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("released")),
            (escrow_id, milestone_id, escrow.beneficiary.clone(), amount_to_release),
        );
        Ok(())
    }
    
    // Freeze an escrow (used by guardians)
    pub fn freeze(env: Env, caller: Address, escrow_id: u64) -> Result<(), EscrowError> {
        caller.require_auth();
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        // Only parties to the escrow can freeze it
        if caller != escrow.sender && caller != escrow.beneficiary {
            return Err(EscrowError::Unauthorized);
        }

        if escrow.status != EscrowStatus::Pending { 
            return Err(EscrowError::InvalidStatus); 
        }

        escrow.status = EscrowStatus::Frozen;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("frozen")),
            (escrow_id, caller),
        );
        Ok(())
    }

    // Submit evidence hash for a dispute
    pub fn submit_evidence(env: Env, caller: Address, escrow_id: u64, evidence_hash: Bytes) -> Result<(), EscrowError> {
        caller.require_auth();
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if caller != escrow.sender && caller != escrow.beneficiary {
            return Err(EscrowError::Unauthorized);
        }

        escrow.evidence_hash = evidence_hash.clone();
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("evidence")),
            (escrow_id, caller, evidence_hash),
        );
        Ok(())
    }

    // Cancel escrow: sender-only, returns remaining funds
    pub fn cancel_escrow(env: Env, sender: Address, escrow_id: u64) -> Result<(), EscrowError> {
        sender.require_auth();
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.sender != sender { return Err(EscrowError::Unauthorized); }
        // Can only cancel pending or frozen escrows
        if escrow.status != EscrowStatus::Pending && escrow.status != EscrowStatus::Frozen { 
            return Err(EscrowError::InvalidStatus); 
        }

        let mut remaining_amount: i128 = 0;
        for i in 0..escrow.milestone_amounts.len() {
            if !escrow.released_milestones.contains(&i) {
                remaining_amount += escrow.milestone_amounts.get(i).unwrap();
            }
        }
        
        if remaining_amount > 0 {
            let token_client = token::Client::new(&env, &escrow.token);
            token_client.transfer(
                &env.current_contract_address(), &escrow.sender, &remaining_amount,
            );
        }

        escrow.status = EscrowStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("cancel")),
            (escrow_id, sender),
        );
        Ok(())
    }

    /// Check and execute timeout for an escrow whose deadline has passed.
    pub fn check_timeout(env: Env, escrow_id: u64) -> Result<(), EscrowError> {
        let mut escrow: EscrowData = env.storage().persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Pending && escrow.status != EscrowStatus::Frozen {
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
        
        let mut remaining_amount: i128 = 0;
        for i in 0..escrow.milestone_amounts.len() {
            if !escrow.released_milestones.contains(&i) {
                remaining_amount += escrow.milestone_amounts.get(i).unwrap();
            }
        }

        // Apply the fallback action on remaining amounts
        if remaining_amount > 0 {
            let token_client = token::Client::new(&env, &escrow.token);
            match escrow.fallback {
                TimeoutFallback::RefundSender => {
                    token_client.transfer(
                        &env.current_contract_address(), &escrow.sender, &remaining_amount,
                    );
                }
                TimeoutFallback::ReleaseBeneficiary => {
                    token_client.transfer(
                        &env.current_contract_address(), &escrow.beneficiary, &remaining_amount,
                    );
                }
            }
        }

        escrow.status = EscrowStatus::TimedOut;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("timeout")),
            (escrow_id, remaining_amount),
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
            pub fn is_approved(_env: Env, _escrow_id: u64, _milestone_id: u32) -> bool { true }
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

        let milestone_amounts = Vec::from_array(&env, [200_000_000, 300_000_000]);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &0u64, // no deadline
            &TimeoutFallback::RefundSender,
        );
        assert_eq!(id, 1);
        assert_eq!(token.balance(&contract_id), 500_000_000);

        // Release milestone 0
        client.release_escrow(&id, &0u32);
        assert_eq!(token.balance(&beneficiary), 200_000_000);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::Pending);
        
        // Release milestone 1
        client.release_escrow(&id, &1u32);
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

        let milestone_amounts = Vec::from_array(&env, [300_000_000]);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &0u64,
            &TimeoutFallback::RefundSender,
        );

        client.cancel_escrow(&sender, &id);
        assert_eq!(token.balance(&sender), 1_000_000_000);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::Cancelled);
    }
    
    #[test]
    fn test_freeze_and_evidence() {
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

        let milestone_amounts = Vec::from_array(&env, [300_000_000]);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &0u64,
            &TimeoutFallback::RefundSender,
        );

        // Sender freezes
        client.freeze(&sender, &id);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::Frozen);
        
        // Beneficiary submits evidence
        let hash = soroban_sdk::Bytes::from_array(&env, &[1; 32]);
        client.submit_evidence(&beneficiary, &id, &hash);
        assert_eq!(client.get_escrow(&id).evidence_hash, hash);
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

        let milestone_amounts = Vec::from_array(&env, [500_000_000]);

        client.initialize(&admin);

        // Create escrow with deadline at 100, fallback = RefundSender
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &100u64,
            &TimeoutFallback::RefundSender,
        );

        assert_eq!(token.balance(&contract_id), 500_000_000);

        // Advance ledger past deadline
        env.ledger().with_mut(|li| { li.timestamp = 101; });

        client.check_timeout(&id);

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

        let milestone_amounts = Vec::from_array(&env, [400_000_000]);

        client.initialize(&admin);

        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &200u64,
            &TimeoutFallback::ReleaseBeneficiary,
        );

        env.ledger().with_mut(|li| { li.timestamp = 201; });
        client.check_timeout(&id);

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
        let milestone_amounts = Vec::from_array(&env, [500_000_000]);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &1000u64,
            &TimeoutFallback::RefundSender,
        );

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

        let milestone_amounts = Vec::from_array(&env, [500_000_000]);

        client.initialize(&admin);
        let id = client.create_escrow(
            &sender, &beneficiary, &sac.address(),
            &milestone_amounts, &approval_id, &2u32,
            &0u64,
            &TimeoutFallback::RefundSender,
        );

        client.check_timeout(&id);
    }
}
