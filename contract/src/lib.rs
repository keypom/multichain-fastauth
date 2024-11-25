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

pub mod auth;
pub mod models;
pub mod trial_user;
pub mod utils;
pub mod views;

pub use auth::*;
pub use models::*;
pub use trial_user::*;
pub use utils::*;

#[near(contract_state, serializers = [borsh])]
#[derive(PanicOnDefault)]
pub struct Contract {
    // session key -> key usage
    pub key_usage_by_pk: LookupMap<PublicKey, KeyUsage>,
    // mpc path -> bundle
    pub bundler: LookupMap<MpcPath, Bundle>,

    pub oracle_account_id: AccountId,
    pub mpc_contract: AccountId,
}

#[near]
impl Contract {
    #[init]
    pub fn new(oracle_account_id: AccountId, mpc_contract: AccountId) -> Self {
        Self {
            key_usage_by_pk: LookupMap::new(StorageKeys::KeyUsageByPK),
            bundler: LookupMap::new(StorageKeys::Bundler),
            oracle_account_id,
            mpc_contract,
        }
    }
}
