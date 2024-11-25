// key_management/add_keys.rs
use crate::*;

#[near]
impl Contract {
    #[payable]
    pub fn activate_account(&mut self, mpc_key: PublicKey, eth_address: AccountId, path: String) {
        require!(
            env::predecessor_account_id() == self.oracle_account_id,
            "Only admin can add session keys"
        );

        let initial_storage = env::storage_usage();

        let bundle = Bundle {
            mpc_key: mpc_key.clone(),
            eth_address: eth_address.clone(), // Store the EVM address
            path: path.clone(),
        };
        require!(
            self.bundler.insert(path.clone(), bundle).is_none(),
            "User already activated"
        );

        // Use the passed-in EVM address
        let eth_implicit_account = eth_address.clone();

        // Activate the new sub-account
        Promise::new(eth_implicit_account.clone()).transfer(NearToken::from_millinear(100)); // Attach 0.1 NEAR for account creation

        self.bundler.flush();
        // Adjust the deposit based on storage usage
        self.adjust_deposit(initial_storage, env::storage_usage());
    }
}
