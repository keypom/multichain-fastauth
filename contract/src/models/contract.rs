use crate::*;

/// Storage keys for the contract's collections.
#[near]
#[derive(BorshStorageKey)]
pub enum StorageKeys {
    AppBalances,
    SessionKeys,
    TrialDataById,
    KeyUsageByPK,
    Bundler,
}
