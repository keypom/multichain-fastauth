// app_balances/deposit.rs
use crate::*;

#[near]
impl Contract {
    #[payable]
    pub fn deposit(&mut self, app_id: AppID) {
        let deposit_amount = env::attached_deposit();

        // Retrieve current balance or initialize it to zero
        let current_balance = self
            .app_balances
            .get(&app_id)
            .cloned() // Clone the value to avoid borrowing issues
            .unwrap_or(NearToken::from_yoctonear(0));

        // Calculate the new balance
        let new_balance = current_balance
            .checked_add(deposit_amount)
            .expect("Balance overflow");

        // Update the balance
        self.app_balances.insert(app_id.clone(), new_balance);

        // Log the result
        env::log_str(&format!(
            "App {} deposited {} yoctoNEAR. New balance: {} yoctoNEAR",
            app_id, deposit_amount, new_balance
        ));
    }
}
