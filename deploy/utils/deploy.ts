// deploy.ts

import { Account } from "@near-js/accounts";
import { Near } from "@near-js/wallet-account";
import { KeyPair, KeyPairString } from "@near-js/crypto";
import { Action, actionCreators } from "@near-js/transactions";
import fs from "fs";
import { parseNearAmount } from "@near-js/utils";

interface DeployContractParams {
  near: Near;
  config: any;
  signerAccount: Account;
  contractAccountId: string;
  mpcContractId: string;
  oracleAccountId: string;
  wasmFilePath: string;
  initialBalance: string;
}

export async function deployFastAuthContract(
  params: DeployContractParams,
): Promise<KeyPairString> {
  const {
    near,
    signerAccount,
    contractAccountId,
    config,
    mpcContractId,
    oracleAccountId,
    wasmFilePath,
    initialBalance,
  } = params;

  return await createAccountDeployContract({
    config,
    near,
    signerAccount,
    newAccountId: contractAccountId,
    amount: initialBalance,
    wasmPath: wasmFilePath,
    methodName: "new",
    args: {
      mpc_contract: mpcContractId,
      oracle_account_id: oracleAccountId,
    },
  });
}

export async function createAccountDeployContract({
  signerAccount,
  newAccountId,
  amount,
  near,
  wasmPath,
  methodName,
  args,
  deposit = "0",
  config,
  gas = "300000000000000",
}: {
  signerAccount: Account;
  newAccountId: string;
  amount: string;
  near: Near;
  wasmPath: string;
  methodName: string;
  args: any;
  config: any;
  deposit?: string;
  gas?: string;
}): Promise<KeyPairString> {
  console.log("Creating account: ", newAccountId);
  let sk = await createAccount({
    signerAccount,
    newAccountId,
    amount,
    config,
  });
  let keyPair = KeyPair.fromString(sk);
  console.log("Deploying contract: ", newAccountId);
  const accountObj = await near.account(newAccountId);
  await sendTransaction({
    signerAccount: accountObj,
    receiverId: newAccountId,
    methodName,
    args: { ...args, contract_key: keyPair.getPublicKey().toString() },
    deposit,
    gas,
    wasmPath,
  });

  console.log("Deployed.");
  return sk;
}

export async function sendTransaction({
  signerAccount,
  receiverId,
  methodName,
  args,
  deposit,
  gas,
  wasmPath = undefined,
}: {
  signerAccount: Account;
  receiverId: string;
  methodName: string;
  args: any;
  deposit: string;
  gas: string;
  wasmPath?: string;
}) {
  const serializedArgsBuffer = Buffer.from(JSON.stringify(args));
  const serializedArgs = new Uint8Array(serializedArgsBuffer);

  let actions: Action[] = [];

  if (wasmPath) {
    const contractCode = fs.readFileSync(wasmPath);
    actions.push(actionCreators.deployContract(contractCode));
  }

  actions.push(
    actionCreators.functionCall(
      methodName,
      serializedArgs,
      BigInt(gas),
      BigInt(parseNearAmount(deposit)!),
    ),
  );

  const result = await signerAccount.signAndSendTransaction({
    receiverId: receiverId,
    actions,
  });

  return result;
}

export async function createAccount({
  signerAccount,
  newAccountId,
  amount,
  config,
}: {
  signerAccount: Account;
  newAccountId: string;
  amount: string;
  config: any;
}) {
  const keyPair = KeyPair.fromRandom("ed25519");
  const publicKey = keyPair.getPublicKey().toString();
  await config.keyStore.setKey(config.networkId, newAccountId, keyPair);

  await signerAccount.functionCall({
    contractId: config.networkId === "testnet" ? "testnet" : "near",
    methodName: "create_account",
    args: {
      new_account_id: newAccountId,
      new_public_key: publicKey,
    },
    gas: BigInt("300000000000000"),
    attachedDeposit: BigInt(parseNearAmount(amount)!),
  });
  return keyPair.toString();
}
