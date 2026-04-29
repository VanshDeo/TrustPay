/**
 * Client-side Stellar/Soroban helpers.
 * Builds and simulates Soroban transactions for wallet signing.
 */
import * as StellarSdk from '@stellar/stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org:443';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

const rpcServer = new StellarSdk.rpc.Server(RPC_URL);

/**
 * Build a contract invocation transaction, simulate it, and return XDR.
 */
export async function buildContractCall(
  sourcePublicKey: string,
  contractId: string,
  functionName: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<string> {
  const account = await rpcServer.getAccount(sourcePublicKey);
  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(300)
    .build();

  const simulated = await rpcServer.simulateTransaction(tx);
  if ('error' in simulated) {
    throw new Error(`Simulation error: ${simulated.error}`);
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  return prepared.toXDR();
}

/**
 * Submit a signed transaction XDR and wait for result.
 */
export async function submitSignedTx(signedXdr: string): Promise<any> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResponse = await rpcServer.sendTransaction(tx);

  if (sendResponse.status === 'PENDING') {
    let getResponse = await rpcServer.getTransaction(sendResponse.hash);
    while (getResponse.status === 'NOT_FOUND') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResponse = await rpcServer.getTransaction(sendResponse.hash);
    }
    return getResponse;
  }

  return sendResponse;
}

/**
 * Format stroops to XLM display value.
 */
export function stroopsToXlm(stroops: string | number): string {
  const val = typeof stroops === 'string' ? parseInt(stroops) : stroops;
  return (val / 10_000_000).toFixed(2);
}

/**
 * Truncate a Stellar address for display.
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export { rpcServer, NETWORK_PASSPHRASE, StellarSdk };
