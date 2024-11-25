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

function deriveEthImplicitAccountId(secpPublicKeyHex: string): string {
  // Convert the hexadecimal public key to bytes
  const pubKeyBytes = Buffer.from(secpPublicKeyHex, "hex");

  // Hash the public key using Keccak256
  const hash = keccak256(pubKeyBytes);

  // Take the last 40 characters
  const ethAddress = hash.slice(-40);

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

  const publicKey = await signerAccount.viewFunction({
    contractId: config.mpcContractId,
    methodName: "derived_public_key",
    args: {
      path: "foo",
      predecessor: config.signerAccountId,
    },
  });

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
}

main().catch((error) => {
  console.error("Error in deploy:", error);
});
