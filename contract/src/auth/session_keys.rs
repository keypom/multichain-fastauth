// key_management/add_keys.rs
use crate::*;

#[near]
impl Contract {
    #[payable]
    pub fn add_session_key(&mut self, public_key: PublicKey, path: MpcPath, app_id: AppID) {
        require!(
            env::predecessor_account_id() == self.oracle_account_id,
            "Only oracle can add session keys"
        );

        let initial_storage = env::storage_usage();

        // Remove existing session key for user and app
        if let Some(existing_pk) = self.session_keys.get(&(path.clone(), app_id.clone())) {
            self.key_usage_by_pk.remove(existing_pk);
            self.session_keys.remove(&(path.clone(), app_id.clone()));
        }

        let key_usage = KeyUsage {
            path: path.clone(),
            app_id: app_id.clone(),
            usage_stats: UsageStats::default(),
        };

        self.session_keys
            .insert((path.clone(), app_id.clone()), public_key.clone());
        self.key_usage_by_pk.insert(public_key, key_usage);

        self.session_keys.flush();
        self.key_usage_by_pk.flush();

        self.adjust_deposit(initial_storage, env::storage_usage());
    }
}
