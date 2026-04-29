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

    // Create escrow: lock tokens and store agreement
    pub fn create_escrow(
        env: Env,
        sender: Address,
        beneficiary: Address,
        token: Address,
        amount: i128,
        approval_contract: Address,
        threshold: u32,
    ) -> Result<u64, EscrowError> {
        sender.require_auth();
        if amount <= 0 { return Err(EscrowError::InvalidAmount); }

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
        );

        client.cancel_escrow(&sender, &id);
        assert_eq!(token.balance(&sender), 1_000_000_000);
        assert_eq!(client.get_escrow(&id).status, EscrowStatus::Cancelled);
    }
}
