/**
 * Token Monitoring Hook for Dify API Integration
 * 
 * Provides real-time token usage monitoring and billing integration
 * for native Dify API calls.
 */

import { useState, useCallback } from 'react';
import { DifyUsage } from '@/lib/dify-api-client';
import { db } from '@/lib/supabase';
import { authService } from '@/lib/auth';
import { toast } from 'sonner';

export interface TokenUsageEvent {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pointsDeducted: number;
  conversationId?: string;
  messageId?: string;
  timestamp: string;
}

export interface TokenMonitoringState {
  totalTokensUsed: number;
  totalCost: number;
  totalPointsDeducted: number;
  usageHistory: TokenUsageEvent[];
  isProcessing: boolean;
  error: string | null;
}

export interface UseTokenMonitoringReturn {
  state: TokenMonitoringState;
  processTokenUsage: (
    usage: DifyUsage,
    conversationId?: string,
    messageId?: string,
    modelName?: string
  ) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
  clearError: () => void;
  reset: () => void;
}

const INITIAL_STATE: TokenMonitoringState = {
  totalTokensUsed: 0,
  totalCost: 0,
  totalPointsDeducted: 0,
  usageHistory: [],
  isProcessing: false,
  error: null,
};

export function useTokenMonitoring(): UseTokenMonitoringReturn {
  const [state, setState] = useState<TokenMonitoringState>(INITIAL_STATE);

  const processTokenUsage = useCallback(async (
    usage: DifyUsage,
    conversationId?: string,
    messageId?: string,
    modelName: string = 'dify-native'
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Parse token usage
      const inputTokens = usage.prompt_tokens;
      const outputTokens = usage.completion_tokens;
      const totalTokens = usage.total_tokens;

      // Parse costs - try to use Dify-provided pricing first
      let inputCost = 0;
      let outputCost = 0;
      let totalCost = 0;

      if (usage.prompt_price && usage.completion_price) {
        inputCost = parseFloat(usage.prompt_price) || 0;
        outputCost = parseFloat(usage.completion_price) || 0;
        totalCost = parseFloat(usage.total_price || '') || (inputCost + outputCost);
      } else {
        // Fallback to model-based pricing
        const modelConfigs = await db.getModelConfigs();
        let modelConfig = modelConfigs.find(
          config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
        );

        if (!modelConfig) {
          // Auto-create model config if not found
          console.log(`Auto-creating model config for: ${modelName}`);
          try {
            // 使用当前用户ID，如果没有用户则使用null UUID
            const currentUser = await authService.getCurrentUser();
            const systemUserId = currentUser?.id || '00000000-0000-0000-0000-000000000000';
            
            modelConfig = await db.addModelConfig(
              modelName,
              0.002, // Default input price per 1000 tokens
              0.006, // Default output price per 1000 tokens
              systemUserId, // 使用有效的UUID
              'ai_model',
              undefined,
              true // auto-created
            );
          } catch (error) {
            console.error('Failed to auto-create model config:', error);
            // Use fallback pricing
            modelConfig = {
              id: `fallback-${modelName}`,
              modelName: modelName,
              inputTokenPrice: 0.002,
              outputTokenPrice: 0.006,
              serviceType: 'ai_model' as const,
              isActive: true,
              autoCreated: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'system'
            };
          }
        }

        // Calculate costs based on model pricing
        inputCost = (inputTokens / 1000) * modelConfig.inputTokenPrice;
        outputCost = (outputTokens / 1000) * modelConfig.outputTokenPrice;
        totalCost = inputCost + outputCost;
      }

      // Get current exchange rate
      const exchangeRate = await db.getCurrentExchangeRate();
      const pointsToDeduct = Math.round(totalCost * exchangeRate);

      // Validate costs
      if (totalCost <= 0 || pointsToDeduct <= 0) {
        console.warn('Invalid cost calculation:', { inputCost, outputCost, totalCost, pointsToDeduct });
        return { success: false, error: 'Invalid cost calculation' };
      }

      // Safety check to prevent excessive deduction
      if (pointsToDeduct > 100000) {
        console.error('Token cost too high, potential error:', {
          modelName,
          totalTokens,
          totalCost,
          pointsToDeduct
        });
        return { success: false, error: 'Token cost too high - please contact support' };
      }

      // Deduct balance
      const result = await db.deductUserBalance(
        user.id,
        pointsToDeduct,
        `Dify Native API usage: ${modelName} (${totalTokens} tokens, $${totalCost.toFixed(6)})`
      );

      if (!result.success) {
        setState(prev => ({ ...prev, isProcessing: false, error: result.message }));
        return { success: false, error: result.message };
      }

      // Record token usage
      try {
        await db.addTokenUsageWithModel(
          user.id,
          modelName,
          inputTokens,
          outputTokens,
          totalTokens,
          inputCost,
          outputCost,
          totalCost,
          conversationId,
          messageId
        );
      } catch (usageError) {
        console.error('Failed to record token usage:', usageError);
      }

      // Create usage event
      const usageEvent: TokenUsageEvent = {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        pointsDeducted: pointsToDeduct,
        conversationId,
        messageId,
        timestamp: new Date().toISOString()
      };

      // Update state
      setState(prev => ({
        ...prev,
        totalTokensUsed: prev.totalTokensUsed + totalTokens,
        totalCost: prev.totalCost + totalCost,
        totalPointsDeducted: prev.totalPointsDeducted + pointsToDeduct,
        usageHistory: [usageEvent, ...prev.usageHistory.slice(0, 49)], // Keep last 50 events
        isProcessing: false,
        error: null
      }));

      // Show success toast
      toast.success(
        `Token已消费: ${totalTokens} tokens (${pointsToDeduct} 积分)`,
        {
          description: `余额: ${result.newBalance} 积分`
        }
      );

      // Emit balance update event for global listeners
      window.dispatchEvent(new CustomEvent('balance-updated', {
        detail: { balance: result.newBalance, usage: usageEvent }
      }));

      return { success: true, newBalance: result.newBalance };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error processing token usage';
      console.error('Error processing token usage:', error);
      
      setState(prev => ({ ...prev, isProcessing: false, error: errorMessage }));
      
      toast.error('Token使用处理失败', {
        description: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    processTokenUsage,
    clearError,
    reset
  };
}

/**
 * Hook for estimating token costs before API calls
 */
export function useTokenCostEstimation() {
  const estimateCost = useCallback(async (
    inputTokens: number,
    outputTokens: number,
    modelName: string = 'dify-native'
  ): Promise<{
    inputCost: number;
    outputCost: number;
    totalCost: number;
    points: number;
    hasEnoughBalance: boolean;
    currentBalance: number;
  }> => {
    try {
      // Get model configuration
      const modelConfigs = await db.getModelConfigs();
      let modelConfig = modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        // Use default pricing
        modelConfig = {
          id: 'default',
          modelName: modelName,
          inputTokenPrice: 0.002,
          outputTokenPrice: 0.006,
          serviceType: 'ai_model' as const,
          isActive: true,
          autoCreated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        };
      }

      // Calculate costs
      const inputCost = (inputTokens / 1000) * modelConfig.inputTokenPrice;
      const outputCost = (outputTokens / 1000) * modelConfig.outputTokenPrice;
      const totalCost = inputCost + outputCost;

      // Get exchange rate and convert to points
      const exchangeRate = await db.getCurrentExchangeRate();
      const points = Math.round(totalCost * exchangeRate);

      // Check user balance
      const user = await authService.getCurrentUser();
      const currentBalance = user?.balance || 0;
      const hasEnoughBalance = currentBalance >= points;

      return {
        inputCost,
        outputCost,
        totalCost,
        points,
        hasEnoughBalance,
        currentBalance
      };
    } catch (error) {
      console.error('Error estimating token cost:', error);
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        points: 0,
        hasEnoughBalance: false,
        currentBalance: 0
      };
    }
  }, []);

  return { estimateCost };
}