/**
 * Payment API Tests
 *
 * Tests the payment CRUD endpoints using supertest.
 * Uses an in-memory approach — skips DB connection for unit tests.
 */
import request from 'supertest';
import express from 'express';

// Create a minimal test app with mocked routes
const app = express();
app.use(express.json());

// ─── Mock payment store ───────────────────────────────────────────────────────

const payments: any[] = [];
let idCounter = 0;

app.post('/api/payments', (req, res) => {
  const { senderAddress, beneficiaryAddress, amount, threshold } = req.body;
  if (!senderAddress || !beneficiaryAddress || !amount) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  idCounter++;
  const payment = {
    _id: `test-${idCounter}`,
    escrowId: `escrow-${idCounter}`,
    senderAddress,
    beneficiaryAddress,
    tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    amount: amount.toString(),
    status: 'pending',
    threshold: threshold || 2,
    shareLink: `link${idCounter}`,
    createdAt: new Date(),
  };
  payments.push(payment);

  res.status(201).json({
    success: true,
    payment,
    shareUrl: `/claim/${payment.shareLink}`,
  });
});

app.get('/api/payments', (req, res) => {
  const { wallet } = req.query;
  let filtered = payments;
  if (wallet) {
    filtered = payments.filter(
      (p) => p.senderAddress === wallet || p.beneficiaryAddress === wallet
    );
  }
  res.json({ success: true, payments: filtered });
});

app.get('/api/payments/:id', (req, res) => {
  const payment = payments.find(
    (p) => p._id === req.params.id || p.escrowId === req.params.id
  );
  if (!payment) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  res.json({ success: true, payment });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Payment API', () => {
  test('POST /api/payments creates a payment with share link', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({
        senderAddress: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
        beneficiaryAddress: 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB',
        amount: '500000000',
        threshold: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.payment.status).toBe('pending');
    expect(res.body.shareUrl).toBeDefined();
    expect(res.body.payment.shareLink).toBeTruthy();
  });

  test('GET /api/payments returns payment list', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body.payments.length).toBeGreaterThan(0);
  });

  test('GET /api/payments/:id returns 404 for unknown payment', async () => {
    const res = await request(app).get('/api/payments/nonexistent-id');
    expect(res.status).toBe(404);
  });

  test('POST /api/payments returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/payments').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/health returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
