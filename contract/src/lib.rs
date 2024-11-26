// lib.rs
use near_sdk::json_types::{Base58CryptoHash, U64};
use near_sdk::store::LookupMap;
use near_sdk::{
    env, near, require, AccountId, Allowance, BorshStorageKey, Gas, GasWeight, NearToken,
    PanicOnDefault, Promise, PublicKey,
};

use omni_transaction::transaction_builder::TransactionBuilder;
use omni_transaction::transaction_builder::TxBuilder;
use omni_transaction::{
    near::types::{
        Action as OmniAction, BlockHash as OmniBlockHash,
        FunctionCallAction as OmniFunctionCallAction, U128 as OmniU128, U64 as OmniU64,
    },
    types::NEAR,
};
use std::collections::HashMap;

pub mod app_balances;
pub mod auth;
pub mod models;
pub mod trial_user;
pub mod utils;
pub mod views;

pub use app_balances::*;
pub use auth::*;
pub use models::*;
pub use trial_user::*;
pub use utils::*;

#[near(contract_state, serializers = [borsh])]
#[derive(PanicOnDefault)]
pub struct Contract {
    // Keys
    pub session_keys: LookupMap<(MpcPath, AppID), PublicKey>,
    pub key_usage_by_pk: LookupMap<PublicKey, KeyUsage>,
    pub bundler: LookupMap<MpcPath, Bundle>,

    // Apps
    pub app_balances: LookupMap<AppID, NearToken>,

    // Admin
    pub oracle_account_id: AccountId,
    pub mpc_contract: AccountId,
}

#[near]
impl Contract {
    #[init]
    pub fn new(oracle_account_id: AccountId, mpc_contract: AccountId) -> Self {
        Self {
            session_keys: LookupMap::new(StorageKeys::SessionKeys),
            key_usage_by_pk: LookupMap::new(StorageKeys::KeyUsageByPK),
            bundler: LookupMap::new(StorageKeys::Bundler),
            app_balances: LookupMap::new(StorageKeys::AppBalances),
            oracle_account_id,
            mpc_contract,
        }
    }
}
