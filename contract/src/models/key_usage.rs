use near_sdk::json_types::U128;

// models/key_usage.rs
use crate::*;

/// Tracks usage statistics for trial accounts.
#[derive(Clone)]
#[near(serializers = [json, borsh])]
pub struct UsageStats {
    pub total_interactions: u64,
    pub interactions_per_day: HashMap<u64, u64>, // Day timestamp to interaction count
    pub methods_called: HashMap<String, u64>,    // method_name to count
    pub contracts_called: HashMap<String, u64>,  // contract_id or address to count
    pub gas_used: u128,
    pub deposit_used: U128, // For NEAR, represents yoctoNEAR; for EVM, represents wei
}
// Implement default for UsageStats
impl Default for UsageStats {
    fn default() -> Self {
        Self {
            interactions_per_day: HashMap::new(),
            total_interactions: 0,
            methods_called: HashMap::new(),
            contracts_called: HashMap::new(),
            gas_used: 0,
            deposit_used: U128(0),
        }
    }
}

/// Associates a public key with its usage stats and trial ID.
#[derive(Clone)]
#[near(serializers = [json, borsh])]
pub struct KeyUsage {
    pub usage_stats: UsageStats,

    // represents hash of google ID
    pub user_id: UserId,
}
