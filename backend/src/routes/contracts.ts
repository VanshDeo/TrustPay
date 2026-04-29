/**
 * Contract Routes
 *
 * Query Soroban contract state and build transactions
 * for user signing via Freighter wallet.
 */
import { Router, Request, Response } from 'express';
import { buildContractTx, queryContract } from '../services/stellar';
import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const ESCROW_CONTRACT = process.env.ESCROW_CONTRACT_ID || '';
const APPROVAL_CONTRACT = process.env.APPROVAL_CONTRACT_ID || '';

/**
 * GET /api/contracts/escrow/:escrowId — Query escrow state from chain
 */
router.get('/escrow/:escrowId', async (req: Request, res: Response) => {
  try {
    const escrowId = parseInt(req.params.escrowId);

    if (!ESCROW_CONTRACT) {
      return res.status(503).json({
        success: false,
        error: 'Escrow contract not deployed yet',
      });
    }

    const result = await queryContract(
      ESCROW_CONTRACT,
      'get_escrow',
      [StellarSdk.nativeToScVal(escrowId, { type: 'u64' })]
    );

    res.json({ success: true, escrow: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contracts/approval/:escrowId — Query approval state from chain
 */
router.get('/approval/:escrowId', async (req: Request, res: Response) => {
  try {
    const escrowId = parseInt(req.params.escrowId);

    if (!APPROVAL_CONTRACT) {
      return res.status(503).json({
        success: false,
        error: 'Approval contract not deployed yet',
      });
    }

    const result = await queryContract(
      APPROVAL_CONTRACT,
      'get_approval_count',
      [StellarSdk.nativeToScVal(escrowId, { type: 'u64' })]
    );

    res.json({ success: true, approvalCount: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contracts/approve — Build an approval transaction for user to sign
 * Body: { walletAddress, escrowId }
 */
router.post('/approve', async (req: Request, res: Response) => {
  try {
    const { walletAddress, escrowId } = req.body;

    if (!APPROVAL_CONTRACT) {
      return res.status(503).json({
        success: false,
        error: 'Approval contract not deployed yet',
      });
    }

    const txXdr = await buildContractTx(
      walletAddress,
      APPROVAL_CONTRACT,
      'approve',
      [
        StellarSdk.nativeToScVal(walletAddress, { type: 'address' }),
        StellarSdk.nativeToScVal(parseInt(escrowId), { type: 'u64' }),
      ]
    );

    res.json({ success: true, txXdr });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
