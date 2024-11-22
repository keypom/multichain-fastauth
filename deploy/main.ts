// src/main.ts

import { deployTrialContract } from "./utils/deploy";
import { initNear } from "./utils/nearUtils";
import { config } from "./config";
import { KeyPair } from "@near-js/crypto";

async function main() {
  // Initialize NEAR connection
  const near = await initNear(config);
  const signerAccount = await near.account(config.signerAccountId);

  const contractId = `${Date.now().toString()}-fastauth.testnet`;
  console.log(`Deploying contract with ID: ${contractId}`);
  const trialFactoryAccountSecretKey = await deployTrialContract({
    near,
    config,
    signerAccount,
    contractAccountId: contractId,
    mpcContractId: config.mpcContractId,
    oracleAccountId: config.oracleAccountId,
    wasmFilePath: "./out/fastauth.wasm", // Adjust the path as needed
    initialBalance: "50", // Adjust as needed
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
