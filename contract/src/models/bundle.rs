use crate::*;

#[derive(Clone)]
#[near(serializers = [json, borsh])]
pub struct Bundle {
    pub mpc_key: PublicKey,

    // represents hash of google ID
    pub path: MpcPath,
}
