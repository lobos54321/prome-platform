/**
 * Token Monitoring Hook for Dify API Integration
 * 
 * Provides real-time token usage monitoring and billing integration
 * for native Dify API calls.
 */

import { useState, useCallback, useEffect } from 'react';
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
  const [currentProfitMargin, setCurrentProfitMargin] = useState(25); // 默认25%

  // 监听利润比例变化事件
  useEffect(() => {
    // 初始化时从localStorage加载利润比例
    const savedMargin = localStorage.getItem('profit_margin');
    if (savedMargin) {
      const margin = parseInt(savedMargin);
      setCurrentProfitMargin(margin);
    }

    // 监听利润比例更新事件
    const handleProfitMarginUpdate = (event: CustomEvent) => {
      const newMargin = event.detail.margin;
      setCurrentProfitMargin(newMargin);
      console.log(`[Billing] Profit margin updated to ${newMargin}%`);
    };

    window.addEventListener('profit-margin-updated', handleProfitMarginUpdate as EventListener);

    return () => {
      window.removeEventListener('profit-margin-updated', handleProfitMarginUpdate as EventListener);
    };
  }, []);

  // 智能模型匹配函数 - 优先级：手动设置 > 自动创建 > 无匹配
  const findBestModelMatch = useCallback((modelConfigs: ModelConfig[], targetModelName: string): ModelConfig | null => {
    const target = targetModelName.toLowerCase().trim();
    
    // 🥇 第一优先级：手动设置的精确匹配 (autoCreated: false)
    let match = modelConfigs.find(config => 
      config.isActive && 
      !config.autoCreated && // 手动设置
      config.modelName.toLowerCase() === target
    );
    if (match) {
      console.log(`[Model Match] 🥇 Manual exact match (highest priority): ${target} -> ${match.modelName}`);
      return match;
    }

    // 🥇 第二优先级：手动设置的部分匹配 (autoCreated: false)
    match = modelConfigs.find(config => 
      config.isActive && 
      !config.autoCreated && // 手动设置
      (config.modelName.toLowerCase().includes(target) ||
       target.includes(config.modelName.toLowerCase()))
    );
    if (match) {
      console.log(`[Model Match] 🥇 Manual partial match (high priority): ${target} -> ${match.modelName}`);
      return match;
    }

    // 🥈 第三优先级：自动创建的精确匹配
    match = modelConfigs.find(config => 
      config.isActive && 
      config.autoCreated && // 自动创建
      config.modelName.toLowerCase() === target
    );
    if (match) {
      console.log(`[Model Match] 🥈 Auto-created exact match: ${target} -> ${match.modelName}`);
      return match;
    }

    // 🥈 第四优先级：自动创建的部分匹配
    match = modelConfigs.find(config => 
      config.isActive && 
      config.autoCreated && // 自动创建
      (config.modelName.toLowerCase().includes(target) ||
       target.includes(config.modelName.toLowerCase()))
    );
    if (match) {
      console.log(`[Model Match] 🥈 Auto-created partial match: ${target} -> ${match.modelName}`);
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

  // 🎯 获取默认模型价格 - 基于市场常见定价
  const getDefaultModelPricing = useCallback((modelName: string) => {
    const model = modelName.toLowerCase();
    
    // 基于模型名称返回合理的默认价格 (USD per 1K tokens)
    if (model.includes('gpt-4o') || model.includes('gpt4o')) {
      return { input: 5.0, output: 15.0 }; // GPT-4o
    } else if (model.includes('gpt-4') || model.includes('gpt4')) {
      return { input: 30.0, output: 60.0 }; // GPT-4
    } else if (model.includes('gpt-3.5') || model.includes('gpt35')) {
      return { input: 0.5, output: 1.5 }; // GPT-3.5
    } else if (model.includes('claude-3') || model.includes('claude3')) {
      if (model.includes('opus')) {
        return { input: 15.0, output: 75.0 }; // Claude-3 Opus
      } else if (model.includes('sonnet')) {
        return { input: 3.0, output: 15.0 }; // Claude-3 Sonnet
      } else if (model.includes('haiku')) {
        return { input: 0.25, output: 1.25 }; // Claude-3 Haiku
      }
      return { input: 3.0, output: 15.0 }; // Claude-3 默认 (Sonnet)
    } else if (model.includes('gemini')) {
      return { input: 0.5, output: 1.5 }; // Gemini Pro
    } else if (model.includes('llama')) {
      return { input: 0.2, output: 0.2 }; // Llama系列
    } else {
      // 通用默认价格 - 中等定价
      return { input: 2.0, output: 6.0 };
    }
  }, []);

  // 🚀 自动创建模型配置函数 - 从Dify价格自动生成25%利润配置
  const autoCreateModelConfig = useCallback(async (
    modelName: string,
    difyInputPrice: number, // Dify原价 per 1K tokens
    difyOutputPrice: number // Dify原价 per 1K tokens
  ) => {
    try {
      // 计算动态利润比例的价格
      const profitMultiplier = 1 + (currentProfitMargin / 100);
      const profitInputPrice = difyInputPrice * profitMultiplier;
      const profitOutputPrice = difyOutputPrice * profitMultiplier;

      console.log(`[Auto Model] Creating new model config with ${currentProfitMargin}% profit margin`);

      // 获取当前用户作为创建者
      const currentUser = await authService.getCurrentUser();
      const adminId = currentUser?.id || 'system'; // 使用当前用户ID或fallback
      
      // 尝试添加到数据库 - 使用正确的参数
      const newModelConfig = await db.addModelConfig(
        modelName,                    // modelName
        profitInputPrice,            // inputTokenPrice  
        profitOutputPrice,           // outputTokenPrice
        adminId,                     // adminId (使用真实用户ID)
        'ai_model',                  // serviceType
        undefined,                   // workflowCost
        true                         // autoCreated
      );
      
      if (newModelConfig) {
        console.log('✅ [Auto Model] Successfully auto-created model config:', {
          model: modelName,
          difyInput: difyInputPrice,
          difyOutput: difyOutputPrice,
          profitInput: profitInputPrice,
          profitOutput: profitOutputPrice,
          profitMargin: `${currentProfitMargin}%`
        });
      } else {
        console.log('⚠️ [Auto Model] Model config already existed or creation failed');
      }

      // 静默添加，不通知用户（后台自动管理）

      return newModelConfig;
    } catch (error) {
      console.error('[Auto Model] Failed to auto-create model config:', error);
      
      // 如果数据库添加失败，至少记录信息供后续手动处理
      console.warn('[Auto Model] Model will be processed with calculated profit pricing despite DB error');
      
      return null;
    }
  }, [currentProfitMargin]);

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
      
      // 🚨 调试：检查异常高的Token使用量
      if (totalTokens > 10000) {
        console.error('🚨 异常高的Token使用量检测 - 详细分析:', {
          modelName,
          inputTokens,
          outputTokens,  
          finalTotalTokens,
          usage_raw_keys: Object.keys(usage),
          usage_raw: usage,
          conversationId,
          messageId,
          possibleIssues: [
            totalTokens > 50000 ? '可能是累积Token而非单次使用' : null,
            inputTokens === 0 ? '输入Token为0异常' : null,
            outputTokens === 0 ? '输出Token为0异常' : null,
            totalTokens !== (inputTokens + outputTokens) ? 'Token总数计算不匹配' : null
          ].filter(Boolean),
          timestamp: new Date().toISOString()
        });
        
        // ✅ 不再人为限制Token数量 - 如果真实使用了这么多Token，就应该正确计费
        console.log('📝 Token使用量分析:', {
          是否为工作流: modelName.includes('workflow') || modelName.includes('chatflow'),
          可能的原因: [
            '长对话上下文',
            '复杂工作流处理', 
            '大量数据分析',
            'Dify API返回累积用量'
          ],
          建议: '检查Dify API响应格式和工作流配置'
        });
      }

      // ✅ 使用原始真实的Token数量（不做人为调整）
      const finalInputTokens = inputTokens;
      const finalOutputTokens = outputTokens;
      const finalTotalTokens = totalTokens;

      // 💰 核心计费逻辑：基于Dify返回的usage信息+25%利润
      let inputCost = 0;
      let outputCost = 0;
      let totalCost = 0;

      // 🔍 检查 Dify usage 数据格式
      console.log('[Billing] Dify usage data:', {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        promptPrice: usage.prompt_price,
        completionPrice: usage.completion_price,
        totalPrice: usage.total_price,
        currency: usage.currency,
        extractedFromHeaders: usage.extractedFromHeaders,
        dataSource: usage.dataSource,
        modelName: modelName
      });

      // 动态利润比例计算
      const profitMultiplier = 1 + (currentProfitMargin / 100);

      // 🎯 最高优先级：处理混合数据源（响应头准确token + 响应体价格）
      if (usage.dataSource === 'combined_headers_and_body' && usage.total_price) {
        const difyTotalCost = parseFloat(usage.total_price.toString());
        totalCost = difyTotalCost * profitMultiplier; // 加动态利润
        
        console.log(`[Billing] ✅ Using BEST data source (combined headers + body pricing) with ${currentProfitMargin}% profit`);
      }
      // 🎯 使用Dify的total_price + 动态利润（标准方案）
      else if (usage.total_price) {
        const difyTotalCost = parseFloat(usage.total_price.toString());
        totalCost = difyTotalCost * profitMultiplier; // 加动态利润
        
        console.log(`[Billing] ✅ Using real Dify pricing with ${currentProfitMargin}% profit margin applied`);
        
        // 🏦 保存价格信息到数据库用于审计和分析（不影响计费流程）
        try {
          const modelConfigs = await db.getModelConfigs();
          let modelConfig = findBestModelMatch(modelConfigs, modelName);
          
          // 如果模型不存在，自动创建记录（仅用于审计）
          if (!modelConfig && usage.prompt_price && usage.completion_price) {
            // 计算每1K tokens的价格（用于数据库存储格式）
            const promptPricePer1K = (parseFloat(usage.prompt_price.toString()) / usage.prompt_tokens) * 1000;
            const completionPricePer1K = (parseFloat(usage.completion_price.toString()) / usage.completion_tokens) * 1000;
            
            await autoCreateModelConfig(modelName, promptPricePer1K, completionPricePer1K);
            console.log('[Billing] Auto-created model record for audit:', {
              modelName,
              promptPricePer1K,
              completionPricePer1K,
              originalUsage: {
                promptPrice: usage.prompt_price,
                completionPrice: usage.completion_price,
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens
              }
            });
          }
        } catch (auditError) {
          console.warn('[Billing] Failed to save audit record (not affecting billing):', auditError);
        }
      } 
      // 🚨 Fallback: 如果没有total_price，尝试使用分开的价格
      else if (usage.prompt_price && usage.completion_price) {
        const difyInputCost = parseFloat(usage.prompt_price.toString());
        const difyOutputCost = parseFloat(usage.completion_price.toString());
        
        inputCost = difyInputCost * profitMultiplier; // 加动态利润
        outputCost = difyOutputCost * profitMultiplier; // 加动态利润
        totalCost = inputCost + outputCost;
        
        console.log(`[Billing] Using Dify separate pricing with ${currentProfitMargin}% profit margin applied`);
      } 
      // 🎯 特殊处理：从服务器响应头提取的真实token数据（没有价格信息）
      else if (usage.extractedFromHeaders) {
        console.log(`[Billing] ✅ Using real token data from server headers + default pricing with ${currentProfitMargin}% profit`);
        
        // 尝试获取模型配置以使用准确的定价
        try {
          const modelConfigs = await db.getModelConfigs();
          let modelConfig = findBestModelMatch(modelConfigs, modelName);
          
          if (modelConfig) {
            // 使用配置的价格（需要应用当前利润比例）
            inputCost = (finalInputTokens / 1000) * modelConfig.inputTokenPrice;
            outputCost = (finalOutputTokens / 1000) * modelConfig.outputTokenPrice;
            totalCost = inputCost + outputCost;
            
            console.log(`[Billing] Using model config pricing with ${currentProfitMargin}% profit margin`);
          } else {
            // 使用默认定价 + 动态利润
            const defaultPricing = getDefaultModelPricing(modelName);
            const profitInputPrice = defaultPricing.input * profitMultiplier / 1000; // Convert to per-token and add profit
            const profitOutputPrice = defaultPricing.output * profitMultiplier / 1000;
            
            inputCost = finalInputTokens * profitInputPrice;
            outputCost = finalOutputTokens * profitOutputPrice;
            totalCost = inputCost + outputCost;
            
            console.log(`[Billing] Using default pricing with ${currentProfitMargin}% profit margin applied`);
          }
        } catch (error) {
          console.warn('[Billing] Error getting model pricing, using conservative fallback:', error);
          // 最后的备用方案
          const fallbackInputPrice = 0.002 * profitMultiplier; // $0.002 + 动态利润
          const fallbackOutputPrice = 0.006 * profitMultiplier; // $0.006 + 动态利润
          
          inputCost = (finalInputTokens / 1000) * fallbackInputPrice;
          outputCost = (finalOutputTokens / 1000) * fallbackOutputPrice;
          totalCost = inputCost + outputCost;
        }
      } else {
        // 🚨 Fallback: 如果Dify没有返回价格信息，使用估算价格 + 动态利润
        console.warn(`[Billing] No Dify pricing found, using fallback estimation + ${currentProfitMargin}% profit`);
        
        // 使用保守的估算价格（包含动态利润）
        const fallbackInputPrice = 0.002 * profitMultiplier; // $0.002 + 动态利润
        const fallbackOutputPrice = 0.006 * profitMultiplier; // $0.006 + 动态利润
        
        inputCost = (finalInputTokens / 1000) * fallbackInputPrice;
        outputCost = (finalOutputTokens / 1000) * fallbackOutputPrice;
        totalCost = inputCost + outputCost;
        
        console.log(`[Billing] Using fallback pricing with ${currentProfitMargin}% profit margin applied`);
        
        // 记录到数据库用于后续分析（不影响当前计费）
        try {
          await autoCreateModelConfig(modelName, fallbackInputPrice * 1000, fallbackOutputPrice * 1000);
          console.log(`[Billing] Created fallback model record with ${currentProfitMargin}% profit for future reference`);
        } catch (auditError) {
          console.warn('[Billing] Failed to save fallback record:', auditError);
        }
      }

      // Get current exchange rate
      const exchangeRate = await db.getCurrentExchangeRate();
      const pointsToDeduct = Math.round(totalCost * exchangeRate);

      // Validate costs
      if (totalCost <= 0 || pointsToDeduct <= 0) {
        console.warn('Invalid cost calculation:', { inputCost, outputCost, totalCost, pointsToDeduct });
        return { success: false, error: 'Invalid cost calculation' };
      }

      // ✅ 高成本警告但允许正常计费 - 真实使用就应该正确收费
      if (pointsToDeduct > 200000) { // 20万积分 ≈ $20 USD
        console.warn('💰 高Token成本详细分析:', {
          modelName,
          token_usage: {
            input: finalInputTokens,
            output: finalOutputTokens,
            total: finalTotalTokens
          },
          cost_breakdown: {
            inputCost: `$${inputCost.toFixed(4)}`,
            outputCost: `$${outputCost.toFixed(4)}`,
            totalCost: `$${totalCost.toFixed(4)}`,
            pointsToDeduct,
            exchangeRate
          },
          model_info: modelConfig ? {
            name: modelConfig.modelName,
            inputPrice: `$${modelConfig.inputTokenPrice}/1K`,
            outputPrice: `$${modelConfig.outputTokenPrice}/1K`,
            source: modelConfig.autoCreated ? 'auto_created' : 'manual_config'
          } : 'default_pricing',
          analysis: {
            avg_cost_per_token: `$${(totalCost / finalTotalTokens).toFixed(6)}`,
            is_workflow: modelName.includes('workflow') || modelName.includes('chatflow'),
            suggestion: finalTotalTokens > 50000 ? '检查工作流设置和上下文管理' : '正常高使用量'
          },
          conversationId,
          messageId,
          timestamp: new Date().toISOString()
        });
        
        // 💡 只记录警告，但允许继续正常扣费
        console.log('✅ 继续正常Token计费 - 真实使用量应当正确收费');
      }
      
      // 警告：高Token使用量
      if (pointsToDeduct > 50000) {
        console.warn('⚠️ 高Token使用量警告:', {
          modelName,
          finalTotalTokens,
          totalCost,
          pointsToDeduct,
          conversationId
        });
      }

      // Deduct balance
      const result = await db.deductUserBalance(
        user.id,
        pointsToDeduct,
        `ProMe AI API usage: ${modelName} (${finalTotalTokens} tokens, $${totalCost.toFixed(6)})`
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
          finalInputTokens,
          finalOutputTokens,
          finalTotalTokens,
          inputCost,
          outputCost,
          pointsToDeduct, // 🔧 修复：保存积分数量而不是美元成本
          conversationId,
          messageId
        );
      } catch (usageError) {
        console.error('Failed to record token usage:', usageError);
      }

      // Create usage event
      const usageEvent: TokenUsageEvent = {
        modelName,
        inputTokens: finalInputTokens,
        outputTokens: finalOutputTokens,
        totalTokens: finalTotalTokens,
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
        totalTokensUsed: prev.totalTokensUsed + finalTotalTokens,
        totalCost: prev.totalCost + totalCost,
        totalPointsDeducted: prev.totalPointsDeducted + pointsToDeduct,
        usageHistory: [usageEvent, ...prev.usageHistory.slice(0, 49)], // Keep last 50 events
        isProcessing: false,
        error: null
      }));

      // Show success toast
      toast.success(
        `Token已消费: ${finalTotalTokens} tokens (${pointsToDeduct} 积分)`,
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
  }, [currentProfitMargin, autoCreateModelConfig, findBestModelMatch, getDefaultModelPricing]);

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
      // Get model configuration with simple matching
      const modelConfigs = await db.getModelConfigs();
      let modelConfig = modelConfigs.find(config => 
        config.isActive && 
        config.modelName.toLowerCase() === modelName.toLowerCase()
      ) || null;

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