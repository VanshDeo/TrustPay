/**
 * TrustPay Backend — Express Server Entry Point
 *
 * Mounts all API routes, connects to MongoDB, and starts
 * the blockchain event indexer.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { startIndexer } from './services/indexer';

// Routes
import paymentRoutes from './routes/payments';
import contractRoutes from './routes/contracts';
import sponsorRoutes from './routes/sponsor';
import metricsRoutes from './routes/metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/payments', paymentRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/metrics', metricsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'trustpay-backend', timestamp: new Date().toISOString() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

async function start() {
  // Connect to MongoDB
  await connectDatabase();

  // Start the blockchain event indexer
  startIndexer();

  app.listen(PORT, () => {
    console.log(`🚀 TrustPay backend running on http://localhost:${PORT}`);
    console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
  });
}

start().catch(console.error);

// Export app for testing
export default app;
