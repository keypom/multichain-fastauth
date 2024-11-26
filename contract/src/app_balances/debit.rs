// app_balances/deposit.rs
use crate::*;

#[near]
impl Contract {
    pub(crate) fn debit(&mut self, amount: NearToken, app_id: AppID) {
        // Retrieve current balance or initialize it to zero
        let mut current_balance = self
            .app_balances
            .get(&app_id)
            .cloned()
            .unwrap_or(NearToken::from_yoctonear(0));

        current_balance = current_balance
            .checked_add(env::attached_deposit())
            .expect("Balance overflow");

        // Check balance
        require!(
            current_balance >= amount,
            "Insufficient app balance for transaction costs."
        );

        current_balance = current_balance
            .checked_sub(amount)
            .expect("Balance overflow");

        self.app_balances.insert(app_id, current_balance);
    }
}
