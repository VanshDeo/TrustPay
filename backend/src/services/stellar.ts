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

export async function claimWalletlessPayment(
  temporarySecret: string,
  recipientAddress: string,
  tokenAddress: string,
  amount: string
): Promise<any> {
  const temporaryKeypair = StellarSdk.Keypair.fromSecret(temporarySecret);
  const sourcePublicKey = temporaryKeypair.publicKey();

  const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY || '';
  if (!SPONSOR_SECRET) {
    throw new Error('SPONSOR_SECRET_KEY not configured');
  }
  const sponsorKeypair = StellarSdk.Keypair.fromSecret(SPONSOR_SECRET);
  const sponsorAccount = await rpcServer.getAccount(sponsorKeypair.publicKey());

  // Handle "native" token explicitly
  if (tokenAddress === 'native' || tokenAddress === 'XLM') {
    // Native XLM token contract on Testnet
    tokenAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  }

  const contract = new StellarSdk.Contract(tokenAddress);
  
  let tx = new StellarSdk.TransactionBuilder(sponsorAccount, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('transfer', 
      StellarSdk.nativeToScVal(sourcePublicKey, { type: 'address' }),
      StellarSdk.nativeToScVal(recipientAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(parseInt(amount), { type: 'i128' })
    ))
    .setTimeout(300)
    .build();

  const simulated = await rpcServer.simulateTransaction(tx);
  if ('error' in simulated) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  
  // Sign with BOTH the sponsor (for tx source) and the temporary key (for soroban auth)
  prepared.sign(sponsorKeypair);
  prepared.sign(temporaryKeypair);

  const response = await rpcServer.sendTransaction(prepared);

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

export async function createEscrowOnChain(
  temporarySenderSecret: string,
  beneficiaryAddress: string,
  tokenAddress: string,
  milestoneAmounts: string[],
  approvalContractId: string,
  threshold: number,
  deadline: number,
  fallbackValue: string,
  escrowContractId: string
): Promise<any> {
  const temporaryKeypair = StellarSdk.Keypair.fromSecret(temporarySenderSecret);
  const sourcePublicKey = temporaryKeypair.publicKey();

  const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY || '';
  if (!SPONSOR_SECRET) {
    throw new Error('SPONSOR_SECRET_KEY not configured');
  }
  const sponsorKeypair = StellarSdk.Keypair.fromSecret(SPONSOR_SECRET);
  const sponsorAccount = await rpcServer.getAccount(sponsorKeypair.publicKey());

  // Handle "native" token explicitly
  if (tokenAddress === 'native' || tokenAddress === 'XLM') {
    // Native XLM token contract on Testnet
    tokenAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  }

  const contract = new StellarSdk.Contract(escrowContractId);

  const vecMilestones = milestoneAmounts.map(amt => StellarSdk.nativeToScVal(parseInt(amt, 10), { type: 'i128' }));

  // Fallback enum: 0 = RefundSender, 1 = ReleaseBeneficiary (based on rust enum definition)
  const fallbackEnumVal = fallbackValue === 'refund_sender' ? 0 : 1;
  const fallbackScVal = StellarSdk.xdr.ScVal.scvVec([
    StellarSdk.xdr.ScVal.scvSymbol(fallbackValue === 'refund_sender' ? 'RefundSender' : 'ReleaseBeneficiary')
  ]);
  
  let tx = new StellarSdk.TransactionBuilder(sponsorAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('create_escrow',
      StellarSdk.nativeToScVal(sourcePublicKey, { type: 'address' }),
      StellarSdk.nativeToScVal(beneficiaryAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenAddress, { type: 'address' }),
      StellarSdk.xdr.ScVal.scvVec(vecMilestones),
      StellarSdk.nativeToScVal(approvalContractId, { type: 'address' }),
      StellarSdk.nativeToScVal(threshold, { type: 'u32' }),
      StellarSdk.nativeToScVal(deadline, { type: 'u64' }),
      fallbackScVal
    ))
    .setTimeout(300)
    .build();

  const simulated = await rpcServer.simulateTransaction(tx);
  if ('error' in simulated) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  
  // Sign with BOTH the sponsor (for tx source) and the temporary key (for soroban auth)
  prepared.sign(sponsorKeypair);
  prepared.sign(temporaryKeypair);

  const response = await rpcServer.sendTransaction(prepared);

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

export { rpcServer, NETWORK_PASSPHRASE, RPC_URL };
