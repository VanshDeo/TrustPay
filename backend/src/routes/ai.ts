import { Router, Request, Response } from 'express';
import { parseDealPrompt } from '../services/ai';

export const aiRouter = Router();

/**
 * POST /api/ai/parse-deal
 * Parses a natural language deal description into structured TrustPay parameters.
 */
aiRouter.post('/parse-deal', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty "prompt" string is required.',
      });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt exceeds maximum length of 2000 characters.',
      });
    }

    const parsedDeal = await parseDealPrompt(prompt);

    return res.json({
      success: true,
      deal: parsedDeal,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/parse-deal:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse deal description.',
    });
  }
});
