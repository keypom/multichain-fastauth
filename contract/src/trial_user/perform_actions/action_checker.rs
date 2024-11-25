// trial_user/perform_actions/action_checker.rs
use crate::*;
use near_sdk::json_types::{Base64VecU8, U128};
use perform_actions::near::call_fn::NearPayload;

pub(crate) fn vec_to_64_byte_array(vec: Vec<u8>) -> Option<[u8; 64]> {
    // Check if the string is exactly 64 bytes
    if vec.len() != 64 {
        return None;
    }

    // Explicitly import TryInto trait
    use std::convert::TryInto;

    let array: [u8; 64] = vec
        .try_into() // Try to convert the Vec<u8> into a fixed-size array
        .expect("Vec with incorrect length"); // This expect will never panic due to the above length check

    Some(array)
}

#[near]
impl Contract {
    pub(crate) fn assert_valid_signature(
        &self,
        payload: &NearPayload,
        signature: &Base64VecU8,
        session_key: &PublicKey,
    ) {
        // Serialize the payload
        let payload_bytes =
            near_sdk::serde_json::to_vec(&payload).expect("Failed to serialize payload");

        // Extract the raw key bytes without the curve type prefix
        let key_bytes_without_prefix = &session_key.as_bytes()[1..];
        let key_bytes_array: &[u8; 32] = key_bytes_without_prefix
            .try_into()
            .expect("Invalid key length");

        let sig_bytes =
            vec_to_64_byte_array(signature.clone().into()).expect("Invalid signature length");

        // Verify the signature
        let is_valid = env::ed25519_verify(&sig_bytes, &payload_bytes, key_bytes_array);

        require!(is_valid, "Invalid signature");
    }
}
