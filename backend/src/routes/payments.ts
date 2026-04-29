/**
 * Payment Routes
 *
 * CRUD operations for payment/escrow records.
 * Generates shareable payment links for easy onboarding.
 */
import { Router, Request, Response } from 'express';
import { Payment, User, Approval } from '../models';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/payments — Create a new payment record
 * Body: { senderAddress, beneficiaryAddress, tokenAddress, amount, threshold, approvers, escrowId }
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
    } = req.body;

    // Generate a unique shareable link
    const shareLink = uuidv4().replace(/-/g, '').substring(0, 12);

    // Upsert the sender as a user
    await User.findOneAndUpdate(
      { walletAddress: senderAddress },
      { walletAddress: senderAddress, lastSeen: new Date() },
      { upsert: true, new: true }
    );

    const payment = await Payment.create({
      escrowId: escrowId || uuidv4(),
      senderAddress,
      beneficiaryAddress,
      tokenAddress,
      amount: amount.toString(),
      threshold,
      approvers: approvers || [],
      shareLink,
    });

    res.status(201).json({
      success: true,
      payment,
      shareUrl: `/claim/${shareLink}`,
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

export default router;
