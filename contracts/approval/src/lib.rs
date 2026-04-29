#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Vec,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Configuration for a specific escrow's approval requirements
    Config(u64),
    /// List of addresses that have approved a specific escrow
    Approvals(u64),
}

/// Stores the approval configuration for one escrow.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ApprovalConfig {
    pub escrow_id: u64,
    /// Addresses allowed to approve
    pub approvers: Vec<Address>,
    /// Number of approvals required
    pub threshold: u32,
    /// Who initialized this approval (usually the escrow contract)
    pub initializer: Address,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ApprovalError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorizedApprover = 3,
    AlreadyApproved = 4,
    InvalidThreshold = 5,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct TrustPayApproval;

#[contractimpl]
impl TrustPayApproval {
    /// Initialize approval tracking for a specific escrow.
    ///
    /// # Arguments
    /// * `initializer` - Address setting up the approval (must authorize)
    /// * `escrow_id` - The escrow this approval config belongs to
    /// * `approvers` - List of addresses allowed to approve
    /// * `threshold` - Minimum approvals required (e.g. 2 of 3)
    pub fn initialize(
        env: Env,
        initializer: Address,
        escrow_id: u64,
        approvers: Vec<Address>,
        threshold: u32,
    ) -> Result<(), ApprovalError> {
        initializer.require_auth();

        // Don't allow re-initialization for the same escrow
        if env.storage().persistent().has(&DataKey::Config(escrow_id)) {
            return Err(ApprovalError::AlreadyInitialized);
        }

        // Threshold must be valid
        if threshold == 0 || threshold > approvers.len() {
            return Err(ApprovalError::InvalidThreshold);
        }

        let config = ApprovalConfig {
            escrow_id,
            approvers,
            threshold,
            initializer: initializer.clone(),
        };

        env.storage().persistent().set(&DataKey::Config(escrow_id), &config);
        // Initialize empty approvals list
        let empty: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Approvals(escrow_id), &empty);

        env.events().publish(
            (symbol_short!("approval"), symbol_short!("init")),
            (escrow_id, threshold),
        );
        Ok(())
    }

    /// Submit an approval for a specific escrow.
    /// Caller must be in the approved approvers list.
    ///
    /// # Arguments
    /// * `approver` - The address approving (must authorize)
    /// * `escrow_id` - Which escrow to approve
    pub fn approve(
        env: Env,
        approver: Address,
        escrow_id: u64,
    ) -> Result<u32, ApprovalError> {
        approver.require_auth();

        let config: ApprovalConfig = env.storage().persistent()
            .get(&DataKey::Config(escrow_id))
            .ok_or(ApprovalError::NotInitialized)?;

        // Check the approver is in the allowed list
        let mut found = false;
        for addr in config.approvers.iter() {
            if addr == approver {
                found = true;
                break;
            }
        }
        if !found {
            return Err(ApprovalError::NotAuthorizedApprover);
        }

        // Check they haven't already approved
        let mut approvals: Vec<Address> = env.storage().persistent()
            .get(&DataKey::Approvals(escrow_id))
            .unwrap_or(Vec::new(&env));

        for addr in approvals.iter() {
            if addr == approver {
                return Err(ApprovalError::AlreadyApproved);
            }
        }

        // Record the approval
        approvals.push_back(approver.clone());
        let count = approvals.len();
        env.storage().persistent().set(&DataKey::Approvals(escrow_id), &approvals);

        env.events().publish(
            (symbol_short!("approval"), symbol_short!("given")),
            (escrow_id, approver, count),
        );

        Ok(count)
    }

    /// Check if the approval threshold has been met for a given escrow.
    /// This is called by the Escrow contract via inter-contract call.
    pub fn is_approved(env: Env, escrow_id: u64) -> bool {
        let config: Option<ApprovalConfig> = env.storage().persistent()
            .get(&DataKey::Config(escrow_id));

        match config {
            None => false,
            Some(cfg) => {
                let approvals: Vec<Address> = env.storage().persistent()
                    .get(&DataKey::Approvals(escrow_id))
                    .unwrap_or(Vec::new(&env));
                approvals.len() >= cfg.threshold
            }
        }
    }

    /// Get the current approval count for an escrow.
    pub fn get_approval_count(env: Env, escrow_id: u64) -> u32 {
        let approvals: Vec<Address> = env.storage().persistent()
            .get(&DataKey::Approvals(escrow_id))
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    /// Get the config for a specific escrow's approval requirements.
    pub fn get_config(env: Env, escrow_id: u64) -> Result<ApprovalConfig, ApprovalError> {
        env.storage().persistent()
            .get(&DataKey::Config(escrow_id))
            .ok_or(ApprovalError::NotInitialized)
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_approval_threshold() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayApproval);
        let client = TrustPayApprovalClient::new(&env, &contract_id);

        let initializer = Address::generate(&env);
        let approver1 = Address::generate(&env);
        let approver2 = Address::generate(&env);
        let approver3 = Address::generate(&env);

        let approvers = Vec::from_array(
            &env,
            [approver1.clone(), approver2.clone(), approver3.clone()],
        );

        // Initialize 2-of-3 approval for escrow #1
        client.initialize(&initializer, &1u64, &approvers, &2u32);

        // Not yet approved
        assert!(!client.is_approved(&1u64));

        // First approval
        client.approve(&approver1, &1u64);
        assert_eq!(client.get_approval_count(&1u64), 1);
        assert!(!client.is_approved(&1u64));

        // Second approval - threshold met
        client.approve(&approver2, &1u64);
        assert_eq!(client.get_approval_count(&1u64), 2);
        assert!(client.is_approved(&1u64));
    }
}
