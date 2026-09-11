/**
 * Payment Routes
 *
 * CRUD operations for payment/escrow records.
 * Generates shareable payment links for easy onboarding.
 */
import { Router, Request, Response } from 'express';
import { Payment, User, Approval } from '../models';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';

const router = Router();

/**
 * Hash a pin using node crypto (scrypt)
 */
function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 64).toString('hex');
}

/**
 * POST /api/payments — Create a new payment record
 * Body: { senderAddress, beneficiaryAddress, tokenAddress, amount, threshold, approvers, escrowId, deadline, fallback, walletless, claimPin }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      senderAddress,
      beneficiaryAddress,
      tokenAddress,
      amount,
      threshold,
      approvers,
      escrowId,
      deadline,
      fallback,
      walletless,
      claimPin,
      milestones,
      arbitrator,
      walletlessSender,
      senderName,
      senderEmail,
    } = req.body;

    // Generate a unique shareable link
    const shareLink = uuidv4().replace(/-/g, '').substring(0, 12);

    // Upsert the sender as a user (if provided)
    if (senderAddress) {
      await User.findOneAndUpdate(
        { walletAddress: senderAddress },
        { 
          walletAddress: senderAddress, 
          lastSeen: new Date(),
          ...(senderName && { name: senderName }),
          ...(senderEmail && { email: senderEmail })
        },
        { upsert: true, new: true }
      );
    }

    // Validate deadline if provided
    const deadlineValue = typeof deadline === 'number' && deadline > 0 ? deadline : 0;

    // Validate fallback — default to refund_sender
    const validFallbacks = ['refund_sender', 'release_beneficiary'] as const;
    const fallbackValue = validFallbacks.includes(fallback) ? fallback : 'refund_sender';

    let finalBeneficiaryAddress = beneficiaryAddress;
    let temporaryPublicKey = undefined;
    let claimPinHash = undefined;
    let temporarySecret = undefined;

    if (walletless) {
      if (!claimPin) {
        return res.status(400).json({ success: false, error: 'claimPin is required for walletless payments' });
      }
      
      const keypair = StellarSdk.Keypair.random();
      temporaryPublicKey = keypair.publicKey();
      temporarySecret = keypair.secret();
      finalBeneficiaryAddress = temporaryPublicKey;

      // Use a fixed salt or generate one (for simplicity we can use the shareLink as salt)
      claimPinHash = hashPin(claimPin, shareLink);
    }

    let finalSenderAddress = senderAddress;
    let temporarySenderPublicKey = undefined;
    let temporarySenderSecret = undefined;
    
    if (walletlessSender) {
      const keypair = StellarSdk.Keypair.random();
      temporarySenderPublicKey = keypair.publicKey();
      temporarySenderSecret = keypair.secret();
      finalSenderAddress = temporarySenderPublicKey;

      // Upsert the temporary address as a user so we can store name/email
      await User.findOneAndUpdate(
        { walletAddress: finalSenderAddress },
        { 
          walletAddress: finalSenderAddress, 
          lastSeen: new Date(),
          ...(senderName && { name: senderName }),
          ...(senderEmail && { email: senderEmail })
        },
        { upsert: true, new: true }
      );
    }
    
    let dbMilestones = [];
    if (milestones && Array.isArray(milestones) && milestones.length > 0) {
      dbMilestones = milestones.map((amt: string) => ({ amount: amt.toString(), status: 'pending' }));
    } else {
      dbMilestones = [{ amount: amount.toString(), status: 'pending' }];
    }

    const payment = await Payment.create({
      escrowId: escrowId || uuidv4(),
      senderAddress: finalSenderAddress,
      beneficiaryAddress: finalBeneficiaryAddress,
      tokenAddress,
      amount: amount.toString(),
      milestones: dbMilestones,
      threshold,
      arbitrator,
      approvers: approvers || [],
      shareLink,
      deadline: deadlineValue,
      fallback: fallbackValue,
      walletless,
      walletlessSender,
      temporaryPublicKey,
      temporarySenderPublicKey,
      claimPinHash,
    });

    res.status(201).json({
      success: true,
      payment,
      shareUrl: `/claim/${shareLink}`,
      temporarySecret,
      temporarySenderSecret,
    });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments — List payments for a wallet address
 * Query: ?wallet=G...
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.query;
    let query: any = {};

    if (wallet) {
      query = {
        $or: [
          { senderAddress: wallet },
          { beneficiaryAddress: wallet },
        ],
      };
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, payments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/:id — Get a specific payment by MongoDB ID or escrowId
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let payment = await Payment.findById(id).catch(() => null);
    if (!payment) {
      payment = await Payment.findOne({ escrowId: id });
    }

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Also fetch approvals for this payment
    const approvals = await Approval.find({ escrowId: payment.escrowId });

    res.json({ success: true, payment, approvals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/link/:shareLink — Resolve a shareable payment link
 */
router.get('/link/:shareLink', async (req: Request, res: Response) => {
  try {
    const { shareLink } = req.params;
    const payment = await Payment.findOne({ shareLink });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Invalid payment link' });
    }

    const approvals = await Approval.find({ escrowId: payment.escrowId });

    res.json({ success: true, payment, approvals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/link/:shareLink/claim — Claim a walletless payment
 * Body: { recipientAddress, temporarySecret, claimPin }
 */
import { claimWalletlessPayment } from '../services/stellar';

router.post('/link/:shareLink/claim', async (req: Request, res: Response) => {
  try {
    const { shareLink } = req.params;
    const { recipientAddress, temporarySecret, claimPin } = req.body;

    const payment = await Payment.findOne({ shareLink });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Invalid payment link' });
    }

    if (!payment.walletless) {
      return res.status(400).json({ success: false, error: 'This payment is not a walletless payment' });
    }

    if (payment.status !== 'released') {
      return res.status(400).json({ success: false, error: 'Payment has not been released yet' });
    }

    // Verify PIN
    const providedHash = hashPin(claimPin, shareLink);
    if (providedHash !== payment.claimPinHash) {
      return res.status(401).json({ success: false, error: 'Invalid claim PIN' });
    }

    // Execute the claim
    const txResponse = await claimWalletlessPayment(
      temporarySecret,
      recipientAddress,
      payment.tokenAddress,
      payment.amount
    );

    if (txResponse.status !== 'SUCCESS') {
      return res.status(500).json({ success: false, error: 'Failed to claim on-chain', details: txResponse });
    }

    // Since the funds have moved to the real recipient, update the DB so it's not claimed again
    payment.status = 'released'; // keep as released
    payment.beneficiaryAddress = recipientAddress;
    payment.walletless = false; // Mark as resolved
    await payment.save();

    res.json({ success: true, txHash: txResponse.hash });
  } catch (error: any) {
    console.error('Error claiming walletless payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
