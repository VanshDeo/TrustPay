/**
 * Metrics Routes
 *
 * Aggregates data from MongoDB for the dashboard metrics display.
 * Returns total users, transactions, volume locked, and active contracts.
 */
import { Router, Request, Response } from 'express';
import { User, Payment, Transaction } from '../models';

const router = Router();

/**
 * GET /api/metrics — Dashboard aggregation data
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Total registered users
    const totalUsers = await User.countDocuments();

    // Total indexed transactions
    const totalTransactions = await Transaction.countDocuments();

    // Total volume locked (sum of pending escrow amounts)
    const volumeAgg = await Payment.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: null,
          totalVolume: {
            $sum: { $toLong: '$amount' },
          },
        },
      },
    ]);
    const totalVolumeLocked = volumeAgg.length > 0 ? volumeAgg[0].totalVolume : 0;

    // Active contracts (pending payments)
    const activeContracts = await Payment.countDocuments({ status: 'pending' });

    // Total released volume
    const releasedAgg = await Payment.aggregate([
      { $match: { status: 'released' } },
      {
        $group: {
          _id: null,
          totalReleased: {
            $sum: { $toLong: '$amount' },
          },
        },
      },
    ]);
    const totalVolumeReleased = releasedAgg.length > 0 ? releasedAgg[0].totalReleased : 0;

    // Recent activity (last 10 transactions)
    const recentActivity = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalTransactions,
        totalVolumeLocked,
        totalVolumeReleased,
        activeContracts,
      },
      recentActivity,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
