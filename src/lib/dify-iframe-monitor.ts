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
  private processedEvents = new Set<string>(); // Prevent duplicate processing
  private lastEventTime = 0;
  private minEventInterval = 1000; // Minimum 1 second between events

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
      window.location.origin, // Allow same-origin for testing
      // Add more as needed
    ];

    // For testing: also allow localhost and development origins
    if (import.meta.env.DEV) {
      validOrigins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173');
    }

    return validOrigins.some(validOrigin => 
      origin === validOrigin || origin.includes(validOrigin)
    );
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

      // Create unique event ID to prevent duplicate processing
      const eventId = `${conversationId}-${messageId}-${totalTokens}`;
      if (this.processedEvents.has(eventId)) {
        console.log('Event already processed, skipping:', eventId);
        return;
      }

      // Rate limiting - prevent rapid successive events
      const now = Date.now();
      if (now - this.lastEventTime < this.minEventInterval) {
        console.log('Rate limiting: event too soon after previous one');
        return;
      }
      this.lastEventTime = now;

      // Validate token counts
      if (totalTokens <= 0 || inputTokens < 0 || outputTokens < 0) {
        console.warn('Invalid token counts:', { inputTokens, outputTokens, totalTokens });
        return;
      }

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

      // Safety check: prevent excessive deduction
      if (pointsToDeduct > 100000) { // Adjust threshold as needed
        console.error('Token cost too high, potential error:', {
          modelName,
          totalTokens,
          pointsToDeduct
        });
        return;
      }

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
        // Mark event as processed
        this.processedEvents.add(eventId);
        
        // Clean up old processed events (keep last 100)
        if (this.processedEvents.size > 100) {
          const eventsArray = Array.from(this.processedEvents);
          this.processedEvents.clear();
          eventsArray.slice(-50).forEach(id => this.processedEvents.add(id));
        }

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