// key_management/add_keys.rs
use crate::*;

#[near]
impl Contract {
    #[payable]
    pub fn add_session_key(&mut self, public_key: PublicKey, path: MpcPath) {
        require!(
            env::predecessor_account_id() == self.oracle_account_id,
            "Only admin can add session keys"
        );

        let initial_storage = env::storage_usage();

        let key_usage = KeyUsage {
            path,
            usage_stats: UsageStats::default(),
        };

        require!(
            self.key_usage_by_pk
                .insert(public_key.clone(), key_usage)
                .is_none(),
            "Key already exists"
        );

        self.key_usage_by_pk.flush();
        // Adjust the deposit based on storage usage
        self.adjust_deposit(initial_storage, env::storage_usage());
    }
}
