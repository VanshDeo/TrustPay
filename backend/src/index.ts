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
import { aiRouter } from './routes/ai';
import { gatewayRouter } from './routes/gateway';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS Configuration ────────────────────────────────────────────────────────
// Strip trailing slashes and support comma-separated origins
const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const allowedOrigins = rawCorsOrigin
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (!allowedOrigins.includes('http://localhost:3000')) {
  allowedOrigins.push('http://localhost:3000');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, '');
      const isAllowed =
        allowedOrigins.some((allowed) => allowed === normalizedOrigin) ||
        normalizedOrigin.endsWith('.vercel.app'); // Auto-allow Vercel domains

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Escrow-Id',
      'X-Payment-Tx',
      'X-Agent-Address',
      'X-Payment-Required',
      'X-Payment-Asset',
      'X-Payment-Amount',
      'X-Payment-Destination',
    ],
  })
);

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('api/payments', paymentRoutes);
app.use('api/contracts', contractRoutes);
app.use('api/sponsor', sponsorRoutes);
app.use('api/metrics', metricsRoutes);
app.use('api/ai', aiRouter);
app.use('api/gateway', gatewayRouter);

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
    console.log(`📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch(console.error);
}

// Export app for testing
export default app;
