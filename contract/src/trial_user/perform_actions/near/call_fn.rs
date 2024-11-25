use crate::*;
use base64;
use env::keccak256;
use ethabi::{Address, Function, Param, ParamType, StateMutability, Token};
use ethereum_types::U256;
use hex;
use near_sdk::json_types::Base64VecU8;
use near_sdk::{CurveType, PromiseError};
use omni_transaction::evm::evm_transaction::EVMTransaction;
use omni_transaction::evm::evm_transaction_builder::EVMTransactionBuilder;
use omni_transaction::evm::types::Signature as OmniSignature;
use omni_transaction::transaction_builder::TxBuilder;
use sha3::{Digest, Keccak256};
use std::convert::TryInto;

#[derive(Clone)]
#[near(serializers = [json])]
pub struct NearPayload {
    contract_id: AccountId,
    method_name: String,
    args: Vec<u8>,
    gas: Gas,
    deposit: NearToken,
    nonce: U64,
}

#[near]
impl Contract {
    pub fn call_near_contract(
        &mut self,
        signature: Base64VecU8,
        payload: NearPayload,
        session_key: PublicKey,
    ) -> Promise {
        self.assert_valid_signature(&payload, &signature, &session_key);

        // Retrieve user and bundler info
        let key_usage = self
            .key_usage_by_pk
            .get(&session_key)
            .expect("Public key not recognized");

        let bundle: Bundle = self
            .bundler
            .get(&key_usage.path)
            .expect("User not found")
            .clone();

        let NearPayload {
            contract_id,
            method_name,
            args,
            gas,
            deposit,
            nonce,
        } = payload;

        // Compute value_in_wei and yocto_near
        let (value_in_wei, yocto_near) = Self::convert_deposit(deposit);

        // Build the NEAR action parameters
        let input_data =
            Self::encode_function_call(&contract_id, &method_name, &args, gas.as_gas(), yocto_near);

        // Use the stored EVM address from the bundle
        let wallet_account_id = bundle.eth_address.clone();
        let wallet_contract_address = Self::account_id_to_eth_address(&wallet_account_id);

        // Build the EVM transaction
        let evm_transaction = Self::build_evm_transaction(
            NEAR_EVM_CHAIN_ID,
            nonce.0,
            gas.as_gas(),
            wallet_contract_address,
            value_in_wei,
            input_data.clone(),
        );

        let tx_bytes = evm_transaction.build_for_signing();

        // Compute the hash of the serialized transaction
        let hashed_payload_vec = keccak256(&tx_bytes);
        let hashed_payload: [u8; 32] = hashed_payload_vec
            .try_into()
            .expect("Hash output should be 32 bytes");

        // Log the details
        env::log_str(&format!(
            "Calling NEAR contract {:?} with method {:?} via EVM txn. Hash: {:?}",
            contract_id,
            method_name,
            hex::encode(hashed_payload)
        ));

        let request_payload = create_sign_request_from_transaction(hashed_payload, &bundle.path);

        // Call the MPC contract to get a signature
        Promise::new(self.mpc_contract.clone())
            .function_call(
                "sign".to_string(),
                near_sdk::serde_json::to_vec(&request_payload).unwrap(),
                NearToken::from_near(1),
                Gas::from_tgas(50),
            )
            .then(
                // Set a callback to handle the signature
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(200))
                    .on_sign_evm_txn(evm_transaction, wallet_account_id, contract_id),
            )
    }

    /// Helper function to convert deposit into value_in_wei and yocto_near
    fn convert_deposit(deposit: NearToken) -> (u128, u32) {
        let deposit_yocto = deposit.as_yoctonear();
        let value_in_wei = deposit_yocto / 1_000_000u128;
        let yocto_near = (deposit_yocto % 1_000_000u128) as u32;
        (value_in_wei, yocto_near)
    }

    /// Helper function to encode the function call input data
    fn encode_function_call(
        contract_id: &AccountId,
        method_name: &str,
        args: &[u8],
        gas: u64,
        yocto_near: u32,
    ) -> Vec<u8> {
        let function = Function {
            name: "functionCall".to_string(),
            inputs: vec![
                Param {
                    name: "receiver_id".to_string(),
                    kind: ParamType::String,
                    internal_type: None,
                },
                Param {
                    name: "method_name".to_string(),
                    kind: ParamType::String,
                    internal_type: None,
                },
                Param {
                    name: "args".to_string(),
                    kind: ParamType::Bytes,
                    internal_type: None,
                },
                Param {
                    name: "gas".to_string(),
                    kind: ParamType::Uint(64),
                    internal_type: None,
                },
                Param {
                    name: "yocto_near".to_string(),
                    kind: ParamType::Uint(32),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            constant: None,
            state_mutability: StateMutability::NonPayable,
        };

        function
            .encode_input(&[
                Token::String(contract_id.clone().to_string()),
                Token::String(method_name.to_string()),
                Token::Bytes(args.to_vec()),
                Token::Uint(U256::from(gas)),
                Token::Uint(U256::from(yocto_near)),
            ])
            .expect("Failed to encode input")
    }

    /// Helper function to compute Ethereum address from account ID
    fn account_id_to_eth_address(account_id: &AccountId) -> Address {
        let hash = keccak256(account_id.as_bytes());
        Address::from_slice(&hash[12..32]) // Last 20 bytes
    }

    /// Helper function to build the EVM transaction
    fn build_evm_transaction(
        chain_id: u64,
        nonce: u64,
        gas_limit: u64,
        to_address: Address,
        value_in_wei: u128,
        input_data: Vec<u8>,
    ) -> EVMTransaction {
        let max_fee_per_gas = 1u128;
        let max_priority_fee_per_gas = 1u128;

        EVMTransactionBuilder::new()
            .chain_id(chain_id)
            .nonce(nonce)
            .max_priority_fee_per_gas(max_priority_fee_per_gas)
            .max_fee_per_gas(max_fee_per_gas)
            .gas_limit(gas_limit as u128)
            .to(to_address.into())
            .value(value_in_wei)
            .input(input_data)
            .build()
    }

    /// Callback function to handle the signature from the MPC contract
    #[private]
    pub fn on_sign_evm_txn(
        &mut self,
        #[callback_result] call_result: Result<OmniSignature, PromiseError>,
        evm_transaction: EVMTransaction,
        wallet_account_id: AccountId,
        target_contract_id: AccountId,
    ) -> Promise {
        match call_result {
            Ok(signature) => {
                // Construct the signed EVM transaction
                let signed_tx_bytes = evm_transaction.build_with_signature(&signature);

                // Convert the signed transaction to base64 string
                let tx_bytes_b64 = base64::encode(signed_tx_bytes);

                // Call rlp_execute on the wallet contract
                Promise::new(wallet_account_id.clone()).function_call(
                    "rlp_execute".to_string(),
                    near_sdk::serde_json::json!({
                        "target": target_contract_id,
                        "tx_bytes_b64": tx_bytes_b64,
                    })
                    .to_string()
                    .into_bytes(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(180),
                )
            }
            Err(_e) => {
                env::panic_str("Failed to get signature from MPC contract");
            }
        }
    }
}
