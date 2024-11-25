// src/main.ts

import { deployFastAuthContract } from "./utils/deploy";
import { callFunction, initNear } from "./utils/nearUtils";
import { config } from "./config";
import { KeyPair } from "@near-js/crypto";
import { parseNearAmount } from "@near-js/utils";

import { ec as EC } from "elliptic";
import bs58 from "bs58";
import { ethers } from "ethers";

const ec = new EC("secp256k1");

interface NearPayload {
  contract_id: string;
  method_name: string;
  args: number[];
  gas: string;
  deposit: string;
  nonce: string;
}

const doesExist = async (near: any, accountId: string) => {
  try {
    const account = await near.account(accountId);
    const state = await account.state();
    console.log("Account state:", state);
    return true;
  } catch (error: any) {
    return false;
  }
};

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
    initialBalance: "25", // Adjust as needed
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

  function deriveEthAddressFromMpcKey(mpcKey: string): string {
    // Remove the curve type prefix
    const [curveType, keyDataBase58] = mpcKey.split(":");
    if (curveType !== "secp256k1") {
      throw new Error("Expected secp256k1 key");
    }
    const keyData = bs58.decode(keyDataBase58); // Key data
    console.log("Key data length:", keyData.length);
    console.log("Key data (hex):", Buffer.from(keyData).toString("hex"));

    if (keyData.length === 64) {
      // Uncompressed public key without prefix byte
      // Add the '04' prefix to indicate uncompressed key
      const uncompressedPublicKeyHex =
        "04" + Buffer.from(keyData).toString("hex");
      // Compute the Ethereum address using ethers.js
      const ethAddress = ethers.computeAddress("0x" + uncompressedPublicKeyHex);
      return ethAddress.toLowerCase();
    } else {
      throw new Error(
        "Unsupported public key format. Expected 64 bytes of key data.",
      );
    }
  }

  const ethImplicitAccountId = deriveEthAddressFromMpcKey(mpcKey);
  console.log("Eth Implicit Account ID:", ethImplicitAccountId);
  let exists = await doesExist(near, ethImplicitAccountId);
  if (exists) {
    throw new Error(`Account ${ethImplicitAccountId} already exists.`);
  }

  // Assume oAuth is verified already.
  // Step 1 is to activate the account and get the user ID
  await callFunction({
    signerAccount: oracleAccount,
    contractId,
    methodName: "activate_account",
    args: {
      mpc_key: mpcKey,
      eth_address: ethImplicitAccountId,
      path,
    },
    gas: BigInt("300000000000000"),
    attachedDeposit: BigInt(parseNearAmount("0.1")!),
  });

  exists = await doesExist(near, ethImplicitAccountId);
  if (!exists) {
    throw new Error(`Account ${ethImplicitAccountId} does not exist`);
  }

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
    contractId: ethImplicitAccountId,
    methodName: "get_nonce",
    args: {},
  });
  console.log("Nonce: ", nonce);

  const nearPayload: NearPayload = {
    contract_id: actionToPerform.targetContractId,
    method_name: actionToPerform.methodName,
    args: argsArray,
    gas: actionToPerform.gas,
    deposit: parseNearAmount(actionToPerform.attachedDepositNear)!,
    nonce,
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
