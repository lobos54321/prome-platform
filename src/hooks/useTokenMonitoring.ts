/**
 * Token Monitoring Hook for Dify API Integration
 * 
 * Provides real-time token usage monitoring and billing integration
 * for native Dify API calls.
 */

import { useState, useCallback } from 'react';
import { DifyUsage } from '@/lib/dify-api-client';
import { db } from '@/lib/supabase';
import { ModelConfig } from '@/types';
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

  // 智能模型匹配函数 - 支持模糊匹配和别名
  const findBestModelMatch = useCallback((modelConfigs: ModelConfig[], targetModelName: string): ModelConfig | null => {
    const target = targetModelName.toLowerCase().trim();
    
    // 1. 精确匹配
    let match = modelConfigs.find(config => 
      config.isActive && config.modelName.toLowerCase() === target
    );
    if (match) {
      console.log(`[Model Match] Exact match found: ${target} -> ${match.modelName}`);
      return match;
    }

    // 2. 部分匹配 - 检查包含关系
    match = modelConfigs.find(config => 
      config.isActive && (
        config.modelName.toLowerCase().includes(target) ||
        target.includes(config.modelName.toLowerCase())
      )
    );
    if (match) {
      console.log(`[Model Match] Partial match found: ${target} -> ${match.modelName}`);
      return match;
    }

    // 3. 模型系列匹配
    const modelFamilies = {
      'gpt-4': ['gpt4', 'gpt-4-turbo', 'gpt-4-preview', 'gpt-4o'],
      'gpt-3.5-turbo': ['gpt35', 'gpt-3.5', 'gpt35turbo', 'chatgpt'],
      'claude-3-sonnet': ['claude-sonnet', 'claude3-sonnet', 'claude3sonnet', 'sonnet'],
      'claude-3-haiku': ['claude-haiku', 'claude3-haiku', 'claude3haiku', 'haiku'],
      'gemini-pro': ['gemini', 'bard', 'palm']
    };

    for (const [baseModel, aliases] of Object.entries(modelFamilies)) {
      if (aliases.some(alias => target.includes(alias) || alias.includes(target))) {
        match = modelConfigs.find(config => 
          config.isActive && config.modelName.toLowerCase().includes(baseModel)
        );
        if (match) {
          console.log(`[Model Match] Family match found: ${target} -> ${match.modelName} (via ${baseModel})`);
          return match;
        }
      }
    }

    console.log(`[Model Match] No match found for: ${target}`);
    return null;
  }, []);

  // 🚀 自动创建模型配置函数 - 从Dify价格自动生成25%利润配置
  const autoCreateModelConfig = useCallback(async (
    modelName: string,
    difyInputPrice: number, // Dify原价 per 1K tokens
    difyOutputPrice: number // Dify原价 per 1K tokens
  ) => {
    try {
      // 计算25%利润的价格
      const profitInputPrice = difyInputPrice * 1.25;
      const profitOutputPrice = difyOutputPrice * 1.25;

      const newModelConfig = {
        modelName: modelName,
        inputTokenPrice: profitInputPrice,
        outputTokenPrice: profitOutputPrice,
        serviceType: 'dify',
        isActive: true,
        autoCreated: true, // 标记为自动创建
        createdBy: 'system-auto-extraction'
      };

      console.log('[Auto Model] Creating new model config:', newModelConfig);

      // 尝试添加到数据库
      await db.addModelConfig(newModelConfig);
      
      console.log('✅ [Auto Model] Successfully auto-created model config:', {
        model: modelName,
        difyInput: difyInputPrice,
        difyOutput: difyOutputPrice,
        profitInput: profitInputPrice,
        profitOutput: profitOutputPrice,
        profitMargin: '25%'
      });

      // 通知用户新模型已自动添加
      toast.success(`新模型已自动添加`, {
        description: `${modelName} 已添加到管理页面，包含25%利润空间`,
        duration: 5000,
      });

      return newModelConfig;
    } catch (error) {
      console.error('[Auto Model] Failed to auto-create model config:', error);
      
      // 如果数据库添加失败，至少记录信息供后续手动处理
      console.warn('[Auto Model] Model will be processed with calculated profit pricing despite DB error');
      
      return null;
    }
  }, []);

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

      // 🎯 优先使用平台配置的价格（确保利润空间）
      const modelConfigs = await db.getModelConfigs();
      let modelConfig = findBestModelMatch(modelConfigs, modelName);
      
      if (modelConfig) {
        // 使用平台配置的价格 - 包含利润空间
        inputCost = (inputTokens / 1000) * modelConfig.inputTokenPrice;
        outputCost = (outputTokens / 1000) * modelConfig.outputTokenPrice;
        totalCost = inputCost + outputCost;
        
        console.log('[Token] Using platform pricing with profit margin:', { 
          model: modelConfig.modelName,
          inputCost, 
          outputCost, 
          totalCost,
          inputPrice: modelConfig.inputTokenPrice,
          outputPrice: modelConfig.outputTokenPrice
        });
      } else if (usage.total_price || usage.prompt_price || usage.completion_price) {
        // 🚀 自动提取Dify价格并创建新模型配置（加25%利润）
        const difyInputPrice = parseFloat(usage.prompt_price?.toString() || '0') || 0;
        const difyOutputPrice = parseFloat(usage.completion_price?.toString() || '0') || 0;
        
        console.log('[Auto Model] Detected new model from Dify:', {
          modelName,
          difyInputPrice: difyInputPrice * 1000, // per 1K tokens
          difyOutputPrice: difyOutputPrice * 1000
        });
        
        // 自动创建包含25%利润的模型配置
        await autoCreateModelConfig(modelName, difyInputPrice * 1000, difyOutputPrice * 1000);
        
        // 使用带利润的价格计算成本
        const profitInputPrice = difyInputPrice * 1000 * 1.25; // 25%利润
        const profitOutputPrice = difyOutputPrice * 1000 * 1.25; // 25%利润
        
        inputCost = (inputTokens / 1000) * profitInputPrice;
        outputCost = (outputTokens / 1000) * profitOutputPrice;
        totalCost = inputCost + outputCost;
        
        console.log('[Auto Model] Using auto-created pricing with 25% profit:', { 
          difyInputPrice: difyInputPrice * 1000,
          difyOutputPrice: difyOutputPrice * 1000,
          profitInputPrice,
          profitOutputPrice,
          inputCost, 
          outputCost, 
          totalCost 
        });
      } else {
        // 最后的fallback

        if (!modelConfig) {
          console.log(`Model config not found for: ${modelName}, using fallback`);
        }
        
        // 如果数据库创建失败，使用fallback config确保token处理继续
        if (!modelConfig) {
          console.log('Using fallback model config for token processing');
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
      // Get model configuration with improved matching
      const modelConfigs = await db.getModelConfigs();
      let modelConfig = findBestModelMatch(modelConfigs, modelName);

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