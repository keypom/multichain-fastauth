use crate::*;

#[derive(Clone)]
#[near(serializers = [json, borsh])]
pub struct Bundle {
    pub mpc_key: PublicKey,
    pub eth_address: AccountId,
    // represents hash of Google ID
    pub path: MpcPath,
}
