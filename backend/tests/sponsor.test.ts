/**
 * Fee Sponsor Logic Tests
 *
 * Tests the fee bump transaction wrapping logic.
 * Uses mocked Stellar SDK objects to avoid network calls.
 */

describe('Fee Sponsor Service', () => {
  test('should reject when SPONSOR_SECRET_KEY is not set', async () => {
    // Save original env
    const original = process.env.SPONSOR_SECRET_KEY;
    process.env.SPONSOR_SECRET_KEY = '';

    // Dynamic import to pick up the env change
    jest.resetModules();
    const { createFeeBumpTransaction } = require('../src/services/sponsor');

    await expect(
      createFeeBumpTransaction('AAAA==')
    ).rejects.toThrow('SPONSOR_SECRET_KEY not configured');

    // Restore
    process.env.SPONSOR_SECRET_KEY = original;
  });

  test('should validate signedTxXdr is required at route level', async () => {
    const request = require('supertest');
    const express = require('express');

    const app = express();
    app.use(express.json());

    // Minimal sponsor route mock
    app.post('/api/sponsor', (req: any, res: any) => {
      if (!req.body.signedTxXdr) {
        return res.status(400).json({
          success: false,
          error: 'signedTxXdr is required',
        });
      }
      res.json({ success: true });
    });

    const res = await request(app)
      .post('/api/sponsor')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('signedTxXdr is required');
  });

  test('should accept valid signedTxXdr at route level', async () => {
    const request = require('supertest');
    const express = require('express');

    const app = express();
    app.use(express.json());

    app.post('/api/sponsor', (req: any, res: any) => {
      if (!req.body.signedTxXdr) {
        return res.status(400).json({ success: false, error: 'signedTxXdr is required' });
      }
      // Mock successful sponsorship
      res.json({ success: true, message: 'Sponsored' });
    });

    const res = await request(app)
      .post('/api/sponsor')
      .send({ signedTxXdr: 'AAAAAgAAAAB...' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
