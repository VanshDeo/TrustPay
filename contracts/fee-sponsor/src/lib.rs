#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// How much has been sponsored for each user
    UserSponsored(Address),
    /// Global limit per user
    MaxPerUser,
    /// Total budget available
    TotalBudget,
    /// Total already spent
    TotalSpent,
    /// Whether an address is whitelisted
    Whitelist(Address),
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SponsorError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    BudgetExhausted = 4,
    UserLimitExceeded = 5,
    NotEligible = 6,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/// Fee Sponsor Contract
///
/// Tracks on-chain eligibility and limits for gasless transaction sponsorship.
/// The actual fee bumping happens at the transaction level (JS SDK), but this
/// contract enforces who can be sponsored and how much.
#[contract]
pub struct TrustPayFeeSponsor;

#[contractimpl]
impl TrustPayFeeSponsor {
    /// Initialize the fee sponsor contract.
    ///
    /// # Arguments
    /// * `admin` - Admin address (must authorize)
    /// * `total_budget` - Total sponsorship budget (in stroops)
    /// * `max_per_user` - Maximum sponsorship per user (in stroops)
    pub fn initialize(
        env: Env,
        admin: Address,
        total_budget: i128,
        max_per_user: i128,
    ) -> Result<(), SponsorError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(SponsorError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalBudget, &total_budget);
        env.storage().instance().set(&DataKey::MaxPerUser, &max_per_user);
        env.storage().instance().set(&DataKey::TotalSpent, &0i128);

        env.events().publish(
            (symbol_short!("sponsor"), symbol_short!("init")),
            (total_budget, max_per_user),
        );
        Ok(())
    }

    /// Add an address to the sponsorship whitelist.
    pub fn add_to_whitelist(
        env: Env,
        admin: Address,
        user: Address,
    ) -> Result<(), SponsorError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(SponsorError::NotInitialized)?;
        if admin != stored_admin {
            return Err(SponsorError::Unauthorized);
        }

        env.storage().persistent().set(&DataKey::Whitelist(user.clone()), &true);

        env.events().publish(
            (symbol_short!("sponsor"), symbol_short!("wl_add")),
            user,
        );
        Ok(())
    }

    /// Check if a user is eligible for fee sponsorship.
    /// Eligibility requires: whitelisted + under per-user limit + budget available.
    pub fn is_eligible(env: Env, user: Address) -> bool {
        // Check whitelist
        let whitelisted: bool = env.storage().persistent()
            .get(&DataKey::Whitelist(user.clone()))
            .unwrap_or(false);
        if !whitelisted { return false; }

        // Check per-user limit
        let max_per_user: i128 = env.storage().instance()
            .get(&DataKey::MaxPerUser).unwrap_or(0);
        let user_spent: i128 = env.storage().persistent()
            .get(&DataKey::UserSponsored(user)).unwrap_or(0);
        if user_spent >= max_per_user { return false; }

        // Check global budget
        let total_budget: i128 = env.storage().instance()
            .get(&DataKey::TotalBudget).unwrap_or(0);
        let total_spent: i128 = env.storage().instance()
            .get(&DataKey::TotalSpent).unwrap_or(0);
        if total_spent >= total_budget { return false; }

        true
    }

    /// Record a sponsorship event. Called by the backend after successfully
    /// submitting a fee-bumped transaction.
    ///
    /// # Arguments
    /// * `admin` - Must be the admin
    /// * `user` - The user whose fees were sponsored
    /// * `amount` - The fee amount that was sponsored (in stroops)
    pub fn record_sponsorship(
        env: Env,
        admin: Address,
        user: Address,
        amount: i128,
    ) -> Result<(), SponsorError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(SponsorError::NotInitialized)?;
        if admin != stored_admin {
            return Err(SponsorError::Unauthorized);
        }

        // Check budget limits
        let total_budget: i128 = env.storage().instance()
            .get(&DataKey::TotalBudget).unwrap_or(0);
        let mut total_spent: i128 = env.storage().instance()
            .get(&DataKey::TotalSpent).unwrap_or(0);

        if total_spent + amount > total_budget {
            return Err(SponsorError::BudgetExhausted);
        }

        let max_per_user: i128 = env.storage().instance()
            .get(&DataKey::MaxPerUser).unwrap_or(0);
        let mut user_spent: i128 = env.storage().persistent()
            .get(&DataKey::UserSponsored(user.clone())).unwrap_or(0);

        if user_spent + amount > max_per_user {
            return Err(SponsorError::UserLimitExceeded);
        }

        // Update totals
        total_spent += amount;
        user_spent += amount;
        env.storage().instance().set(&DataKey::TotalSpent, &total_spent);
        env.storage().persistent().set(&DataKey::UserSponsored(user.clone()), &user_spent);

        env.events().publish(
            (symbol_short!("sponsor"), symbol_short!("record")),
            (user, amount, total_spent),
        );
        Ok(())
    }

    /// Get the remaining sponsorship budget for a specific user.
    pub fn get_user_remaining(env: Env, user: Address) -> i128 {
        let max_per_user: i128 = env.storage().instance()
            .get(&DataKey::MaxPerUser).unwrap_or(0);
        let user_spent: i128 = env.storage().persistent()
            .get(&DataKey::UserSponsored(user)).unwrap_or(0);
        max_per_user - user_spent
    }

    /// Get the total remaining global budget.
    pub fn get_total_remaining(env: Env) -> i128 {
        let total_budget: i128 = env.storage().instance()
            .get(&DataKey::TotalBudget).unwrap_or(0);
        let total_spent: i128 = env.storage().instance()
            .get(&DataKey::TotalSpent).unwrap_or(0);
        total_budget - total_spent
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_sponsorship_eligibility() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TrustPayFeeSponsor);
        let client = TrustPayFeeSponsorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let non_whitelisted = Address::generate(&env);

        // Initialize with 1 XLM budget, 0.5 XLM per user
        client.initialize(&admin, &10_000_000i128, &5_000_000i128);

        // User not whitelisted yet
        assert!(!client.is_eligible(&user));

        // Whitelist user
        client.add_to_whitelist(&admin, &user);
        assert!(client.is_eligible(&user));
        assert!(!client.is_eligible(&non_whitelisted));

        // Record a sponsorship
        client.record_sponsorship(&admin, &user, &3_000_000i128);
        assert_eq!(client.get_user_remaining(&user), 2_000_000);
        assert_eq!(client.get_total_remaining(), 7_000_000);

        // Still eligible (under limit)
        assert!(client.is_eligible(&user));

        // Record up to limit
        client.record_sponsorship(&admin, &user, &2_000_000i128);
        // Now at limit — not eligible
        assert!(!client.is_eligible(&user));
    }
}
