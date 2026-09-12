import request from 'supertest';
import app from '../src/index';
import { GATEWAY_RESOURCES } from '../src/routes/gateway';
import { AgentMandate, ApiKey, GatewayLog, Payment } from '../src/models';

describe('Agentic Payment Gateway (x402)', () => {
  describe('GET /api/gateway/resources', () => {
    it('returns catalog of available protected resources', async () => {
      const res = await request(app).get('/api/gateway/resources');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.resources)).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);

      const first = res.body.resources[0];
      expect(first.id).toBeDefined();
      expect(first.price).toBeDefined();
      expect(first.asset).toBe('USDC');
    });
  });

  describe('GET /api/gateway/resource/:id (402 Responder)', () => {
    it('returns 404 for unknown resource', async () => {
      const res = await request(app).get('/api/gateway/resource/non-existent-resource');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Resource not found');
    });

    it('returns HTTP 402 Payment Required when payment header is missing', async () => {
      const res = await request(app).get('/api/gateway/resource/ai-inference-alpha');

      expect(res.status).toBe(402);
      expect(res.headers['x-payment-required']).toBe('true');
      expect(res.headers['x-payment-asset']).toBe('USDC');
      expect(res.headers['x-payment-amount']).toBe(GATEWAY_RESOURCES['ai-inference-alpha'].price);

      expect(res.body.error).toBe('Payment Required');
      expect(res.body.x402).toBeDefined();
      expect(res.body.x402.amount).toBe(GATEWAY_RESOURCES['ai-inference-alpha'].price);
      expect(res.body.x402.asset).toBe('USDC');
      expect(res.body.x402.destination).toBe(GATEWAY_RESOURCES['ai-inference-alpha'].destination);
      expect(res.body.x402.escrowCondition).toBeDefined();
      expect(res.body.x402.escrowCondition.threshold).toBe(1);
      expect(res.body.x402.escrowCondition.fallback).toBe('refund_sender');
    });

    it('returns HTTP 200 OK with resource data when X-Escrow-Id header is provided', async () => {
      const testEscrowId = 'escrow_test_valid_123';
      const res = await request(app)
        .get('/api/gateway/resource/ai-inference-alpha')
        .set('X-Escrow-Id', testEscrowId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.paymentVerified).toBeDefined();
      expect(res.body.paymentVerified.escrowId).toBe(testEscrowId);
      expect(res.body.resource).toBeDefined();
      expect(res.body.resource.data).toBeDefined();
      expect(res.body.resource.data.sentiment).toBe('BULLISH');
    });
  });

  describe('Agent Mandates & Spending Limits', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('validates mandate limits on payment submission', async () => {
      // Mock AgentMandate.findOne to return a mandate with 3 USDC limit (3,000,000)
      const mockMandate = {
        agentAddress: 'GA_TEST_AGENT_WALLET',
        ownerAddress: 'GA_TEST_HUMAN_OWNER',
        label: 'Test Agent',
        perTxLimit: '3000000',
        perPeriodLimit: '10000000',
        periodDuration: 86400,
        periodUsed: '0',
        periodStart: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(AgentMandate, 'findOne').mockResolvedValue(mockMandate as any);

      // Attempt payment of 5 USDC (5,000,000) -> should be rejected by per-tx limit
      const resExceed = await request(app)
        .post('/api/gateway/pay')
        .send({
          resourceId: 'ai-inference-alpha',
          agentAddress: 'GA_TEST_AGENT_WALLET',
          amount: '5000000',
        });

      expect(resExceed.status).toBe(403);
      expect(resExceed.body.code).toBe('PER_TX_LIMIT_EXCEEDED');

      // Attempt payment of 2 USDC (2,000,000) -> within limits
      const resOk = await request(app)
        .post('/api/gateway/pay')
        .send({
          resourceId: 'stellar-orderbook-feed',
          agentAddress: 'GA_TEST_AGENT_WALLET',
          amount: '2000000',
        });

      expect(resOk.status).toBe(200);
      expect(resOk.body.status).toBe('escrow_created');
      expect(resOk.body.escrowId).toBeDefined();
    });
  });

  describe('API Keys Management', () => {
    it('creates and returns API key with secret prefix', async () => {
      const mockSavedKey = {
        keyId: 'key_test123',
        name: 'Agent Test Key',
        ownerAddress: 'GA_DEV_OWNER',
        createdAt: new Date(),
      };

      jest.spyOn(ApiKey, 'create').mockResolvedValue(mockSavedKey as any);

      const res = await request(app)
        .post('/api/gateway/keys')
        .send({
          name: 'Agent Test Key',
          ownerAddress: 'GA_DEV_OWNER',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.apiKey.secretKey).toMatch(/^tp_live_/);
      expect(res.body.apiKey.keyId).toMatch(/^key_/);
    });

    it('rejects API key creation without required fields', async () => {
      const res = await request(app).post('/api/gateway/keys').send({});
      expect(res.status).toBe(400);
    });
  });
});
