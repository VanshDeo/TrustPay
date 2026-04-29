/**
 * Stellar SDK service — handles all interactions with Soroban RPC.
 * Builds transactions, queries contract state, and submits signed TXs.
 */
import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org:443';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';

// Soroban RPC server instance
const rpcServer = new StellarSdk.rpc.Server(RPC_URL);

/**
 * Get account details from Horizon.
 */
export async function getAccount(publicKey: string): Promise<StellarSdk.Horizon.AccountResponse> {
  const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
  return horizonServer.loadAccount(publicKey);
}

/**
 * Query a contract's state by calling a read-only function.
 */
export async function queryContract(
  contractId: string,
  functionName: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<any> {
  const contract = new StellarSdk.Contract(contractId);
  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
    { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const response = await rpcServer.simulateTransaction(tx);
  if ('result' in response && response.result) {
    return response.result;
  }
  return null;
}

/**
 * Build a Soroban transaction for a contract invocation.
 * The returned TX needs to be signed by the user's wallet.
 */
export async function buildContractTx(
  sourcePublicKey: string,
  contractId: string,
  functionName: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<string> {
  const account = await rpcServer.getAccount(sourcePublicKey);
  const contract = new StellarSdk.Contract(contractId);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(300)
    .build();

  // Simulate to get proper resource footprint
  const simulated = await rpcServer.simulateTransaction(tx);
  if ('error' in simulated) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  return prepared.toXDR();
}

/**
 * Submit a signed transaction to the Soroban RPC.
 */
export async function submitTransaction(signedTxXdr: string): Promise<any> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const response = await rpcServer.sendTransaction(tx);

  // Poll for result
  if (response.status === 'PENDING') {
    let getResponse = await rpcServer.getTransaction(response.hash);
    while (getResponse.status === 'NOT_FOUND') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResponse = await rpcServer.getTransaction(response.hash);
    }
    return getResponse;
  }

  return response;
}

/**
 * Get recent events from a specific contract for indexing.
 */
export async function getContractEvents(
  contractId: string,
  startLedger: number
): Promise<any[]> {
  try {
    const response = await rpcServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId],
        },
      ],
      limit: 100,
    });
    return response.events || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export { rpcServer, NETWORK_PASSPHRASE, RPC_URL };
