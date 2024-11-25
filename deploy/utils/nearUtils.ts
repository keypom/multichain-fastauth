import { Account } from "@near-js/accounts";
import { Near } from "@near-js/wallet-account";

/**
 * Helper function to retry an async operation with exponential backoff.
 *
 * @param fn - The async function to retry.
 * @param retries - Number of retries.
 * @param delay - Initial delay in milliseconds.
 * @param factor - Multiplicative factor for delay.
 * @returns The result of the async function if successful.
 * @throws The last error encountered if all retries fail.
 */
async function retryAsync<T>(
  fn: () => Promise<T>,
  retries: number = 5,
  delay: number = 10000,
  factor: number = 1,
): Promise<T> {
  let attempt = 0;
  let currentDelay = delay;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      console.warn(
        `Attempt ${attempt} failed. Retrying in ${currentDelay}ms...`,
        `Error: ${error.message || error}`,
      );
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= factor; // Exponential backoff
    }
  }

  // This point should never be reached
  throw new Error("Unexpected error in retryAsync");
}

/**
 * Initializes a NEAR connection using the provided configuration.
 *
 * @param config - The configuration object containing network ID, key store, etc.
 * @returns A Promise that resolves to a Near instance.
 */
export async function initNear(config: any): Promise<Near> {
  const nearConfig = {
    networkId: config.networkId,
    nodeUrl: `https://g.w.lavanet.xyz:443/gateway/neart/rpc-http/f653c33afd2ea30614f69bc1c73d4940`,
    keyStore: config.keyStore,
  };
  const near = new Near(nearConfig);
  return near;
}

export async function callFunction({
  signerAccount,
  contractId,
  methodName,
  args,
  gas,
  attachedDeposit,
}: {
  signerAccount: Account;
  contractId: string;
  methodName: string;
  args: any;
  gas: bigint;
  attachedDeposit: bigint;
}) {
  const executeTransaction = async () => {
    const res = await signerAccount.functionCall({
      contractId,
      methodName,
      args,
      gas,
      attachedDeposit,
    });
    const txnHash = res.transaction.hash;
    console.log(
      `${methodName}: https://testnet.nearblocks.io/txns/${txnHash}#execution`,
    );
    return res;
  };

  try {
    await retryAsync(executeTransaction);
  } catch (e) {
    console.error(e);
    console.error(
      `${methodName} failed: https://testnet.nearblocks.io/address/${contractId}`,
    );
    throw new Error("Transaction failed");
  }
}
