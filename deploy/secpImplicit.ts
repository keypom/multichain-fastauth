// src/main.ts

import { initNear } from "./utils/nearUtils";
import { config } from "./config";
import { KeyPair } from "@near-js/crypto";
import { parseNearAmount } from "@near-js/utils";
import bs58 from "bs58";
import crypto from "crypto";

// Derive implicit account ID from SECP256k1 public key
function deriveImplicitAccountId(secpPublicKeyBase58: string): string {
  // NEAR expects lowercase hex account IDs
  // Remove the prefix if present (e.g., "secp256k1:")
  const pubKeyParts = secpPublicKeyBase58.split(":");
  if (pubKeyParts.length !== 2) {
    throw new Error(
      "Invalid public key format. Expected format 'secp256k1:<base58_key>'.",
    );
  }
  const pubKeyBase58 = pubKeyParts[1];

  // Decode the Base58 public key to bytes
  const pubKeyBytes = bs58.decode(pubKeyBase58);

  // Hash the public key using SHA256 to fit into 64 hex characters
  const hash = crypto
    .createHash("sha256")
    .update(pubKeyBytes)
    .digest("hex")
    .toLowerCase();

  // Ensure the hash is exactly 64 characters
  if (hash.length !== 64) {
    throw new Error("Hashed public key is not 64 characters long.");
  }

  return hash;
}

// Check if the account is activated
async function checkAccount(near: any, accountId: string) {
  try {
    const account = await near.account(accountId);
    const state = await account.state();
    console.log(`Account ${accountId} is active.`);
    console.log("Account state:", state);
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

  const accountPubKey = await signerAccount.viewFunction({
    contractId: config.mpcContractId,
    methodName: "derived_public_key",
    args: {
      path: "foo",
      predecessor: config.signerAccountId,
    },
  });
  console.log(`Account public key: ${accountPubKey}`);

  // Derive implicit account ID
  const implicitAccountId = deriveImplicitAccountId(accountPubKey);
  console.log(`Derived Implicit Account ID: ${implicitAccountId}`);

  // Send funds to the implicit account
  try {
    const amount = parseNearAmount("0.1")!;
    await signerAccount.sendMoney(implicitAccountId, BigInt(amount));
    console.log(`Sent 0.1 NEAR to ${implicitAccountId}`);
  } catch (error) {
    console.error("Error sending funds:", error);
    return;
  }

  // Wait for a short period to ensure the transaction is processed
  console.log("Waiting for transaction to be processed...");
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 10 seconds

  // Check if the account is activated
  await checkAccount(near, implicitAccountId);
  console.log(`Account public key: ${accountPubKey}`);
}

main().catch((error) => {
  console.error("Error in deploy: " + error);
});
