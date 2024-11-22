use crate::*;

#[near]
impl Contract {
    /// View function to get key usage by public key
    pub fn get_key_usage(&self, public_key: PublicKey) -> Option<KeyUsage> {
        self.key_usage_by_pk.get(&public_key).cloned()
    }
}
