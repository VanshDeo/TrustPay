/**
 * Fee Sponsor Service
 *
 * Wraps user-signed inner transactions in a FeeBumpTransaction,
 * signs with the sponsor keypair, and submits to the network.
 * This enables gasless transactions for users.
 */
import * as StellarSdk from '@stellar/stellar-sdk';
import { rpcServer, NETWORK_PASSPHRASE } from './stellar';
import dotenv from 'dotenv';

dotenv.config();

const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY || '';

/**
 * Wrap a user-signed transaction in a fee bump transaction.
 * The sponsor pays the network fees on behalf of the user.
 *
 * @param innerTxXdr - The base64 XDR of the user-signed inner transaction
 * @returns The signed fee-bump transaction XDR ready for submission
 */
export async function createFeeBumpTransaction(innerTxXdr: string): Promise<string> {
  if (!SPONSOR_SECRET) {
    throw new Error('SPONSOR_SECRET_KEY not configured');
  }

  const sponsorKeypair = StellarSdk.Keypair.fromSecret(SPONSOR_SECRET);

  // Parse the inner transaction from XDR
  const innerTx = StellarSdk.TransactionBuilder.fromXDR(
    innerTxXdr,
    NETWORK_PASSPHRASE
  ) as StellarSdk.Transaction;

  // Build the fee bump transaction
  // The sponsor pays a higher fee to cover both transactions
  const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    sponsorKeypair,
    '50000', // Max fee in stroops (0.005 XLM)
    innerTx,
    NETWORK_PASSPHRASE
  );

  // Sponsor signs the fee bump
  feeBumpTx.sign(sponsorKeypair);

  return feeBumpTx.toXDR();
}

/**
 * Submit a fee-bumped transaction to the network and wait for result.
 */
export async function submitSponsoredTransaction(innerTxXdr: string): Promise<any> {
  const feeBumpXdr = await createFeeBumpTransaction(innerTxXdr);
  const feeBumpTx = StellarSdk.TransactionBuilder.fromXDR(
    feeBumpXdr,
    NETWORK_PASSPHRASE
  );

  const response = await rpcServer.sendTransaction(feeBumpTx);

  // Poll for completion
  if (response.status === 'PENDING') {
    let result = await rpcServer.getTransaction(response.hash);
    let attempts = 0;
    while (result.status === 'NOT_FOUND' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await rpcServer.getTransaction(response.hash);
      attempts++;
    }
    return result;
  }

  return response;
}
