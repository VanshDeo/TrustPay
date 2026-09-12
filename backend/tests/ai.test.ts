import request from 'supertest';
import app from '../src/index';
import { heuristicParseDeal, parseDealPrompt } from '../src/services/ai';

describe('AI Deal Builder', () => {
  describe('Heuristic Rule-Based Parser', () => {
    it('parses a basic deal with amount and single milestone', () => {
      const prompt = 'Pay 250 XLM for logo design';
      const result = heuristicParseDeal(prompt);

      expect(result.amount).toBe('250');
      expect(result.milestones).toEqual(['250']);
      expect(result.fallback).toBe('refund');
      expect(result.walletlessRecipient).toBe(true);
    });

    it('parses equal milestones and deadline', () => {
      const prompt = 'Pay 600 XLM for web development in 3 equal milestones within 14 days with refund fallback';
      const result = heuristicParseDeal(prompt);

      expect(result.amount).toBe('600');
      expect(result.milestones.length).toBe(3);
      expect(result.milestones).toEqual(['200', '200', '200']);
      expect(result.deadlineDays).toBe(14);
      expect(result.deadlineSeconds).toBe(14 * 86400);
      expect(result.fallback).toBe('refund');
    });

    it('parses specific milestone amounts and addresses', () => {
      const prompt = 'Escrow 300 on wireframe and 300 on delivery to GABX6M3Z2B3H7O5C4L6N5D4S3A2Z1Q9W8E7R6T5Y4U3I2O1P9A8S7D6F with refund in 5 days';
      const result = heuristicParseDeal(prompt);

      expect(parseFloat(result.amount)).toBe(600);
      expect(result.milestones).toEqual(['300', '300']);
      expect(result.beneficiary).toBe('GABX6M3Z2B3H7O5C4L6N5D4S3A2Z1Q9W8E7R6T5Y4U3I2O1P9A8S7D6F');
      expect(result.deadlineDays).toBe(5);
      expect(result.fallback).toBe('refund');
    });

    it('parses release fallback', () => {
      const prompt = 'Pay 100 XLM for translation with auto-release in 7 days';
      const result = heuristicParseDeal(prompt);

      expect(result.amount).toBe('100');
      expect(result.fallback).toBe('release');
    });
  });

  describe('parseDealPrompt function', () => {
    it('returns a structured deal object successfully', async () => {
      const result = await parseDealPrompt('Pay 500 XLM in 2 milestones for backend development within 10 days');
      expect(result).toBeDefined();
      expect(result.amount).toBeDefined();
      expect(Array.isArray(result.milestones)).toBe(true);
      expect(result.milestones.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/ai/parse-deal API endpoint', () => {
    it('returns 400 when prompt is empty or missing', async () => {
      const res = await request(app).post('/api/ai/parse-deal').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/prompt/i);
    });

    it('successfully parses a deal prompt via HTTP', async () => {
      const res = await request(app)
        .post('/api/ai/parse-deal')
        .send({ prompt: 'Build a Next.js landing page for 400 XLM, 200 upfront, 200 on completion, 7 days deadline' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deal).toBeDefined();
      expect(res.body.deal.milestones.length).toBeGreaterThanOrEqual(1);
      expect(res.body.deal.summary).toBeDefined();
    });
  });
});
