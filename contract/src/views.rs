use crate::*;

#[near]
impl Contract {
    /// View function to get key usage by public key
    pub fn get_key_usage(&self, public_key: PublicKey) -> Option<KeyUsage> {
        self.key_usage_by_pk.get(&public_key).cloned()
    }

    /// View function to get a user's bundle
    pub fn get_bundle(&self, path: MpcPath) -> Option<Bundle> {
        self.bundler.get(&path).cloned()
    }

    /// View function to get a user's app balance
    pub fn get_app_balance(&self, app_id: AppID) -> NearToken {
        self.app_balances
            .get(&app_id)
            .cloned()
            .unwrap_or(NearToken::from_yoctonear(0))
    }
}
