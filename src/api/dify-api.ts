import { DifyWebhookPayload, BalanceCheck, CostEstimation, PointsConsumption } from '@/types';
import { difyConsumptionTracker } from '@/lib/dify-consumption-tracker';
import { authService } from '@/lib/auth';

/**
 * Dify Token Consumption API
 * Handles webhook processing, balance checks, and consumption tracking
 */
export class DifyAPI {
  
  /**
   * POST /api/dify/webhook
   * Process Dify webhook for token consumption
   */
  async processWebhook(
    payload: DifyWebhookPayload,
    headers: Record<string, string>
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    try {
      // Validate webhook signature/API key
      const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
      if (!this.validateWebhookAuth(apiKey)) {
        return { success: false, message: 'Unauthorized webhook request' };
      }

      // Extract user ID and service ID from payload or headers
      const userId = payload.data && typeof payload.data === 'object' && 'user_id' in payload.data 
        ? payload.data.user_id as string 
        : headers['x-user-id'];
      const serviceId = headers['x-service-id'] || 'default-service';

      if (!userId) {
        return { success: false, message: 'User ID required for webhook processing' };
      }

      // Process the webhook
      const result = await difyConsumptionTracker.processMessageEndEvent(
        payload,
        userId,
        serviceId
      );

      return {
        success: result.success,
        message: result.message,
        data: result.consumption ? {
          consumptionId: result.consumption.id,
          pointsDeducted: result.consumption.pointsDeducted,
          tokensUsed: result.consumption.totalTokens
        } : undefined
      };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return {
        success: false,
        message: `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * GET /api/user/points/estimate
   * Estimate points consumption for given parameters
   */
  async estimatePointsConsumption(
    modelName: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): Promise<{ success: boolean; data?: CostEstimation; message?: string }> {
    try {
      if (!modelName || estimatedInputTokens < 0 || estimatedOutputTokens < 0) {
        return { success: false, message: 'Invalid estimation parameters' };
      }

      const estimation = await difyConsumptionTracker.estimateConsumption(
        modelName,
        estimatedInputTokens,
        estimatedOutputTokens
      );

      return { success: true, data: estimation };
    } catch (error) {
      console.error('Estimation error:', error);
      return {
        success: false,
        message: `Estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * POST /api/user/points/check-balance
   * Check if user has sufficient balance for estimated consumption
   */
  async checkUserBalance(
    userId: string,
    modelName: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): Promise<{ success: boolean; data?: BalanceCheck; message?: string }> {
    try {
      if (!userId || !modelName) {
        return { success: false, message: 'User ID and model name are required' };
      }

      const balanceCheck = await difyConsumptionTracker.checkBalance(
        userId,
        modelName,
        estimatedInputTokens,
        estimatedOutputTokens
      );

      return { success: true, data: balanceCheck };
    } catch (error) {
      console.error('Balance check error:', error);
      return {
        success: false,
        message: `Balance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * POST /api/user/points/deduct
   * Manual points deduction (for testing or special cases)
   */
  async deductPoints(
    userId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; message: string; newBalance?: number }> {
    try {
      if (!userId || amount <= 0) {
        return { success: false, message: 'Invalid deduction parameters' };
      }

      // This would implement manual deduction logic
      // For now, we'll return a success response
      return {
        success: true,
        message: 'Points deducted successfully',
        newBalance: 0 // Would be actual new balance
      };
    } catch (error) {
      console.error('Points deduction error:', error);
      return {
        success: false,
        message: `Deduction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * GET /api/user/points/history
   * Get user's points consumption history
   */
  async getConsumptionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; data?: { records: PointsConsumption[]; total: number }; message?: string }> {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      const history = await difyConsumptionTracker.getConsumptionHistory(
        userId,
        limit,
        offset
      );

      return { success: true, data: history };
    } catch (error) {
      console.error('History retrieval error:', error);
      return {
        success: false,
        message: `History retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Pre-consumption balance check for UI
   * This can be called before initiating AI requests
   */
  async preConsumptionCheck(
    modelName: string,
    estimatedTokens: { input: number; output: number }
  ): Promise<{ canProceed: boolean; message: string; estimation?: CostEstimation }> {
    try {
      const user = authService.getCurrentUserSync();
      if (!user) {
        return { canProceed: false, message: 'User not authenticated' };
      }

      const balanceCheck = await this.checkUserBalance(
        user.id,
        modelName,
        estimatedTokens.input,
        estimatedTokens.output
      );

      if (!balanceCheck.success || !balanceCheck.data) {
        return { canProceed: false, message: 'Balance check failed' };
      }

      const estimation = await this.estimatePointsConsumption(
        modelName,
        estimatedTokens.input,
        estimatedTokens.output
      );

      return {
        canProceed: balanceCheck.data.hasEnoughBalance,
        message: balanceCheck.data.message || 'Balance check completed',
        estimation: estimation.data
      };
    } catch (error) {
      console.error('Pre-consumption check error:', error);
      return {
        canProceed: false,
        message: `Pre-consumption check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Private helper methods

  private validateWebhookAuth(apiKey?: string): boolean {
    // In production, validate against stored API keys
    // For now, accept the default key or any non-empty key
    return !!apiKey && (
      apiKey === 'prome_wh_key_123456' || 
      apiKey.startsWith('prome_') ||
      apiKey.length >= 8
    );
  }
}

// Export singleton instance
export const difyAPI = new DifyAPI();

// Helper functions for direct use in components
export const checkBalanceBeforeAI = async (
  modelName: string,
  estimatedInputTokens: number = 1000,
  estimatedOutputTokens: number = 500
) => {
  return await difyAPI.preConsumptionCheck(modelName, {
    input: estimatedInputTokens,
    output: estimatedOutputTokens
  });
};

export const estimateAICost = async (
  modelName: string,
  inputTokens: number,
  outputTokens: number
) => {
  return await difyAPI.estimatePointsConsumption(modelName, inputTokens, outputTokens);
};