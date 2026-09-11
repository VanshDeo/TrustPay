#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Vec,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Configuration for a specific escrow's milestone approval requirements
    Config(u64, u32), // escrow_id, milestone_id
    /// List of addresses that have approved a specific milestone
    Approvals(u64, u32), // escrow_id, milestone_id
}

/// Stores the approval configuration for one escrow milestone.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ApprovalConfig {
    pub escrow_id: u64,
    pub milestone_id: u32,
    /// Addresses allowed to approve
    pub approvers: Vec<Address>,
    /// Number of approvals required
    pub threshold: u32,
    /// Optional arbitrator who can force an approval in disputes
    pub arbitrator: Option<Address>,
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
    /// Initialize approval tracking for a specific escrow milestone.
    ///
    /// # Arguments
    /// * `initializer` - Address setting up the approval (must authorize)
    /// * `escrow_id` - The escrow this approval config belongs to
    /// * `milestone_id` - The specific milestone being configured
    /// * `approvers` - List of addresses allowed to approve
    /// * `threshold` - Minimum approvals required (e.g. 2 of 3)
    /// * `arbitrator` - Optional arbitrator address
    pub fn initialize(
        env: Env,
        initializer: Address,
        escrow_id: u64,
        milestone_id: u32,
        approvers: Vec<Address>,
        threshold: u32,
        arbitrator: Option<Address>,
    ) -> Result<(), ApprovalError> {
        initializer.require_auth();

        // Don't allow re-initialization for the same escrow milestone
        if env.storage().persistent().has(&DataKey::Config(escrow_id, milestone_id)) {
            return Err(ApprovalError::AlreadyInitialized);
        }

        // Threshold must be valid
        if threshold == 0 || threshold > approvers.len() {
            return Err(ApprovalError::InvalidThreshold);
        }

        let config = ApprovalConfig {
            escrow_id,
            milestone_id,
            approvers,
            threshold,
            arbitrator,
            initializer: initializer.clone(),
        };

        env.storage().persistent().set(&DataKey::Config(escrow_id, milestone_id), &config);
        // Initialize empty approvals list
        let empty: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Approvals(escrow_id, milestone_id), &empty);

        env.events().publish(
            (symbol_short!("approval"), symbol_short!("init")),
            (escrow_id, milestone_id, threshold),
        );
        Ok(())
    }

    /// Submit an approval for a specific escrow milestone.
    /// Caller must be in the approved approvers list or be the arbitrator.
    ///
    /// # Arguments
    /// * `approver` - The address approving (must authorize)
    /// * `escrow_id` - Which escrow to approve
    /// * `milestone_id` - Which milestone to approve
    pub fn approve(
        env: Env,
        approver: Address,
        escrow_id: u64,
        milestone_id: u32,
    ) -> Result<u32, ApprovalError> {
        approver.require_auth();

        let config: ApprovalConfig = env.storage().persistent()
            .get(&DataKey::Config(escrow_id, milestone_id))
            .ok_or(ApprovalError::NotInitialized)?;

        // Check if the approver is in the allowed list or is the arbitrator
        let mut is_valid_approver = false;
        if let Some(ref arb) = config.arbitrator {
            if arb == &approver {
                is_valid_approver = true;
            }
        }
        
        if !is_valid_approver {
            for addr in config.approvers.iter() {
                if addr == approver {
                    is_valid_approver = true;
                    break;
                }
            }
        }

        if !is_valid_approver {
            return Err(ApprovalError::NotAuthorizedApprover);
        }

        // Check they haven't already approved
        let mut approvals: Vec<Address> = env.storage().persistent()
            .get(&DataKey::Approvals(escrow_id, milestone_id))
            .unwrap_or(Vec::new(&env));

        for addr in approvals.iter() {
            if addr == approver {
                return Err(ApprovalError::AlreadyApproved);
            }
        }

        // Record the approval
        approvals.push_back(approver.clone());
        let count = approvals.len();
        env.storage().persistent().set(&DataKey::Approvals(escrow_id, milestone_id), &approvals);

        env.events().publish(
            (symbol_short!("approval"), symbol_short!("given")),
            (escrow_id, milestone_id, approver, count),
        );

        Ok(count)
    }

    /// Check if the approval threshold has been met for a given escrow milestone.
    /// If the arbitrator has approved, this returns true immediately.
    /// This is called by the Escrow contract via inter-contract call.
    pub fn is_approved(env: Env, escrow_id: u64, milestone_id: u32) -> bool {
        let config: Option<ApprovalConfig> = env.storage().persistent()
            .get(&DataKey::Config(escrow_id, milestone_id));

        match config {
            None => false,
            Some(cfg) => {
                let approvals: Vec<Address> = env.storage().persistent()
                    .get(&DataKey::Approvals(escrow_id, milestone_id))
                    .unwrap_or(Vec::new(&env));
                
                // Check for arbitrator approval which overrides the threshold
                if let Some(arb) = cfg.arbitrator {
                    for addr in approvals.iter() {
                        if addr == arb {
                            return true;
                        }
                    }
                }
                
                approvals.len() >= cfg.threshold
            }
        }
    }

    /// Get the current approval count for an escrow milestone.
    pub fn get_approval_count(env: Env, escrow_id: u64, milestone_id: u32) -> u32 {
        let approvals: Vec<Address> = env.storage().persistent()
            .get(&DataKey::Approvals(escrow_id, milestone_id))
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    /// Get the config for a specific escrow milestone's approval requirements.
    pub fn get_config(env: Env, escrow_id: u64, milestone_id: u32) -> Result<ApprovalConfig, ApprovalError> {
        env.storage().persistent()
            .get(&DataKey::Config(escrow_id, milestone_id))
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

        // Initialize 2-of-3 approval for escrow #1, milestone #0
        client.initialize(&initializer, &1u64, &0u32, &approvers, &2u32, &None);

        // Not yet approved
        assert!(!client.is_approved(&1u64, &0u32));

        // First approval
        client.approve(&approver1, &1u64, &0u32);
        assert_eq!(client.get_approval_count(&1u64, &0u32), 1);
        assert!(!client.is_approved(&1u64, &0u32));

        // Second approval - threshold met
        client.approve(&approver2, &1u64, &0u32);
        assert_eq!(client.get_approval_count(&1u64, &0u32), 2);
        assert!(client.is_approved(&1u64, &0u32));
    }
    
    #[test]
    fn test_arbitrator_override() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayApproval);
        let client = TrustPayApprovalClient::new(&env, &contract_id);

        let initializer = Address::generate(&env);
        let approver1 = Address::generate(&env);
        let approver2 = Address::generate(&env);
        let arbitrator = Address::generate(&env);

        let approvers = Vec::from_array(&env, [approver1.clone(), approver2.clone()]);

        // Initialize 2-of-2 approval, but with an arbitrator
        client.initialize(&initializer, &1u64, &0u32, &approvers, &2u32, &Some(arbitrator.clone()));

        assert!(!client.is_approved(&1u64, &0u32));

        // Arbitrator approves - instantly meets threshold
        client.approve(&arbitrator, &1u64, &0u32);
        assert!(client.is_approved(&1u64, &0u32));
    }
}
