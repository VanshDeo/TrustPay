/**
 * Event Indexer Service
 *
 * Polls Soroban RPC for contract events and stores them in MongoDB.
 * Runs on a cron schedule (every 10 seconds) to keep the database
 * in sync with on-chain state.
 */
import { getContractEvents } from './stellar';
import { Transaction, Payment, User } from '../models';
import dotenv from 'dotenv';

dotenv.config();

// Track the last processed ledger to avoid re-processing
let lastProcessedLedger: number = 0;

/**
 * Contract IDs to index events from.
 */
function getContractIds(): string[] {
  const ids: string[] = [];
  if (process.env.ESCROW_CONTRACT_ID) ids.push(process.env.ESCROW_CONTRACT_ID);
  if (process.env.APPROVAL_CONTRACT_ID) ids.push(process.env.APPROVAL_CONTRACT_ID);
  if (process.env.FEE_SPONSOR_CONTRACT_ID) ids.push(process.env.FEE_SPONSOR_CONTRACT_ID);
  return ids;
}

/**
 * Process and store a single event in the database.
 * Updates payment status based on event type.
 */
async function processEvent(event: any): Promise<void> {
  try {
    const txHash = event.id || `${event.txHash || 'unknown'}-${Date.now()}`;

    // Skip if we already have this event
    const existing = await Transaction.findOne({ txHash });
    if (existing) return;

    // Determine event type from the topic
    const topics = event.topic || [];
    let eventType = 'unknown';

    if (topics.length >= 2) {
      // Soroban events have topics as ScVal — we extract the string representations
      const topic0 = topics[0]?.toString() || '';
      const topic1 = topics[1]?.toString() || '';
      eventType = `${topic0}_${topic1}`;
    }

    // Store the raw event
    await Transaction.create({
      txHash,
      eventType,
      contractId: event.contractId || '',
      data: event.value || {},
      ledgerSequence: event.ledger || 0,
    });

    // Update payment status based on event type
    if (eventType.includes('released')) {
      // Try to extract escrow ID from event data and update payment
      const escrowId = extractEscrowId(event);
      if (escrowId) {
        await Payment.findOneAndUpdate(
          { escrowId },
          { status: 'released', updatedAt: new Date() }
        );
      }
    } else if (eventType.includes('cancel')) {
      const escrowId = extractEscrowId(event);
      if (escrowId) {
        await Payment.findOneAndUpdate(
          { escrowId },
          { status: 'cancelled', updatedAt: new Date() }
        );
      }
    }

    console.log(`📡 Indexed event: ${eventType} (ledger: ${event.ledger})`);
  } catch (error) {
    console.error('Error processing event:', error);
  }
}

/**
 * Extract escrow ID from an event's data payload.
 */
function extractEscrowId(event: any): string | null {
  try {
    if (event.value && typeof event.value === 'object') {
      // The first element in the value tuple is typically the escrow ID
      return event.value[0]?.toString() || null;
    }
  } catch { }
  return null;
}

/**
 * Run one indexing cycle: fetch events from all contracts and process them.
 */
export async function indexEvents(): Promise<void> {
  const contractIds = getContractIds();
  if (contractIds.length === 0) {
    return; // No contracts configured yet
  }

  const startLedger = lastProcessedLedger > 0 ? lastProcessedLedger : 1;

  for (const contractId of contractIds) {
    try {
      const events = await getContractEvents(contractId, startLedger);

      for (const event of events) {
        await processEvent(event);
        // Track the highest ledger we've processed
        if (event.ledger && event.ledger > lastProcessedLedger) {
          lastProcessedLedger = event.ledger;
        }
      }
    } catch (error) {
      console.error(`Error indexing events for ${contractId}:`, error);
    }
  }
}

/**
 * Start the indexer as a recurring job.
 * Polls every 10 seconds.
 */
export function startIndexer(): void {
  console.log('📡 Event indexer started (polling every 10s)');
  // Run immediately
  indexEvents().catch(console.error);
  // Then run on interval
  setInterval(() => {
    indexEvents().catch(console.error);
  }, 10_000);
}
