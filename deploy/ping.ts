// src/main.ts

import { initNear } from "./utils/nearUtils";
import { config, EXISTING_CONTRACT_ID } from "./config";
import { KeyPair } from "@near-js/crypto";

async function main() {
  // Initialize NEAR connection
  const near = await initNear(config);
  const signerAccount = await near.account(config.signerAccountId);

  const keyPair = KeyPair.fromString(
    `ed25519:5XHQDj7ukDFTwprcz19RFWWtdnkRKVqeTP9dFpD4tcShpGbHKHV4z58tjmTSnJj7RdcEDzq5x1eP55QNfkfFK2Zw`,
  );

  const keyUsage = await signerAccount.viewFunction({
    contractId: EXISTING_CONTRACT_ID,
    methodName: "get_key_usage",
    args: {
      public_key: keyPair.getPublicKey().toString(),
    },
  });

  console.log(keyUsage);
}

main().catch((error) => {
  console.error("Error in deploy:", error);
});
