/**
 * Fee Sponsor Routes
 *
 * Accepts user-signed transactions and wraps them in fee bump
 * transactions so users don't pay gas fees.
 */
import { Router, Request, Response } from 'express';
import { submitSponsoredTransaction } from '../services/sponsor';

const router = Router();

/**
 * POST /api/sponsor — Submit a gasless (fee-bumped) transaction
 * Body: { signedTxXdr }
 *
 * The user signs the inner transaction with their wallet (Freighter).
 * Our backend wraps it in a FeeBumpTransaction, signs with the sponsor
 * account, and submits to the network.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { signedTxXdr } = req.body;

    if (!signedTxXdr) {
      return res.status(400).json({
        success: false,
        error: 'signedTxXdr is required',
      });
    }

    console.log('🔄 Processing sponsored transaction...');
    const result = await submitSponsoredTransaction(signedTxXdr);

    res.json({
      success: true,
      result,
      message: 'Transaction submitted with fee sponsorship',
    });
  } catch (error: any) {
    console.error('Sponsor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
