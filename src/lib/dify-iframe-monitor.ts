import { DifyMessageEndEvent, DifyWorkflowFinishedEvent, DifyRealUsageEvent, ModelConfig } from '@/types';
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
  private onNewModelDetected?: (model: ModelConfig) => void;
  private processedEvents = new Set<string>(); // Prevent duplicate processing
  private lastEventTime = 0;
  private minEventInterval = 1000; // Minimum 1 second between events
  private boundMessageHandler?: (event: MessageEvent) => void; // Store bound handler for cleanup

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
      console.log('[DifyIframeMonitor] Loaded model configs:', this.modelConfigs.length);
      console.log('[DifyIframeMonitor] Model configs:', this.modelConfigs.map(c => `${c.modelName} (${c.inputTokenPrice}/${c.outputTokenPrice})`));
    } catch (error) {
      console.error('[DifyIframeMonitor] Failed to load model configs:', error);
      // Add some default fallback configs for testing
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
        },
        {
          id: 'fallback-gpt35',
          modelName: 'gpt-3.5-turbo',
          inputTokenPrice: 0.001,
          outputTokenPrice: 0.002,
          serviceType: 'ai_model' as const,
          isActive: true,
          autoCreated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
      ];
      console.log('[DifyIframeMonitor] Using fallback model configs');
    }
  }

  private async loadExchangeRate() {
    try {
      this.currentExchangeRate = await db.getCurrentExchangeRate();
      console.log('[DifyIframeMonitor] Current exchange rate:', this.currentExchangeRate);
    } catch (error) {
      console.error('[DifyIframeMonitor] Failed to load exchange rate:', error);
      this.currentExchangeRate = 10000; // Fallback rate
      console.log('[DifyIframeMonitor] Using fallback exchange rate:', this.currentExchangeRate);
    }
  }

  public startListening(userId: string) {
    if (this.isListening) {
      console.warn('[DifyIframeMonitor] Monitor is already listening');
      return;
    }

    this.isListening = true;
    console.log('[DifyIframeMonitor] Starting Dify iframe monitoring for user:', userId);
    console.log('[DifyIframeMonitor] Valid origins:', this.getValidOrigins());
    console.log('[DifyIframeMonitor] Current environment:', import.meta.env.DEV ? 'development' : 'production');

    // Add event listener with proper binding
    this.boundMessageHandler = (event: MessageEvent) => {
      this.handleMessage(event, userId);
    };

    window.addEventListener('message', this.boundMessageHandler);
    console.log('[DifyIframeMonitor] Message event listener added');
  }

  public stopListening() {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    console.log('[DifyIframeMonitor] Stopped Dify iframe monitoring');

    if (this.boundMessageHandler) {
      window.removeEventListener('message', this.boundMessageHandler);
      this.boundMessageHandler = undefined;
      console.log('[DifyIframeMonitor] Message event listener removed');
    }
  }

  private async handleMessage(event: MessageEvent, userId: string) {
    try {
      console.log('[DifyIframeMonitor] ===============================================');
      console.log('[DifyIframeMonitor] Received message from:', event.origin);
      console.log('[DifyIframeMonitor] Message data:', event.data);
      console.log('[DifyIframeMonitor] Event type:', event.data?.event);
      console.log('[DifyIframeMonitor] User ID:', userId);
      
      // Enhanced logging for udify.app messages
      if (event.origin.includes('udify.app')) {
        console.log('[DifyIframeMonitor] 🎯 UDIFY.APP MESSAGE DETECTED:');
        console.log('[DifyIframeMonitor] Full event data:', JSON.stringify(event.data, null, 2));
      }
      
      // Validate message origin for security
      if (!this.isValidOrigin(event.origin)) {
        console.log('[DifyIframeMonitor] ❌ Message rejected - invalid origin:', event.origin);
        return;
      }

      console.log('[DifyIframeMonitor] ✅ Origin validation passed for:', event.origin);
      const data = event.data;
      
      // Check for real Dify usage format (top-level usage field)
      if (data?.usage && data.usage.total_tokens > 0) {
        console.log('[DifyIframeMonitor] 🚀 Processing real Dify usage event from:', event.origin);
        console.log('[DifyIframeMonitor] Real usage data:', data.usage);
        await this.processRealDifyUsage(data as DifyRealUsageEvent, userId);
      }
      // Check if this is a Dify message_end event (legacy format)
      else if (data?.event === 'message_end' && data?.data) {
        console.log('[DifyIframeMonitor] 🚀 Processing message_end event from:', event.origin);
        console.log('[DifyIframeMonitor] Token data:', data.data);
        await this.processTokenConsumption(data.data as DifyMessageEndEvent, userId);
      }
      // Check if this is a message_end event with usage field
      else if (data?.event === 'message_end' && data?.usage) {
        console.log('[DifyIframeMonitor] 🚀 Processing message_end with usage from:', event.origin);
        console.log('[DifyIframeMonitor] Usage data:', data.usage);
        await this.processMessageEndWithUsage(data as DifyMessageEndEvent, userId);
      }
      // Check if this is a Dify workflow_finished event (new format)
      else if (data?.event === 'workflow_finished' && data?.data?.metadata?.usage) {
        console.log('[DifyIframeMonitor] 🚀 Processing workflow_finished event from:', event.origin);
        console.log('[DifyIframeMonitor] Workflow data:', data);
        await this.processWorkflowTokenConsumption(data as DifyWorkflowFinishedEvent, userId);
      } 
      else {
        console.log('[DifyIframeMonitor] ⏭️ Message ignored - not a supported event. Event type:', data?.event);
        // Log detailed info for udify.app messages to help debug
        if (event.origin.includes('udify.app')) {
          console.log('[DifyIframeMonitor] 🔍 UDIFY.APP message analysis:');
          console.log('[DifyIframeMonitor] - Has event field:', !!data?.event);
          console.log('[DifyIframeMonitor] - Has usage field:', !!data?.usage);
          console.log('[DifyIframeMonitor] - Has data field:', !!data?.data);
          console.log('[DifyIframeMonitor] - Top-level keys:', Object.keys(data || {}));
        }
      }
      console.log('[DifyIframeMonitor] ===============================================');
    } catch (error) {
      console.error('[DifyIframeMonitor] ❌ Error handling iframe message:', error);
      console.error('[DifyIframeMonitor] Origin:', event.origin);
      console.error('[DifyIframeMonitor] Data:', event.data);
    }
  }

  private isValidOrigin(origin: string): boolean {
    const validOrigins = this.getValidOrigins();
    
    // First check exact matches
    if (validOrigins.includes(origin)) {
      console.log('[DifyIframeMonitor] Origin validation - exact match:', origin);
      return true;
    }
    
    try {
      const url = new URL(origin);
      
      // Check for subdomain matches for udify.app (must be exact subdomain, not just containing)
      if (url.protocol === 'https:' && url.hostname.endsWith('.udify.app')) {
        console.log('[DifyIframeMonitor] Origin validation - udify.app subdomain match:', origin);
        return true;
      }
      
      // Check for specific path matches for known domains (like udify.app with paths)
      for (const validOrigin of validOrigins) {
        try {
          const validUrl = new URL(validOrigin);
          if (url.hostname === validUrl.hostname && url.protocol === validUrl.protocol) {
            console.log('[DifyIframeMonitor] Origin validation - domain match:', origin, 'with base:', validOrigin);
            return true;
          }
        } catch (e) {
          // Handle cases where validOrigin might not be a full URL
          if (origin.startsWith(validOrigin + '/') || origin === validOrigin) {
            console.log('[DifyIframeMonitor] Origin validation - path match:', origin, 'with base:', validOrigin);
            return true;
          }
        }
      }
    } catch (e) {
      // If URL parsing fails, fall back to string matching for basic cases
      for (const validOrigin of validOrigins) {
        if (origin.startsWith(validOrigin + '/') || origin === validOrigin) {
          console.log('[DifyIframeMonitor] Origin validation - fallback path match:', origin, 'with base:', validOrigin);
          return true;
        }
      }
    }
    
    console.log('[DifyIframeMonitor] Origin validation - REJECTED:', origin);
    console.log('[DifyIframeMonitor] Valid origins:', validOrigins);
    return false;
  }

  private getValidOrigins(): string[] {
    // Add your Dify instance domains here
    const validOrigins = [
      'https://dify.ai',
      'https://cloud.dify.ai',
      'https://app.dify.ai',
      // Add udify.app domains for real token monitoring
      'https://udify.app',
      'https://chatbot.udify.app',
      window.location.origin, // Allow same-origin for testing
      // Add more as needed
    ];

    // For testing: also allow localhost and development origins
    if (import.meta.env.DEV) {
      validOrigins.push(
        'http://localhost:3000', 
        'http://localhost:5173', 
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'https://localhost:3000',
        'https://localhost:5173'
      );
    }

    return validOrigins;
  }

  private async processRealDifyUsage(event: DifyRealUsageEvent, userId: string) {
    try {
      console.log('[DifyIframeMonitor] Processing real Dify usage event:', event);

      const { 
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
          prompt_price: inputPriceStr,
          completion_price: outputPriceStr,
          total_price: totalPriceStr,
          currency
        },
        conversation_id: conversationId,
        message_id: messageId
      } = event;

      // Create unique event ID to prevent duplicate processing
      const eventId = `${conversationId || 'unknown'}-${messageId || 'unknown'}-${totalTokens}-${Date.now()}`;
      if (this.processedEvents.has(eventId)) {
        console.log('[DifyIframeMonitor] Event already processed, skipping:', eventId);
        return;
      }

      // Rate limiting - prevent rapid successive events
      const now = Date.now();
      if (now - this.lastEventTime < this.minEventInterval) {
        console.log('[DifyIframeMonitor] Rate limiting: event too soon after previous one');
        return;
      }
      this.lastEventTime = now;

      // Validate token counts
      if (totalTokens <= 0 || inputTokens < 0 || outputTokens < 0) {
        console.warn('[DifyIframeMonitor] Invalid token counts:', { inputTokens, outputTokens, totalTokens });
        return;
      }

      // Parse the provided pricing from Dify
      const inputCost = parseFloat(inputPriceStr) || 0;
      const outputCost = parseFloat(outputPriceStr) || 0;
      const totalCost = parseFloat(totalPriceStr) || (inputCost + outputCost);

      console.log(`[DifyIframeMonitor] Using real Dify pricing:`, {
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        currency
      });

      // Validate costs
      if (totalCost <= 0) {
        console.warn('[DifyIframeMonitor] Invalid cost calculation:', { inputCost, outputCost, totalCost });
        return;
      }

      // Use 'dify-real' model name for real Dify events
      const modelName = 'dify-real';
      let modelConfig = this.modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        console.log(`[DifyIframeMonitor] Model config not found for: ${modelName}, attempting to auto-create...`);
        
        // Try to auto-create the model configuration
        const autoCreatedModel = await this.autoCreateModelConfig(modelName);
        if (autoCreatedModel) {
          console.log(`[DifyIframeMonitor] Successfully auto-created model config for: ${modelName}`);
          modelConfig = autoCreatedModel;
          // Add to local cache
          this.modelConfigs.push(autoCreatedModel);
        } else {
          console.warn(`[DifyIframeMonitor] Failed to auto-create model config for: ${modelName}, creating fallback config`);
          // Create a fallback config for real Dify events
          modelConfig = {
            id: `fallback-${modelName}`,
            modelName: modelName,
            inputTokenPrice: 0.002, // Default pricing - actual costs come from Dify
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

      // Convert to points using exchange rate
      const pointsToDeduct = Math.round(totalCost * this.currentExchangeRate);

      // Safety check: prevent excessive deduction
      if (pointsToDeduct > 100000) { // Adjust threshold as needed
        console.error('[DifyIframeMonitor] Token cost too high, potential error:', {
          modelName,
          totalTokens,
          totalCost,
          pointsToDeduct
        });
        return;
      }

      console.log(`[DifyIframeMonitor] Real Dify token consumption calculation:`, {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        pointsToDeduct,
        exchangeRate: this.currentExchangeRate
      });

      // Try to deduct balance
      try {
        const result = await db.deductUserBalance(
          userId,
          pointsToDeduct,
          `Real Dify usage: ${modelName} (${totalTokens} tokens, $${totalCost.toFixed(6)})`
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

          // Record token usage - use actual Dify-provided costs
          try {
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
            console.log('[DifyIframeMonitor] Real Dify token usage recorded successfully');
          } catch (usageError) {
            console.error('[DifyIframeMonitor] Failed to record real Dify token usage:', usageError);
          }

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

          console.log(`[DifyIframeMonitor] Successfully processed real Dify token consumption. New balance: ${result.newBalance}`);
        } else {
          console.error(`[DifyIframeMonitor] Failed to deduct balance: ${result.message}`);
        }
      } catch (balanceError) {
        console.error('[DifyIframeMonitor] Error during balance deduction:', balanceError);
      }
    } catch (error) {
      console.error('[DifyIframeMonitor] Error processing real Dify usage:', error);
    }
  }

  private async processMessageEndWithUsage(event: DifyMessageEndEvent, userId: string) {
    try {
      console.log('[DifyIframeMonitor] Processing message_end event with usage field:', event);

      if (!event.usage) {
        console.warn('[DifyIframeMonitor] No usage field in message_end event');
        return;
      }

      const { 
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
          prompt_price: inputPriceStr,
          completion_price: outputPriceStr,
          total_price: totalPriceStr,
          currency
        },
        conversation_id: conversationId,
        message_id: messageId,
        model_name: providedModelName
      } = event;

      // Use provided model name or fallback
      const modelName = providedModelName || 'dify-message-end';

      // Create unique event ID to prevent duplicate processing
      const eventId = `${conversationId}-${messageId}-${totalTokens}-${Date.now()}`;
      if (this.processedEvents.has(eventId)) {
        console.log('[DifyIframeMonitor] Event already processed, skipping:', eventId);
        return;
      }

      // Rate limiting - prevent rapid successive events
      const now = Date.now();
      if (now - this.lastEventTime < this.minEventInterval) {
        console.log('[DifyIframeMonitor] Rate limiting: event too soon after previous one');
        return;
      }
      this.lastEventTime = now;

      // Validate token counts
      if (totalTokens <= 0 || inputTokens < 0 || outputTokens < 0) {
        console.warn('[DifyIframeMonitor] Invalid token counts:', { inputTokens, outputTokens, totalTokens });
        return;
      }

      // Parse the provided pricing from Dify or calculate if not provided
      let inputCost = 0;
      let outputCost = 0;
      let totalCost = 0;

      if (inputPriceStr && outputPriceStr) {
        inputCost = parseFloat(inputPriceStr) || 0;
        outputCost = parseFloat(outputPriceStr) || 0;
        totalCost = parseFloat(totalPriceStr || '') || (inputCost + outputCost);
      } else {
        // Fallback to model-based calculation
        console.log('[DifyIframeMonitor] No pricing in usage field, falling back to model-based calculation');
        return await this.processTokenConsumption(event, userId);
      }

      console.log(`[DifyIframeMonitor] Using message_end usage pricing:`, {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        currency
      });

      // Validate costs
      if (totalCost <= 0) {
        console.warn('[DifyIframeMonitor] Invalid cost calculation:', { inputCost, outputCost, totalCost });
        return;
      }

      // Find or create model configuration
      let modelConfig = this.modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        console.log(`[DifyIframeMonitor] Model config not found for: ${modelName}, attempting to auto-create...`);
        
        const autoCreatedModel = await this.autoCreateModelConfig(modelName);
        if (autoCreatedModel) {
          console.log(`[DifyIframeMonitor] Successfully auto-created model config for: ${modelName}`);
          modelConfig = autoCreatedModel;
          this.modelConfigs.push(autoCreatedModel);
        } else {
          console.warn(`[DifyIframeMonitor] Failed to auto-create model config for: ${modelName}, creating fallback config`);
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

      // Convert to points using exchange rate
      const pointsToDeduct = Math.round(totalCost * this.currentExchangeRate);

      // Safety check: prevent excessive deduction
      if (pointsToDeduct > 100000) {
        console.error('[DifyIframeMonitor] Token cost too high, potential error:', {
          modelName,
          totalTokens,
          totalCost,
          pointsToDeduct
        });
        return;
      }

      console.log(`[DifyIframeMonitor] Message_end with usage calculation:`, {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        pointsToDeduct,
        exchangeRate: this.currentExchangeRate
      });

      // Try to deduct balance
      try {
        const result = await db.deductUserBalance(
          userId,
          pointsToDeduct,
          `Message end usage: ${modelName} (${totalTokens} tokens, $${totalCost.toFixed(6)})`
        );

        if (result.success) {
          // Mark event as processed
          this.processedEvents.add(eventId);
          
          // Clean up old processed events
          if (this.processedEvents.size > 100) {
            const eventsArray = Array.from(this.processedEvents);
            this.processedEvents.clear();
            eventsArray.slice(-50).forEach(id => this.processedEvents.add(id));
          }

          // Record token usage
          try {
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
            console.log('[DifyIframeMonitor] Message_end token usage recorded successfully');
          } catch (usageError) {
            console.error('[DifyIframeMonitor] Failed to record message_end token usage:', usageError);
          }

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

          console.log(`[DifyIframeMonitor] Successfully processed message_end usage. New balance: ${result.newBalance}`);
        } else {
          console.error(`[DifyIframeMonitor] Failed to deduct balance: ${result.message}`);
        }
      } catch (balanceError) {
        console.error('[DifyIframeMonitor] Error during balance deduction:', balanceError);
      }
    } catch (error) {
      console.error('[DifyIframeMonitor] Error processing message_end with usage:', error);
    }
  }

  private async processTokenConsumption(event: DifyMessageEndEvent, userId: string) {
    try {
      console.log('[DifyIframeMonitor] Processing token consumption:', event);

      const { 
        model_name: modelName, 
        input_tokens: inputTokens, 
        output_tokens: outputTokens, 
        total_tokens: totalTokens,
        conversation_id: conversationId,
        message_id: messageId
      } = event;

      // Create unique event ID to prevent duplicate processing
      const eventId = `${conversationId}-${messageId}-${totalTokens}-${Date.now()}`;
      if (this.processedEvents.has(eventId)) {
        console.log('[DifyIframeMonitor] Event already processed, skipping:', eventId);
        return;
      }

      // Rate limiting - prevent rapid successive events
      const now = Date.now();
      if (now - this.lastEventTime < this.minEventInterval) {
        console.log('[DifyIframeMonitor] Rate limiting: event too soon after previous one');
        return;
      }
      this.lastEventTime = now;

      // Validate token counts
      if (totalTokens <= 0 || inputTokens < 0 || outputTokens < 0) {
        console.warn('[DifyIframeMonitor] Invalid token counts:', { inputTokens, outputTokens, totalTokens });
        return;
      }

      console.log('[DifyIframeMonitor] Looking for model config for:', modelName);
      console.log('[DifyIframeMonitor] Available models:', this.modelConfigs.map(c => c.modelName));

      // Find model configuration or auto-create if not found
      let modelConfig = this.modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        console.log(`[DifyIframeMonitor] Model config not found for: ${modelName}, attempting to auto-create...`);
        
        // Try to auto-create the model with default pricing
        const autoCreatedModel = await this.autoCreateModelConfig(modelName);
        if (autoCreatedModel) {
          console.log(`[DifyIframeMonitor] Successfully auto-created model config for: ${modelName}`);
          modelConfig = autoCreatedModel;
          // Add to local cache
          this.modelConfigs.push(autoCreatedModel);
        } else {
          console.warn(`[DifyIframeMonitor] Failed to auto-create model config for: ${modelName}, using fallback pricing`);
          // Use fallback pricing for unknown models
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

      // Calculate costs
      const inputCost = (inputTokens / 1000) * modelConfig.inputTokenPrice;
      const outputCost = (outputTokens / 1000) * modelConfig.outputTokenPrice;
      const totalCost = inputCost + outputCost;

      // Convert to points
      const pointsToDeduct = Math.round(totalCost * this.currentExchangeRate);

      // Safety check: prevent excessive deduction
      if (pointsToDeduct > 100000) { // Adjust threshold as needed
        console.error('[DifyIframeMonitor] Token cost too high, potential error:', {
          modelName,
          totalTokens,
          pointsToDeduct
        });
        return;
      }

      console.log(`[DifyIframeMonitor] Token consumption calculation:`, {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        pointsToDeduct,
        exchangeRate: this.currentExchangeRate
      });

      // Try to deduct balance
      try {
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
          try {
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
            console.log('[DifyIframeMonitor] Token usage recorded successfully');
          } catch (usageError) {
            console.error('[DifyIframeMonitor] Failed to record token usage:', usageError);
          }

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

          console.log(`[DifyIframeMonitor] Successfully processed token consumption. New balance: ${result.newBalance}`);
        } else {
          console.error(`[DifyIframeMonitor] Failed to deduct balance: ${result.message}`);
          // You might want to show a notification to the user here
        }
      } catch (balanceError) {
        console.error('[DifyIframeMonitor] Error during balance deduction:', balanceError);
      }
    } catch (error) {
      console.error('[DifyIframeMonitor] Error processing token consumption:', error);
    }
  }

  private async processWorkflowTokenConsumption(event: DifyWorkflowFinishedEvent, userId: string) {
    try {
      console.log('[DifyIframeMonitor] Processing workflow token consumption:', event);

      const { 
        conversation_id: conversationId,
        message_id: messageId,
        data: {
          metadata: {
            usage: {
              prompt_tokens: inputTokens,
              completion_tokens: outputTokens,
              total_tokens: totalTokens,
              prompt_price: promptPriceStr,
              completion_price: completionPriceStr,
              total_price: totalPriceStr,
              currency
            }
          }
        }
      } = event;

      // Create unique event ID to prevent duplicate processing
      const eventId = `${conversationId}-${messageId}-${totalTokens}-${Date.now()}`;
      if (this.processedEvents.has(eventId)) {
        console.log('[DifyIframeMonitor] Event already processed, skipping:', eventId);
        return;
      }

      // Rate limiting - prevent rapid successive events
      const now = Date.now();
      if (now - this.lastEventTime < this.minEventInterval) {
        console.log('[DifyIframeMonitor] Rate limiting: event too soon after previous one');
        return;
      }
      this.lastEventTime = now;

      // Validate token counts
      if (totalTokens <= 0 || inputTokens < 0 || outputTokens < 0) {
        console.warn('[DifyIframeMonitor] Invalid token counts:', { inputTokens, outputTokens, totalTokens });
        return;
      }

      // Parse the provided pricing from Dify
      const inputCost = parseFloat(promptPriceStr) || 0;
      const outputCost = parseFloat(completionPriceStr) || 0;
      const totalCost = parseFloat(totalPriceStr) || (inputCost + outputCost);

      console.log(`[DifyIframeMonitor] Using Dify-provided pricing:`, {
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        currency
      });

      // Validate costs
      if (totalCost <= 0) {
        console.warn('[DifyIframeMonitor] Invalid cost calculation:', { inputCost, outputCost, totalCost });
        return;
      }

      // Ensure 'dify-workflow' model configuration exists
      const modelName = 'dify-workflow';
      let modelConfig = this.modelConfigs.find(
        config => config.modelName.toLowerCase() === modelName.toLowerCase() && config.isActive
      );

      if (!modelConfig) {
        console.log(`[DifyIframeMonitor] Model config not found for: ${modelName}, attempting to auto-create...`);
        
        // Try to auto-create the dify-workflow model configuration
        const autoCreatedModel = await this.autoCreateModelConfig(modelName);
        if (autoCreatedModel) {
          console.log(`[DifyIframeMonitor] Successfully auto-created model config for: ${modelName}`);
          modelConfig = autoCreatedModel;
          // Add to local cache
          this.modelConfigs.push(autoCreatedModel);
        } else {
          console.warn(`[DifyIframeMonitor] Failed to auto-create model config for: ${modelName}, creating fallback config`);
          // Create a fallback config specifically for dify-workflow
          modelConfig = {
            id: `fallback-${modelName}`,
            modelName: modelName,
            inputTokenPrice: 0.002, // Default pricing for workflow models
            outputTokenPrice: 0.006,
            serviceType: 'workflow' as const,
            isActive: true,
            autoCreated: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system'
          };
        }
      }

      // Convert to points using exchange rate
      const pointsToDeduct = Math.round(totalCost * this.currentExchangeRate);

      // Safety check: prevent excessive deduction
      if (pointsToDeduct > 100000) { // Adjust threshold as needed
        console.error('[DifyIframeMonitor] Token cost too high, potential error:', {
          modelName,
          totalTokens,
          totalCost,
          pointsToDeduct
        });
        return;
      }

      console.log(`[DifyIframeMonitor] Workflow token consumption calculation:`, {
        modelName,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        pointsToDeduct,
        exchangeRate: this.currentExchangeRate
      });

      // Try to deduct balance
      try {
        const result = await db.deductUserBalance(
          userId,
          pointsToDeduct,
          `Workflow token usage: ${modelName} (${totalTokens} tokens, $${totalCost.toFixed(6)})`
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

          // Record token usage - use dify-workflow model name with actual Dify-provided costs
          try {
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
            console.log('[DifyIframeMonitor] Workflow token usage recorded successfully');
          } catch (usageError) {
            console.error('[DifyIframeMonitor] Failed to record workflow token usage:', usageError);
          }

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

          console.log(`[DifyIframeMonitor] Successfully processed workflow token consumption. New balance: ${result.newBalance}`);
        } else {
          console.error(`[DifyIframeMonitor] Failed to deduct balance: ${result.message}`);
        }
      } catch (balanceError) {
        console.error('[DifyIframeMonitor] Error during balance deduction:', balanceError);
      }
    } catch (error) {
      console.error('[DifyIframeMonitor] Error processing workflow token consumption:', error);
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

  /**
   * Auto-create a model configuration with default pricing when a new model is detected
   */
  private async autoCreateModelConfig(modelName: string): Promise<ModelConfig | null> {
    try {
      console.log(`Auto-creating model config for: ${modelName}`);
      
      // Determine default pricing based on common model patterns
      const defaultPricing = this.getDefaultModelPricing(modelName);
      
      // Determine service type based on model name
      const serviceType = modelName.toLowerCase() === 'dify-workflow' ? 'workflow' : 'ai_model';
      
      // Use system user ID for auto-created models
      const systemUserId = 'system'; // We'll create a system user for auto-generated configs
      
      const newModel = await db.addModelConfig(
        modelName,
        defaultPricing.inputTokenPrice,
        defaultPricing.outputTokenPrice,
        systemUserId,
        serviceType,
        undefined, // No fixed workflow cost - costs come from Dify pricing
        true // Mark as auto-created
      );

      if (newModel) {
        console.log(`Successfully auto-created model config:`, newModel);
        
        // Notify about the new model creation (could trigger admin notification)
        this.onNewModelDetected?.(newModel);
        
        return newModel;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to auto-create model config for ${modelName}:`, error);
      return null;
    }
  }

  /**
   * Get default pricing for different model types
   */
  private getDefaultModelPricing(modelName: string): { inputTokenPrice: number; outputTokenPrice: number } {
    const name = modelName.toLowerCase();
    
    // Dify workflow models - use moderate pricing since actual costs come from Dify
    if (name === 'dify-workflow') {
      return { inputTokenPrice: 0.002, outputTokenPrice: 0.006 }; // Moderate default for workflow models
    }
    
    // GPT models
    if (name.includes('gpt-4o') || name.includes('gpt-4-turbo')) {
      return { inputTokenPrice: 0.01, outputTokenPrice: 0.03 }; // GPT-4 Turbo pricing
    }
    if (name.includes('gpt-4')) {
      return { inputTokenPrice: 0.03, outputTokenPrice: 0.06 }; // GPT-4 pricing
    }
    if (name.includes('gpt-3.5')) {
      return { inputTokenPrice: 0.001, outputTokenPrice: 0.002 }; // GPT-3.5 pricing
    }
    
    // Claude models
    if (name.includes('claude-3-opus')) {
      return { inputTokenPrice: 0.015, outputTokenPrice: 0.075 }; // Claude 3 Opus
    }
    if (name.includes('claude-3-sonnet')) {
      return { inputTokenPrice: 0.003, outputTokenPrice: 0.015 }; // Claude 3 Sonnet
    }
    if (name.includes('claude-3-haiku')) {
      return { inputTokenPrice: 0.00025, outputTokenPrice: 0.00125 }; // Claude 3 Haiku
    }
    if (name.includes('claude')) {
      return { inputTokenPrice: 0.003, outputTokenPrice: 0.015 }; // Default Claude pricing
    }
    
    // Gemini models
    if (name.includes('gemini-pro')) {
      return { inputTokenPrice: 0.0005, outputTokenPrice: 0.0015 }; // Gemini Pro
    }
    if (name.includes('gemini')) {
      return { inputTokenPrice: 0.0005, outputTokenPrice: 0.0015 }; // Default Gemini pricing
    }
    
    // Local or custom models - conservative pricing
    if (name.includes('llama') || name.includes('mistral') || name.includes('qwen')) {
      return { inputTokenPrice: 0.0002, outputTokenPrice: 0.0006 }; // Local model pricing
    }
    
    // Default for unknown models - moderate pricing
    console.log(`Using default pricing for unknown model: ${modelName}`);
    return { inputTokenPrice: 0.002, outputTokenPrice: 0.006 }; // Conservative default
  }

  /**
   * Set callback for when new models are detected
   */
  public setOnNewModelDetected(callback: (model: ModelConfig) => void) {
    this.onNewModelDetected = callback;
  }

  /**
   * Simulate a token consumption event for testing
   */
  public async simulateTokenConsumption(
    userId: string,
    modelName: string = 'gpt-4',
    inputTokens: number = 1000,
    outputTokens: number = 500
  ): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating token consumption event');
    
    const mockEvent: DifyMessageEndEvent = {
      event: 'message_end',
      conversation_id: `test_conv_${Date.now()}`,
      message_id: `test_msg_${Date.now()}`,
      user_id: userId,
      model_name: modelName,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      timestamp: new Date().toISOString(),
      metadata: {
        test: true,
        simulated: true
      }
    };

    await this.processTokenConsumption(mockEvent, userId);
  }

  /**
   * Simulate a real Dify usage event for testing (based on actual udify.app format)
   */
  public async simulateRealDifyUsage(
    userId: string,
    inputTokens: number = 2913,
    outputTokens: number = 686,
    inputPrice: number = 0.005826,
    outputPrice: number = 0.005488
  ): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating real Dify usage event');
    
    const totalTokens = inputTokens + outputTokens;
    const totalPrice = inputPrice + outputPrice;

    const mockEvent: DifyRealUsageEvent = {
      conversation_id: `test_real_conv_${Date.now()}`,
      message_id: `test_real_msg_${Date.now()}`,
      usage: {
        prompt_tokens: inputTokens,
        prompt_unit_price: "2",
        prompt_price_unit: "0.000001",
        prompt_price: inputPrice.toString(),
        completion_tokens: outputTokens,
        completion_unit_price: "8",
        completion_price_unit: "0.000001",
        completion_price: outputPrice.toString(),
        total_tokens: totalTokens,
        total_price: totalPrice.toString(),
        currency: "USD",
        latency: 2.6395470835268497
      },
      finish_reason: "stop",
      files: []
    };

    await this.processRealDifyUsage(mockEvent, userId);
  }
  public async simulateWorkflowTokenConsumption(
    userId: string,
    inputTokens: number = 2913,
    outputTokens: number = 701,
    inputPrice: number = 0.005826,
    outputPrice: number = 0.005608
  ): Promise<void> {
    console.log('[DifyIframeMonitor] Simulating workflow token consumption event');
    
    const totalTokens = inputTokens + outputTokens;
    const totalPrice = inputPrice + outputPrice;

    const mockEvent: DifyWorkflowFinishedEvent = {
      event: 'workflow_finished',
      conversation_id: `test_workflow_conv_${Date.now()}`,
      message_id: `test_workflow_msg_${Date.now()}`,
      data: {
        total_tokens: totalTokens,
        metadata: {
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens,
            prompt_price: inputPrice.toString(),
            completion_price: outputPrice.toString(),
            total_price: totalPrice.toString(),
            currency: 'USD'
          }
        }
      }
    };

    await this.processWorkflowTokenConsumption(mockEvent, userId);
  }

  /**
   * Test method to validate if a given origin would be accepted
   * Useful for debugging domain issues
   */
  public testOriginValidation(origin: string): boolean {
    console.log(`[DifyIframeMonitor] Testing origin validation for: ${origin}`);
    const result = this.isValidOrigin(origin);
    console.log(`[DifyIframeMonitor] Origin ${origin} is ${result ? 'VALID' : 'INVALID'}`);
    return result;
  }

  /**
   * Test method to simulate receiving a message from a specific origin
   * Useful for debugging real udify.app integration
   */
  public simulateMessageFromOrigin(
    origin: string, 
    userId: string, 
    messageData?: { event: string; data?: DifyMessageEndEvent | DifyWorkflowFinishedEvent }
  ): void {
    console.log(`[DifyIframeMonitor] Simulating message from origin: ${origin}`);
    
    const mockEvent = {
      origin: origin,
      data: messageData || {
        event: 'workflow_finished',
        conversation_id: `test_workflow_conv_${Date.now()}`,
        message_id: `test_workflow_msg_${Date.now()}`,
        data: {
          total_tokens: 3614,
          metadata: {
            usage: {
              prompt_tokens: 2913,
              completion_tokens: 701,
              total_tokens: 3614,
              prompt_price: "0.005826",
              completion_price: "0.005608",
              total_price: "0.011434",
              currency: "USD"
            }
          }
        }
      }
    } as MessageEvent;

    this.handleMessage(mockEvent, userId);
  }

  /**
   * Get current monitor status for debugging
   */
  public getStatus() {
    return {
      isListening: this.isListening,
      modelConfigsLoaded: this.modelConfigs.length,
      exchangeRate: this.currentExchangeRate,
      processedEventsCount: this.processedEvents.size,
      lastEventTime: this.lastEventTime
    };
  }
}

// Export singleton instance
export const difyIframeMonitor = new DifyIframeMonitor();