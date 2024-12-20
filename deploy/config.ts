// src/configs/simple.ts

import { UnencryptedFileSystemKeyStore } from "@near-js/keystores-node";
import path from "path";
import os from "os";

const homedir = os.homedir();
const CREDENTIALS_DIR = ".near-credentials";
const credentialsPath = path.join(homedir, CREDENTIALS_DIR);

export const DEPLOY_CONTRACT = true;
export const PERFORM_ACTIONS = false;

export const SHOULD_ACTIVATE = true;
export const SHOULD_ADD_SESSION_KEY = true;

export const EXISTING_PATH = "MPC_PATH";
export const EXISTING_APP_ID = "APP_ID";
export const EXISTING_CONTRACT_ID = "1732654372972-fastauth.testnet";

export const config = {
  networkId: "testnet",
  signerAccountId: "benjiman.testnet",
  keyStore: new UnencryptedFileSystemKeyStore(credentialsPath),
  mpcContractId: "v1.signer-prod.testnet",
  oracleAccountId: "fastauth-oracle-1.testnet",
};
