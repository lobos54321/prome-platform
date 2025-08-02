// Minimal compatibility layer for legacy iframe monitor functionality
// This keeps the interface intact while removing complex iframe monitoring
// The project has moved to direct API calls

import { ModelConfig } from '@/types';
import { db } from '@/lib/supabase';

export interface TokenConsumptionEvent {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  conversationId?: string;
  messageId?: string;
  timestamp: string;
}

export class DifyIframeMonitor {
  private isListening = false;
  private modelConfigs: ModelConfig[] = [];
  private currentExchangeRate = 10000;
  private onTokenConsumption?: (event: TokenConsumptionEvent) => void;
  private onBalanceUpdate?: (newBalance: number) => void;
  private onNewModelDetected?: (model: ModelConfig) => void;
  private onConfigurationFailed?: (reason: string) => void;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    console.log('[DifyIframeMonitor] Initializing minimal compatibility mode - iframe monitoring disabled');
    await this.loadModelConfigs();
    await this.loadExchangeRate();
  }

  private async loadModelConfigs() {
    try {
      this.modelConfigs = await db.getModelConfigs();
      console.log('[DifyIframeMonitor] Loaded model configs:', this.modelConfigs.length);
    } catch (error) {
      console.error('[DifyIframeMonitor] Failed to load model configs:', error);
      this.modelConfigs = [
        {
          id: 'fallback-gpt4',
          modelName: 'gpt-4',
          inputTokenPrice: 0.03,
          outputTokenPrice: 0.06,
          serviceType: 'ai_model' as const,
          isActive: true,
          autoCreated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      ];
    }
  }

  private async loadExchangeRate() {
    try {
      this.currentExchangeRate = await db.getCurrentExchangeRate();
    } catch (error) {
      console.error('[DifyIframeMonitor] Failed to load exchange rate:', error);
      this.currentExchangeRate = 10000;
    }
  }

  // Legacy iframe monitoring methods - now no-ops since iframe monitoring is disabled
  public startListening(userId: string) {
    console.log('[DifyIframeMonitor] iframe monitoring is disabled - using direct API calls instead');
    this.isListening = true; // For compatibility
  }

  public stopListening() {
    console.log('[DifyIframeMonitor] Stopping monitoring (compatibility mode)');
    this.isListening = false;
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Direct token recording method for API-based usage
  public async recordManualTokenUsage(
    userId: string,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    description: string = 'Direct API usage'
  ): Promise<{ success: boolean; message: string; newBalance?: number }> {
    try {
      const totalTokens = inputTokens + outputTokens;

      let modelConfig = this.modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        const autoCreatedModel = await this.autoCreateModelConfig(modelName);
        if (autoCreatedModel) {
          modelConfig = autoCreatedModel;
          this.modelConfigs.push(autoCreatedModel);
        } else {
          return { success: false, message: `Model configuration not found for: ${modelName}` };
        }
      }

      const inputCost = (inputTokens / 1000) * modelConfig.inputTokenPrice;
      const outputCost = (outputTokens / 1000) * modelConfig.outputTokenPrice;
      const totalCost = inputCost + outputCost;
      const pointsToDeduct = Math.round(totalCost * this.currentExchangeRate);

      const result = await db.deductUserBalance(userId, pointsToDeduct, description);

      if (result.success) {
        await db.addTokenUsageWithModel(
          userId,
          modelName,
          inputTokens,
          outputTokens,
          totalTokens,
          inputCost,
          outputCost,
          totalCost,
          `direct_${Date.now()}`,
          `direct_${Date.now()}`
        );

        this.onTokenConsumption?.({
          modelName,
          inputTokens,
          outputTokens,
          totalTokens,
          conversationId: `direct_${Date.now()}`,
          messageId: `direct_${Date.now()}`,
          timestamp: new Date().toISOString()
        });

        this.onBalanceUpdate?.(result.newBalance);

        return { success: true, message: 'Token usage recorded successfully', newBalance: result.newBalance };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('[DifyIframeMonitor] Error recording token usage:', error);
      return { success: false, message: 'Error recording token usage' };
    }
  }

  private async autoCreateModelConfig(modelName: string): Promise<ModelConfig | null> {
    try {
      const defaultPricing = this.getDefaultModelPricing(modelName);
      const serviceType = 'ai_model';
      const systemUserId = 'system';
      
      const newModel = await db.addModelConfig(
        modelName,
        defaultPricing.inputTokenPrice,
        defaultPricing.outputTokenPrice,
        systemUserId,
        serviceType,
        undefined,
        true
      );

      if (newModel) {
        this.onNewModelDetected?.(newModel);
        return newModel;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to auto-create model config for ${modelName}:`, error);
      return null;
    }
  }

  private getDefaultModelPricing(modelName: string): { inputTokenPrice: number; outputTokenPrice: number } {
    const name = modelName.toLowerCase();
    
    if (name.includes('gpt-4o') || name.includes('gpt-4-turbo')) {
      return { inputTokenPrice: 0.01, outputTokenPrice: 0.03 };
    }
    if (name.includes('gpt-4')) {
      return { inputTokenPrice: 0.03, outputTokenPrice: 0.06 };
    }
    if (name.includes('gpt-3.5')) {
      return { inputTokenPrice: 0.001, outputTokenPrice: 0.002 };
    }
    if (name.includes('claude-3-opus')) {
      return { inputTokenPrice: 0.015, outputTokenPrice: 0.075 };
    }
    if (name.includes('claude-3-sonnet')) {
      return { inputTokenPrice: 0.003, outputTokenPrice: 0.015 };
    }
    if (name.includes('claude-3-haiku')) {
      return { inputTokenPrice: 0.00025, outputTokenPrice: 0.00125 };
    }
    if (name.includes('claude')) {
      return { inputTokenPrice: 0.003, outputTokenPrice: 0.015 };
    }
    
    return { inputTokenPrice: 0.002, outputTokenPrice: 0.006 };
  }

  // Legacy simulation methods for testing
  public async simulateTokenConsumption(
    userId: string,
    modelName: string = 'gpt-4',
    inputTokens: number = 1000,
    outputTokens: number = 500
  ): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating token consumption (compatibility mode)');
    await this.recordManualTokenUsage(userId, modelName, inputTokens, outputTokens, 'Simulated usage');
  }

  public async simulateRealDifyUsage(
    userId: string,
    inputTokens: number = 2913,
    outputTokens: number = 686,
    inputPrice: number = 0.005826,
    outputPrice: number = 0.005488
  ): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating real Dify usage (compatibility mode)');
    await this.recordManualTokenUsage(userId, 'dify-real', inputTokens, outputTokens, 'Simulated real Dify usage');
  }

  public async simulateWorkflowTokenConsumption(
    userId: string,
    inputTokens: number = 2913,
    outputTokens: number = 701,
    inputPrice: number = 0.005826,
    outputPrice: number = 0.005608
  ): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating workflow consumption (compatibility mode)');
    await this.recordManualTokenUsage(userId, 'dify-workflow', inputTokens, outputTokens, 'Simulated workflow usage');
  }

  public async simulateDifyReady(userId: string, origin: string = 'https://udify.app'): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating Dify ready (compatibility mode - no-op)');
  }

  public testOriginValidation(origin: string): boolean {
    console.log(`[DifyIframeMonitor] Testing origin validation (compatibility mode): ${origin}`);
    return true; // Always valid in compatibility mode
  }

  public simulateMessageFromOrigin(origin: string, userId: string, messageData?: any): void {
    console.log(`[DifyIframeMonitor] Simulating message from origin (compatibility mode): ${origin}`);
  }

  // Callback setters
  public setOnTokenConsumption(callback: (event: TokenConsumptionEvent) => void) {
    this.onTokenConsumption = callback;
  }

  public setOnBalanceUpdate(callback: (newBalance: number) => void) {
    this.onBalanceUpdate = callback;
  }

  public setOnNewModelDetected(callback: (model: ModelConfig) => void) {
    this.onNewModelDetected = callback;
  }

  public setOnConfigurationFailed(callback: (reason: string) => void) {
    this.onConfigurationFailed = callback;
  }

  public async refreshConfigs() {
    await this.loadModelConfigs();
    await this.loadExchangeRate();
  }

  public getStatus() {
    return {
      isListening: this.isListening,
      modelConfigsLoaded: this.modelConfigs.length,
      exchangeRate: this.currentExchangeRate,
      mode: 'compatibility - iframe monitoring disabled'
    };
  }
}

// Export singleton instance
export const difyIframeMonitor = new DifyIframeMonitor();