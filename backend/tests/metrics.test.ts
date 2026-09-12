import request from 'supertest';
import app from '../src/index';

describe('Metrics and Monitoring API', () => {
  describe('POST /api/metrics/pageview', () => {
    it('records a page view with path and referrer', async () => {
      const res = await request(app)
        .post('/api/metrics/pageview')
        .send({ path: '/create', referrer: 'https://trustpay.io' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when path is missing', async () => {
      const res = await request(app).post('/api/metrics/pageview').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/path is required/i);
    });
  });

  describe('GET /api/metrics', () => {
    it('returns aggregated metrics including contract reliability and pageviews', async () => {
      const res = await request(app).get('/api/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toBeDefined();
      expect(typeof res.body.metrics.contractSuccessRate).toBe('number');
      expect(typeof res.body.metrics.totalPageViews).toBe('number');
      expect(Array.isArray(res.body.recentActivity)).toBe(true);
    });
  });
});
