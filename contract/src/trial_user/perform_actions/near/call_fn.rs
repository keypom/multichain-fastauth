use near_sdk::json_types::Base64VecU8;

// usage_tracking/usage_stats.rs
use crate::*;

/// Represents a sign request sent to the MPC contract.
#[derive(Clone)]
#[near(serializers = [json])]
pub struct NearPayload {
    signer_id: AccountId,
    signer_pk: PublicKey,
    contract_id: AccountId,
    method_name: String,
    args: Vec<u8>,
    gas: Gas,
    deposit: NearToken,
    nonce: U64,
    block_hash: Base58CryptoHash,
}

#[near]
impl Contract {
    /// Calls a NEAR contract via the MPC contract.
    pub fn call_near_contract(
        &mut self,
        signature: Base64VecU8,
        payload: NearPayload,
        public_key: PublicKey,
    ) -> Promise {
        self.assert_valid_signature(&payload, &signature, &public_key);

        // Check if the public key is associated with a known session key
        let key_usage = self
            .key_usage_by_pk
            .get(&public_key)
            .expect("Public key not recognized");
        let user_id = key_usage.user_id.clone();

        let NearPayload {
            signer_id,
            signer_pk,
            contract_id,
            method_name,
            args,
            gas,
            deposit,
            nonce,
            block_hash,
        } = payload;

        let actions = vec![OmniAction::FunctionCall(Box::new(OmniFunctionCallAction {
            method_name: method_name.clone(),
            args: args.clone(),
            gas: OmniU64(gas.as_gas()),
            deposit: OmniU128(deposit.as_yoctonear()),
        }))];

        // Build the NEAR transaction
        let tx = TransactionBuilder::new::<NEAR>()
            .signer_id(signer_id.clone().to_string())
            .signer_public_key(convert_pk_to_omni(&signer_pk))
            .nonce(nonce.0) // Use the provided nonce
            .receiver_id(contract_id.clone().to_string())
            .block_hash(OmniBlockHash(block_hash.into()))
            .actions(actions.clone())
            .build()
            .build_for_signing();

        // Compute the SHA-256 hash of the serialized transaction
        let hashed_payload = hash_payload(&tx);

        // Log the details
        env::log_str(&format!(
            "Calling NEAR contract {:?} with method {:?}. Hash: {:?}",
            contract_id, method_name, hashed_payload
        ));

        let request_payload = create_sign_request_from_transaction(hashed_payload, &user_id);

        // Call the MPC contract to get a signature
        Promise::new(self.mpc_contract.clone())
            .function_call_weight(
                "sign".to_string(),
                near_sdk::serde_json::to_vec(&request_payload).unwrap(),
                NearToken::from_near(1),
                Gas::from_tgas(30),
                GasWeight(1),
            )
            .as_return()
    }
}
