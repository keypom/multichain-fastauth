// src/main.ts

import { deployFastAuthContract } from "./utils/deploy";
import { callFunction, initNear } from "./utils/nearUtils";
import { config } from "./config";
import { KeyPair } from "@near-js/crypto";
import { parseNearAmount } from "@near-js/utils";

interface NearPayload {
  contract_id: string;
  method_name: string;
  args: number[];
  gas: string;
  deposit: string;
  nonce: string;
}

async function main() {
  // Initialize NEAR connection
  const near = await initNear(config);
  const signerAccount = await near.account(config.signerAccountId);
  const oracleAccount = await near.account(config.oracleAccountId);

  const contractId = `${Date.now().toString()}-fastauth.testnet`;
  console.log(`Deploying contract with ID: ${contractId}`);
  const trialFactoryAccountSecretKey = await deployFastAuthContract({
    near,
    config,
    signerAccount,
    contractAccountId: contractId,
    mpcContractId: config.mpcContractId,
    oracleAccountId: config.oracleAccountId,
    wasmFilePath: "./out/fastauth.wasm", // Adjust the path as needed
    initialBalance: "50", // Adjust as needed
  });

  const path = Date.now().toString();
  const mpcKey = await oracleAccount.viewFunction({
    contractId: config.mpcContractId,
    methodName: "derived_public_key",
    args: {
      path,
      predecessor: contractId,
    },
  });
  console.log("MPC key: ", mpcKey);

  // Assume oAuth is verified already.
  // Step 1 is to activate the account and get the user ID
  await callFunction({
    signerAccount: oracleAccount,
    contractId,
    methodName: "activate_account",
    args: {
      mpc_key: mpcKey,
      path,
    },
    gas: BigInt("300000000000000"),
    attachedDeposit: BigInt(parseNearAmount("0.1")!),
  });

  // Step 2 add session key
  const sessionKeyPair = KeyPair.fromRandom("ed25519");
  const publicKey = sessionKeyPair.getPublicKey();

  await callFunction({
    signerAccount: oracleAccount,
    contractId,
    methodName: "add_session_key",
    args: {
      path,
      public_key: publicKey.toString(),
    },
    gas: BigInt("300000000000000"),
    attachedDeposit: BigInt(parseNearAmount("0.1")!),
  });

  // Step 3 is to request a signature
  const actionToPerform = {
    targetContractId: "guestbook.near-examples.testnet",
    methodName: "add_message",
    args: { text: "Hello from the Eth Implicit Account!" },
    attachedDepositNear: "0",
    gas: "100000000000000",
    chain: "NEAR",
  };

  const argsSerialized = JSON.stringify(actionToPerform.args);
  const argsBytes = Buffer.from(argsSerialized);
  const argsArray = Array.from(argsBytes);

  const nonce = await oracleAccount.viewFunction({
    contractId: "ETH ACCOUNT HERE"  
    methodName: "get_nonce",
    args: {
    },
  });
 
  const nearPayload: NearPayload = {
    contract_id: actionToPerform.targetContractId,
    method_name: actionToPerform.methodName,
    args: argsArray,
    gas: actionToPerform.gas,
    deposit: parseNearAmount(actionToPerform.attachedDepositNear)!,
    nonce: "0", // Set to 0 or an appropriate nonce
  };

  const payloadJson = JSON.stringify(nearPayload);
  const payloadBytes = Buffer.from(payloadJson);

  const signatureObj = sessionKeyPair.sign(payloadBytes);
  const signatureBase64 = Buffer.from(signatureObj.signature).toString(
    "base64",
  );

  await callFunction({
    signerAccount: oracleAccount,
    contractId,
    methodName: "call_near_contract",
    args: {
      signature: signatureBase64,
      payload: nearPayload,
      session_key: publicKey.toString(),
    },
    gas: BigInt("300000000000000"),
    attachedDeposit: BigInt(0),
  });

  // Set the trial key in the keyStore
  const keyStore: any = (near.connection.signer as any).keyStore;
  await keyStore.setKey(
    near.connection.networkId,
    contractId,
    KeyPair.fromString(trialFactoryAccountSecretKey),
  );
}

main().catch((error) => {
  console.error("Error in deploy: " + error);
});
