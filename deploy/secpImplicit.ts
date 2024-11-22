// src/main.ts

import { initNear } from "./utils/nearUtils";
import { config } from "./config";
import { parseNearAmount } from "@near-js/utils";

import { InMemoryKeyStore } from "@near-js/keystores";
import { keccak256 } from "js-sha3"; // Only needed for EthImplicitAccount
import { KeyPair } from "@near-js/crypto";
import { ec } from "elliptic";
import { Near } from "@near-js/wallet-account";
import bs58 from "bs58";

// Function to generate a SECP256k1 key pair manually
function generateSECP256k1KeyPair(): { privateKey: string; publicKey: string } {
  const ecLib = new ec("secp256k1");
  const key = ecLib.genKeyPair();
  const privateKey = key.getPrivate("hex");
  const publicKey = key.getPublic("hex"); // Uncompressed by default (130 characters)

  return { privateKey, publicKey };
}

function deriveEthImplicitAccountId(secpPublicKeyHex: string): string {
  // Convert the hexadecimal public key to bytes
  const pubKeyBytes = Buffer.from(secpPublicKeyHex, "hex");

  // Hash the public key using Keccak256
  const hash = keccak256(pubKeyBytes);

  // Take the last 40 characters
  const ethAddress = "0x" + hash.slice(-40);

  return ethAddress.toLowerCase();
}

// Function to check if the account is activated
async function checkAccount(near: any, accountId: string) {
  try {
    const account = await near.account(accountId);
    const keys = await account.getAccessKeys();
    const state = await account.state();
    console.log("Account state:", state);
    console.log("Account keys:", keys);
  } catch (error: any) {
    if (error.type === "AccountDoesNotExist") {
      console.log(`Account ${accountId} does not exist.`);
    } else {
      console.error("Error checking account:", error);
    }
  }
}

async function main() {
  // Initialize NEAR connection
  const near = await initNear(config);
  const signerAccount = await near.account(config.signerAccountId);

  // Generate the SECP256k1 key pair
  const { privateKey, publicKey } = generateSECP256k1KeyPair();
  console.log("Generated SECP256k1 Key Pair:");
  console.log("Private Key:", privateKey);
  console.log("Public Key:", publicKey);

  // Derive implicit account ID
  let implicitAccountId: string;
  try {
    implicitAccountId = deriveEthImplicitAccountId(publicKey);
    console.log(
      `Derived Ethereum Implicit Account ID: ${implicitAccountId} (Length: ${implicitAccountId.length})`,
    );
  } catch (error) {
    console.error("Error deriving implicit account ID:", error);
    return;
  }

  // Send funds to the implicit account
  try {
    const amount = parseNearAmount("0.1")!; // 0.1 NEAR
    await signerAccount.sendMoney(implicitAccountId, BigInt(amount));
    console.log(`Sent 0.1 NEAR to ${implicitAccountId}`);
  } catch (error) {
    console.error("Error sending funds:", error);
    return;
  }

  // Wait for a short period to ensure the transaction is processed
  console.log("Waiting for transaction to be processed...");
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds

  // Check if the account is activated
  await checkAccount(near, implicitAccountId);

  // Add the private key to the key store
  const nodeKeyStore = new InMemoryKeyStore();
  const nearConfig = {
    networkId: config.networkId,
    nodeUrl: `https://rpc.${config.networkId}.near.org`,
    keyStore: nodeKeyStore,
  };
  const nodeNear = new Near(nearConfig);

  try {
    // Convert the hex private key to a Buffer, then to a base58 string
    const privateKeyBase58 = bs58.encode(Buffer.from(privateKey, "hex"));

    // Set the key in the key store
    await nodeKeyStore.setKey(
      config.networkId,
      implicitAccountId,
      KeyPair.fromString(`secp256k1:${privateKeyBase58}`),
    );
    console.log("Key successfully added to the key store.");
  } catch (error) {
    console.error("Error adding key to the key store:", error);
    return;
  }

  console.log("Node Key Store:", nodeKeyStore);
  const ethAccount = await nodeNear.account(implicitAccountId);
  try {
    await ethAccount.sendMoney(
      signerAccount.accountId,
      BigInt(parseNearAmount("0.01")!),
    );
    console.log("Successfully sent funds back to the original account.");
  } catch (error) {
    console.error("Error sending funds back:", error);
  }
}

main().catch((error) => {
  console.error("Error in deploy:", error);
});
