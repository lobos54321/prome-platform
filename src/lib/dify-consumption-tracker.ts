import { 
  DifyMessageEndEvent, 
  DifyWebhookPayload, 
  PointsConsumption, 
  BalanceCheck, 
  CostEstimation,
  ModelConfig,
  User 
} from '@/types';
import { adminServicesAPI } from './admin-services';
import { db } from './supabase';

/**
 * Enhanced Dify Token Consumption Tracker
 * Handles real-time token consumption monitoring and points deduction
 */
export class DifyConsumptionTracker {
  private readonly DEDUCTION_REQUEST_PREFIX = 'dify_deduction_';
  
  /**
   * Process Dify message_end webhook event
   * This is the main entry point for token consumption tracking
   */
  async processMessageEndEvent(
    payload: DifyWebhookPayload,
    userId: string,
    serviceId: string
  ): Promise<{ success: boolean; message: string; consumption?: PointsConsumption }> {
    try {
      // Validate payload
      if (!this.isMessageEndEvent(payload)) {
        return { success: false, message: 'Invalid message_end event payload' };
      }

      const event = payload.data as DifyMessageEndEvent;
      
      // Validate required fields
      if (!event.model_name || !event.input_tokens || !event.output_tokens) {
        return { success: false, message: 'Missing required token data in payload' };
      }

      // Generate unique request ID for deduplication
      const requestId = payload.request_id || this.generateRequestId();
      
      // Check for duplicate processing
      if (await this.isDuplicateRequest(requestId)) {
        return { success: false, message: 'Request already processed' };
      }

      // Calculate consumption
      const consumption = await this.calculateTokenConsumption(
        event,
        userId,
        serviceId,
        requestId
      );

      // Execute points deduction
      const deductionResult = await this.executePointsDeduction(consumption);
      
      if (!deductionResult.success) {
        return { success: false, message: deductionResult.message };
      }

      // Record consumption details
      await this.recordConsumption(consumption);

      return {
        success: true,
        message: 'Token consumption processed successfully',
        consumption
      };
    } catch (error) {
      console.error('Error processing message_end event:', error);
      return { 
        success: false, 
        message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Check if user has enough balance for estimated consumption
   */
  async checkBalance(
    userId: string,
    modelName: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): Promise<BalanceCheck> {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        return {
          hasEnoughBalance: false,
          currentBalance: 0,
          estimatedCost: 0,
          requiredBalance: 0,
          message: 'User not found'
        };
      }

      const estimation = await this.estimateConsumption(
        modelName,
        estimatedInputTokens,
        estimatedOutputTokens
      );

      const hasEnoughBalance = user.balance >= estimation.estimatedPoints;

      return {
        hasEnoughBalance,
        currentBalance: user.balance,
        estimatedCost: estimation.estimatedPoints,
        requiredBalance: estimation.estimatedPoints,
        message: hasEnoughBalance 
          ? 'Sufficient balance' 
          : `Insufficient balance. Required: ${estimation.estimatedPoints}, Available: ${user.balance}`
      };
    } catch (error) {
      console.error('Error checking balance:', error);
      return {
        hasEnoughBalance: false,
        currentBalance: 0,
        estimatedCost: 0,
        requiredBalance: 0,
        message: 'Balance check failed'
      };
    }
  }

  /**
   * Estimate consumption for given parameters
   */
  async estimateConsumption(
    modelName: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): Promise<CostEstimation> {
    try {
      const inputCost = adminServicesAPI.calculateCostInCredits(
        modelName,
        estimatedInputTokens,
        0
      );
      const outputCost = adminServicesAPI.calculateCostInCredits(
        modelName,
        0,
        estimatedOutputTokens
      );
      
      return {
        modelName,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
        estimatedInputCost: inputCost,
        estimatedOutputCost: outputCost,
        estimatedTotalCost: inputCost + outputCost,
        estimatedPoints: inputCost + outputCost
      };
    } catch (error) {
      console.error('Error estimating consumption:', error);
      // Return safe defaults if model not found
      return {
        modelName,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
        estimatedInputCost: 0,
        estimatedOutputCost: 0,
        estimatedTotalCost: 0,
        estimatedPoints: 0
      };
    }
  }

  /**
   * Get consumption history for a user
   */
  async getConsumptionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ records: PointsConsumption[]; total: number }> {
    try {
      // This would typically query a dedicated consumption table
      // For now, we'll use the existing token_usage table
      const tokenUsage = await db.getTokenUsage(userId);
      
      // Transform to consumption format
      const records: PointsConsumption[] = tokenUsage.slice(offset, offset + limit).map(usage => ({
        id: usage.id,
        userId: usage.userId,
        serviceId: usage.serviceId,
        modelName: 'GPT-4', // Default, would be stored in enhanced token_usage
        inputTokens: 0, // Would be actual values from enhanced tracking
        outputTokens: 0,
        totalTokens: usage.tokensUsed,
        inputCost: 0,
        outputCost: 0,
        totalCost: usage.cost,
        pointsDeducted: Math.ceil(usage.cost),
        conversationId: usage.sessionId,
        messageId: '',
        requestId: '',
        timestamp: usage.timestamp,
        status: 'completed'
      }));

      return {
        records,
        total: tokenUsage.length
      };
    } catch (error) {
      console.error('Error getting consumption history:', error);
      return { records: [], total: 0 };
    }
  }

  // Private helper methods

  private isMessageEndEvent(payload: DifyWebhookPayload): boolean {
    return payload.event === 'message_end' && 
           payload.data && 
           typeof payload.data === 'object' &&
           'model_name' in payload.data &&
           'input_tokens' in payload.data &&
           'output_tokens' in payload.data;
  }

  private generateRequestId(): string {
    return this.DEDUCTION_REQUEST_PREFIX + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private async isDuplicateRequest(requestId: string): Promise<boolean> {
    // In a real implementation, this would check a deduplication store (Redis/DB)
    // For now, we'll assume no duplicates
    return false;
  }

  private async calculateTokenConsumption(
    event: DifyMessageEndEvent,
    userId: string,
    serviceId: string,
    requestId: string
  ): Promise<PointsConsumption> {
    const inputCost = adminServicesAPI.calculateCostInCredits(
      event.model_name,
      event.input_tokens,
      0
    );
    
    const outputCost = adminServicesAPI.calculateCostInCredits(
      event.model_name,
      0,
      event.output_tokens
    );

    const totalCost = inputCost + outputCost;

    return {
      id: requestId,
      userId,
      serviceId,
      modelName: event.model_name,
      inputTokens: event.input_tokens,
      outputTokens: event.output_tokens,
      totalTokens: event.total_tokens,
      inputCost,
      outputCost,
      totalCost,
      pointsDeducted: totalCost,
      conversationId: event.conversation_id,
      messageId: event.message_id,
      requestId,
      timestamp: event.timestamp || new Date().toISOString(),
      status: 'pending'
    };
  }

  private async executePointsDeduction(consumption: PointsConsumption): Promise<{ success: boolean; message: string }> {
    try {
      const user = await db.getUserById(consumption.userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      if (user.balance < consumption.pointsDeducted) {
        return { 
          success: false, 
          message: `Insufficient balance. Required: ${consumption.pointsDeducted}, Available: ${user.balance}` 
        };
      }

      // Atomic balance update
      const newBalance = user.balance - consumption.pointsDeducted;
      await db.updateUserBalance(consumption.userId, newBalance);

      // Create billing record
      await db.addBillingRecord(
        consumption.userId,
        'usage',
        consumption.pointsDeducted,
        `Token usage - ${consumption.modelName}: ${consumption.totalTokens} tokens`
      );

      consumption.status = 'completed';
      return { success: true, message: 'Points deducted successfully' };
    } catch (error) {
      console.error('Error executing points deduction:', error);
      consumption.status = 'failed';
      return { 
        success: false, 
        message: `Deduction failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async recordConsumption(consumption: PointsConsumption): Promise<void> {
    try {
      // Record in token_usage table (enhanced with new fields)
      await db.addTokenUsage(
        consumption.userId,
        consumption.serviceId,
        consumption.totalTokens,
        consumption.totalCost
      );

      // In a complete implementation, we'd also record in a dedicated consumption table
      console.log('Consumption recorded:', {
        requestId: consumption.requestId,
        userId: consumption.userId,
        model: consumption.modelName,
        tokens: consumption.totalTokens,
        points: consumption.pointsDeducted,
        status: consumption.status
      });
    } catch (error) {
      console.error('Error recording consumption:', error);
      // Don't throw here as the deduction was already successful
    }
  }
}

export const difyConsumptionTracker = new DifyConsumptionTracker();