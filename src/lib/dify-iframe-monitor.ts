import { DifyMessageEndEvent, ModelConfig } from '@/types';
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
  private currentExchangeRate = 10000; // Default: 10000 points = 1 USD
  private onTokenConsumption?: (event: TokenConsumptionEvent) => void;
  private onBalanceUpdate?: (newBalance: number) => void;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Load model configurations and exchange rate
    await this.loadModelConfigs();
    await this.loadExchangeRate();
  }

  private async loadModelConfigs() {
    try {
      this.modelConfigs = await db.getModelConfigs();
      console.log('Loaded model configs:', this.modelConfigs.length);
    } catch (error) {
      console.error('Failed to load model configs:', error);
    }
  }

  private async loadExchangeRate() {
    try {
      this.currentExchangeRate = await db.getCurrentExchangeRate();
      console.log('Current exchange rate:', this.currentExchangeRate);
    } catch (error) {
      console.error('Failed to load exchange rate:', error);
    }
  }

  public startListening(userId: string) {
    if (this.isListening) {
      console.warn('DifyIframeMonitor is already listening');
      return;
    }

    this.isListening = true;
    console.log('Starting Dify iframe monitoring for user:', userId);

    window.addEventListener('message', (event) => {
      this.handleMessage(event, userId);
    });
  }

  public stopListening() {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    console.log('Stopped Dify iframe monitoring');

    window.removeEventListener('message', this.handleMessage);
  }

  private async handleMessage(event: MessageEvent, userId: string) {
    try {
      // Validate message origin for security (adjust as needed)
      if (!this.isValidOrigin(event.origin)) {
        return;
      }

      const data = event.data;
      
      // Check if this is a Dify message_end event
      if (data?.event === 'message_end' && data?.data) {
        await this.processTokenConsumption(data.data as DifyMessageEndEvent, userId);
      }
    } catch (error) {
      console.error('Error handling iframe message:', error);
    }
  }

  private isValidOrigin(origin: string): boolean {
    // Add your Dify instance domains here
    const validOrigins = [
      'https://dify.ai',
      'https://cloud.dify.ai',
      'https://app.dify.ai',
      // Add more as needed
    ];

    return validOrigins.some(validOrigin => origin.includes(validOrigin));
  }

  private async processTokenConsumption(event: DifyMessageEndEvent, userId: string) {
    try {
      console.log('Processing token consumption:', event);

      const { 
        model_name: modelName, 
        input_tokens: inputTokens, 
        output_tokens: outputTokens, 
        total_tokens: totalTokens,
        conversation_id: conversationId,
        message_id: messageId
      } = event;

      // Find model configuration
      const modelConfig = this.modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        console.warn(`No active model config found for: ${modelName}`);
        return;
      }

      // Calculate costs
      const inputCost = (inputTokens / 1000) * modelConfig.inputTokenPrice;
      const outputCost = (outputTokens / 1000) * modelConfig.outputTokenPrice;
      const totalCost = inputCost + outputCost;

      // Convert to points
      const pointsToDeduct = Math.round(totalCost * this.currentExchangeRate);

      console.log(`Token consumption calculation:`, {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        pointsToDeduct
      });

      // Deduct balance
      const result = await db.deductUserBalance(
        userId,
        pointsToDeduct,
        `Token usage: ${modelName} (${totalTokens} tokens)`
      );

      if (result.success) {
        // Record token usage
        await db.addTokenUsageWithModel(
          userId,
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

        // Notify callbacks
        this.onTokenConsumption?.({
          modelName,
          inputTokens,
          outputTokens,
          totalTokens,
          conversationId,
          messageId,
          timestamp: new Date().toISOString()
        });

        this.onBalanceUpdate?.(result.newBalance);

        console.log(`Successfully processed token consumption. New balance: ${result.newBalance}`);
      } else {
        console.error(`Failed to deduct balance: ${result.message}`);
        // You might want to show a notification to the user here
      }
    } catch (error) {
      console.error('Error processing token consumption:', error);
    }
  }

  public setOnTokenConsumption(callback: (event: TokenConsumptionEvent) => void) {
    this.onTokenConsumption = callback;
  }

  public setOnBalanceUpdate(callback: (newBalance: number) => void) {
    this.onBalanceUpdate = callback;
  }

  public async refreshConfigs() {
    await this.loadModelConfigs();
    await this.loadExchangeRate();
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }
}

// Export singleton instance
export const difyIframeMonitor = new DifyIframeMonitor();