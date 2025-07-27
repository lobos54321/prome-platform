import { ModelConfig } from '@/types';
import { db } from '@/lib/supabase';

export interface TokenCostCalculation {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
  inputCostCredits: number;
  outputCostCredits: number;
  totalCostCredits: number;
  exchangeRate: number;
}

export interface BalanceValidation {
  hasEnoughBalance: boolean;
  currentBalance: number;
  requiredCredits: number;
  shortfall: number;
}

export class TokenPricingEngine {
  private modelConfigs: ModelConfig[] = [];
  private exchangeRate: number = 10000; // Default: 10000 credits = 1 USD
  private lastConfigUpdate: number = 0;
  private configCacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.loadConfigurations();
  }

  /**
   * Load model configurations and exchange rate from database
   */
  public async loadConfigurations() {
    try {
      const [modelConfigs, currentRate] = await Promise.all([
        db.getModelConfigs(),
        db.getCurrentExchangeRate()
      ]);

      this.modelConfigs = modelConfigs.filter(config => config.isActive);
      this.exchangeRate = currentRate;
      this.lastConfigUpdate = Date.now();

      console.log(`Loaded ${this.modelConfigs.length} active model configs`);
      console.log(`Current exchange rate: ${this.exchangeRate} credits/USD`);
    } catch (error) {
      console.error('Failed to load pricing configurations:', error);
    }
  }

  /**
   * Refresh configurations if they're stale
   */
  private async refreshConfigsIfNeeded() {
    const now = Date.now();
    if (now - this.lastConfigUpdate > this.configCacheExpiry) {
      await this.loadConfigurations();
    }
  }

  /**
   * Calculate token consumption cost
   */
  public async calculateTokenCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<TokenCostCalculation | null> {
    await this.refreshConfigsIfNeeded();

    // Find model configuration
    const modelConfig = this.modelConfigs.find(
      config => config.modelName.toLowerCase() === modelName.toLowerCase()
    );

    if (!modelConfig) {
      console.warn(`No active model config found for: ${modelName}`);
      return null;
    }

    // Validate token counts
    if (inputTokens < 0 || outputTokens < 0) {
      console.warn('Invalid token counts:', { inputTokens, outputTokens });
      return null;
    }

    const totalTokens = inputTokens + outputTokens;

    // Calculate USD costs (model prices are per 1000 tokens)
    const inputCostUSD = (inputTokens / 1000) * modelConfig.inputTokenPrice;
    const outputCostUSD = (outputTokens / 1000) * modelConfig.outputTokenPrice;
    const totalCostUSD = inputCostUSD + outputCostUSD;

    // Convert to credits
    const inputCostCredits = Math.round(inputCostUSD * this.exchangeRate);
    const outputCostCredits = Math.round(outputCostUSD * this.exchangeRate);
    const totalCostCredits = inputCostCredits + outputCostCredits;

    return {
      modelName,
      inputTokens,
      outputTokens,
      totalTokens,
      inputCostUSD,
      outputCostUSD,
      totalCostUSD,
      inputCostCredits,
      outputCostCredits,
      totalCostCredits,
      exchangeRate: this.exchangeRate,
    };
  }

  /**
   * Validate if user has sufficient balance
   */
  public async validateBalance(
    userId: string,
    requiredCredits: number
  ): Promise<BalanceValidation> {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        return {
          hasEnoughBalance: false,
          currentBalance: 0,
          requiredCredits,
          shortfall: requiredCredits,
        };
      }

      const currentBalance = user.balance;
      const hasEnoughBalance = currentBalance >= requiredCredits;
      const shortfall = hasEnoughBalance ? 0 : requiredCredits - currentBalance;

      return {
        hasEnoughBalance,
        currentBalance,
        requiredCredits,
        shortfall,
      };
    } catch (error) {
      console.error('Error validating balance:', error);
      return {
        hasEnoughBalance: false,
        currentBalance: 0,
        requiredCredits,
        shortfall: requiredCredits,
      };
    }
  }

  /**
   * Estimate cost for a given model and estimated token usage
   */
  public async estimateCost(
    modelName: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): Promise<TokenCostCalculation | null> {
    return this.calculateTokenCost(modelName, estimatedInputTokens, estimatedOutputTokens);
  }

  /**
   * Get current exchange rate
   */
  public getCurrentExchangeRate(): number {
    return this.exchangeRate;
  }

  /**
   * Get available models with their pricing
   */
  public getAvailableModels(): ModelConfig[] {
    return [...this.modelConfigs];
  }

  /**
   * Convert USD amount to credits
   */
  public usdToCredits(usdAmount: number): number {
    return Math.round(usdAmount * this.exchangeRate);
  }

  /**
   * Convert credits to USD amount
   */
  public creditsToUsd(credits: number): number {
    return credits / this.exchangeRate;
  }

  /**
   * Calculate estimated tokens from text length
   * This is a rough estimation - actual tokenization may vary
   */
  public estimateTokensFromText(text: string): number {
    // Rough estimation: 1 token ≈ 0.75 words for English
    // For Chinese/other languages, this might be different
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / 0.75);
  }

  /**
   * Get model pricing info for display
   */
  public getModelPricingInfo(modelName: string): {
    modelName: string;
    inputPriceUSD: number;
    outputPriceUSD: number;
    inputPriceCredits: number;
    outputPriceCredits: number;
  } | null {
    const modelConfig = this.modelConfigs.find(
      config => config.modelName.toLowerCase() === modelName.toLowerCase()
    );

    if (!modelConfig) {
      return null;
    }

    return {
      modelName: modelConfig.modelName,
      inputPriceUSD: modelConfig.inputTokenPrice,
      outputPriceUSD: modelConfig.outputTokenPrice,
      inputPriceCredits: Math.round(modelConfig.inputTokenPrice * this.exchangeRate),
      outputPriceCredits: Math.round(modelConfig.outputTokenPrice * this.exchangeRate),
    };
  }

  /**
   * Safety check for excessive costs
   */
  public validateReasonableCost(costCalculation: TokenCostCalculation): {
    isReasonable: boolean;
    reason?: string;
  } {
    const maxReasonableCredits = 50000; // Adjust as needed
    const maxReasonableTokens = 100000; // Adjust as needed

    if (costCalculation.totalCostCredits > maxReasonableCredits) {
      return {
        isReasonable: false,
        reason: `Cost too high: ${costCalculation.totalCostCredits} credits (max: ${maxReasonableCredits})`,
      };
    }

    if (costCalculation.totalTokens > maxReasonableTokens) {
      return {
        isReasonable: false,
        reason: `Token count too high: ${costCalculation.totalTokens} tokens (max: ${maxReasonableTokens})`,
      };
    }

    return { isReasonable: true };
  }
}

// Export singleton instance
export const tokenPricingEngine = new TokenPricingEngine();