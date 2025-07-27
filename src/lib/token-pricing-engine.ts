import { ModelConfig } from '@/types';
import { db } from '@/lib/supabase';

export interface TokenConsumptionCalculation {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  inputCostCredits: number;
  outputCostCredits: number;
  totalCostCredits: number;
  pricePerInputToken: number;
  pricePerOutputToken: number;
}

export interface BillingResult {
  success: boolean;
  newBalance: number;
  message: string;
  calculation?: TokenConsumptionCalculation;
}

export class TokenPricingEngine {
  private modelConfigs: ModelConfig[] = [];
  private exchangeRate: number = 10000; // Default: 10000 credits = 1 USD
  private lastConfigUpdate: number = 0;
  private configCacheTime: number = 60000; // Cache for 1 minute

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.loadConfigurations();
  }

  /**
   * Load model configurations and exchange rate from database
   */
  private async loadConfigurations() {
    try {
      const now = Date.now();
      
      // Only reload if cache is expired
      if (now - this.lastConfigUpdate < this.configCacheTime) {
        return;
      }

      const [modelConfigs, exchangeRate] = await Promise.all([
        db.getModelConfigs(),
        db.getCurrentExchangeRate()
      ]);

      this.modelConfigs = modelConfigs.filter(config => config.isActive);
      this.exchangeRate = exchangeRate;
      this.lastConfigUpdate = now;

      console.log(`TokenPricingEngine: Loaded ${this.modelConfigs.length} active models, exchange rate: ${this.exchangeRate}`);
    } catch (error) {
      console.error('TokenPricingEngine: Failed to load configurations:', error);
    }
  }

  /**
   * Calculate the cost of token consumption in credits
   */
  async calculateTokenCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<TokenConsumptionCalculation | null> {
    // Refresh configurations if needed
    await this.loadConfigurations();

    // Find model configuration
    const modelConfig = this.modelConfigs.find(
      config => config.modelName.toLowerCase() === modelName.toLowerCase()
    );

    if (!modelConfig) {
      console.warn(`TokenPricingEngine: No configuration found for model: ${modelName}`);
      return null;
    }

    // Calculate costs in USD first (per 1000 tokens)
    const inputCostUSD = (inputTokens / 1000) * modelConfig.inputTokenPrice;
    const outputCostUSD = (outputTokens / 1000) * modelConfig.outputTokenPrice;
    const totalCostUSD = inputCostUSD + outputCostUSD;

    // Convert to credits using exchange rate
    const inputCostCredits = Math.ceil(inputCostUSD * this.exchangeRate);
    const outputCostCredits = Math.ceil(outputCostUSD * this.exchangeRate);
    const totalCostCredits = inputCostCredits + outputCostCredits;

    return {
      modelName: modelConfig.modelName,
      inputTokens,
      outputTokens,
      inputCostCredits,
      outputCostCredits,
      totalCostCredits,
      pricePerInputToken: modelConfig.inputTokenPrice,
      pricePerOutputToken: modelConfig.outputTokenPrice,
    };
  }

  /**
   * Process token consumption and deduct from user balance
   */
  async processTokenConsumption(
    userId: string,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    conversationId?: string,
    messageId?: string
  ): Promise<BillingResult> {
    try {
      // Calculate cost
      const calculation = await this.calculateTokenCost(modelName, inputTokens, outputTokens);
      
      if (!calculation) {
        return {
          success: false,
          newBalance: 0,
          message: `未找到模型 ${modelName} 的定价配置`,
        };
      }

      if (calculation.totalCostCredits === 0) {
        return {
          success: true,
          newBalance: 0,
          message: '无消耗',
          calculation,
        };
      }

      // Deduct balance
      const deductionResult = await db.deductUserBalance(
        userId,
        calculation.totalCostCredits,
        `AI对话消耗 - ${modelName}`
      );

      if (!deductionResult.success) {
        return {
          success: false,
          newBalance: deductionResult.newBalance,
          message: deductionResult.message,
          calculation,
        };
      }

      // Record detailed token usage
      await this.recordTokenUsage(
        userId,
        calculation,
        conversationId,
        messageId
      );

      return {
        success: true,
        newBalance: deductionResult.newBalance,
        message: `消耗 ${calculation.totalCostCredits} 积分`,
        calculation,
      };
    } catch (error) {
      console.error('TokenPricingEngine: Failed to process token consumption:', error);
      return {
        success: false,
        newBalance: 0,
        message: '处理token消耗时发生错误',
      };
    }
  }

  /**
   * Record detailed token usage in database
   */
  private async recordTokenUsage(
    userId: string,
    calculation: TokenConsumptionCalculation,
    conversationId?: string,
    messageId?: string
  ) {
    try {
      await db.addTokenUsageWithModel(
        userId,
        calculation.modelName,
        calculation.inputTokens,
        calculation.outputTokens,
        calculation.totalCostCredits,
        conversationId,
        messageId
      );
    } catch (error) {
      console.error('TokenPricingEngine: Failed to record token usage:', error);
    }
  }

  /**
   * Get model configuration for a specific model
   */
  async getModelConfig(modelName: string): Promise<ModelConfig | null> {
    await this.loadConfigurations();
    return this.modelConfigs.find(
      config => config.modelName.toLowerCase() === modelName.toLowerCase()
    ) || null;
  }

  /**
   * Get all active model configurations
   */
  async getActiveModelConfigs(): Promise<ModelConfig[]> {
    await this.loadConfigurations();
    return [...this.modelConfigs];
  }

  /**
   * Get current exchange rate
   */
  async getExchangeRate(): Promise<number> {
    await this.loadConfigurations();
    return this.exchangeRate;
  }

  /**
   * Force refresh configurations from database
   */
  async refreshConfigurations(): Promise<void> {
    this.lastConfigUpdate = 0;
    await this.loadConfigurations();
  }

  /**
   * Calculate USD cost for given credits
   */
  creditsToUSD(credits: number): number {
    return credits / this.exchangeRate;
  }

  /**
   * Calculate credits for given USD amount
   */
  usdToCredits(usd: number): number {
    return Math.ceil(usd * this.exchangeRate);
  }
}

// Export singleton instance
export const tokenPricingEngine = new TokenPricingEngine();