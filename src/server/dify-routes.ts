/**
 * Production Server Endpoints for Dify Token Consumption System
 * 
 * This file provides example Express.js endpoints that would be used in production.
 * In the current demo environment, these are reference implementations.
 */

import express from 'express';
import { difyAPI } from '../api/dify-api';
import { DifyWebhookPayload } from '../types';

const router = express.Router();

/**
 * POST /api/dify/webhook
 * Receive Dify webhook for token consumption tracking
 */
router.post('/api/dify/webhook', async (req, res) => {
  try {
    const payload: DifyWebhookPayload = req.body;
    const headers = {
      'x-api-key': req.headers['x-api-key'] as string || req.headers.authorization?.replace('Bearer ', '') || '',
      'x-user-id': req.headers['x-user-id'] as string || '',
      'x-service-id': req.headers['x-service-id'] as string || 'default-service'
    };

    // Validate required headers
    if (!headers['x-api-key']) {
      return res.status(401).json({
        success: false,
        message: 'Missing API key'
      });
    }

    if (!headers['x-user-id']) {
      return res.status(400).json({
        success: false,
        message: 'Missing user ID'
      });
    }

    // Process the webhook
    const result = await difyAPI.processWebhook(payload, headers);
    
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/user/points/estimate
 * Estimate points consumption for given parameters
 */
router.get('/api/user/points/estimate', async (req, res) => {
  try {
    const { modelName, inputTokens, outputTokens } = req.query;

    if (!modelName || !inputTokens || !outputTokens) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: modelName, inputTokens, outputTokens'
      });
    }

    const result = await difyAPI.estimatePointsConsumption(
      modelName as string,
      parseInt(inputTokens as string),
      parseInt(outputTokens as string)
    );

    res.json(result);
  } catch (error) {
    console.error('Estimation endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/user/points/check-balance
 * Check user balance for estimated consumption
 */
router.post('/api/user/points/check-balance', async (req, res) => {
  try {
    const { userId, modelName, inputTokens, outputTokens } = req.body;

    if (!userId || !modelName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, modelName'
      });
    }

    const result = await difyAPI.checkUserBalance(
      userId,
      modelName,
      inputTokens || 1000,
      outputTokens || 500
    );

    res.json(result);
  } catch (error) {
    console.error('Balance check endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/user/points/deduct
 * Manual points deduction
 */
router.post('/api/user/points/deduct', async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deduction parameters'
      });
    }

    const result = await difyAPI.deductPoints(userId, amount, reason || 'Manual deduction');
    res.json(result);
  } catch (error) {
    console.error('Points deduction endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/user/points/history
 * Get user's points consumption history
 */
router.get('/api/user/points/history', async (req, res) => {
  try {
    const { userId } = req.query;
    const limit = parseInt((req.query.limit as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing userId parameter'
      });
    }

    const result = await difyAPI.getConsumptionHistory(userId as string, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('History endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Middleware for API key validation
 */
const validateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required'
    });
  }

  // In production, validate against database
  if (typeof apiKey === 'string' && (
    apiKey === 'prome_wh_key_123456' || 
    apiKey.startsWith('prome_') ||
    apiKey.length >= 8
  )) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }
};

/**
 * Apply API key validation to webhook endpoint
 */
router.use('/api/dify/webhook', validateApiKey);

/**
 * Health check endpoint
 */
router.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dify Token Consumption System is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/dify/webhook',
      'GET /api/user/points/estimate',
      'POST /api/user/points/check-balance',
      'POST /api/user/points/deduct',
      'GET /api/user/points/history'
    ]
  });
});

export default router;

/**
 * Example usage in main Express app:
 * 
 * import express from 'express';
 * import difyRoutes from './routes/dify-routes';
 * 
 * const app = express();
 * app.use(express.json());
 * app.use(difyRoutes);
 * 
 * app.listen(3000, () => {
 *   console.log('Server running on port 3000');
 * });
 */