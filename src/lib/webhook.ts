import { WebhookPayload, DifyWebhookPayload } from '@/types';
import { db } from './supabase';
import { difyAPI } from '@/api/dify-api';

// Enhanced webhook handler for processing Dify workflow callbacks
class WebhookHandler {
  private webhookUrl = '/api/webhook/dify';
  private apiKey = 'prome_wh_key_123456'; // In production, this should be in environment variables
  
  // Process incoming webhook from Dify - enhanced for token consumption
  async processWebhook(payload: WebhookPayload | DifyWebhookPayload, signature: string): Promise<{success: boolean; message: string; scriptId?: string}> {
    try {
      // Validate inputs
      if (!payload) {
        console.error('WebhookHandler: processWebhook called with null/undefined payload');
        return { 
          success: false, 
          message: 'Invalid payload' 
        };
      }
      
      if (!signature) {
        console.error('WebhookHandler: processWebhook called with empty signature');
        return { 
          success: false, 
          message: 'Missing signature' 
        };
      }

      // Check if this is a Dify message_end event for token consumption
      if (this.isDifyTokenConsumptionEvent(payload)) {
        return await this.processDifyTokenConsumption(payload as DifyWebhookPayload, signature);
      }

      // Use the database to process legacy webhook format
      const result = await db.processWebhook(payload, signature);
      
      // Validate result structure
      if (result && typeof result === 'object') {
        return {
          success: result.success ?? false,
          message: result.message ?? 'Unknown result',
          scriptId: result.scriptId // scriptId can be undefined, which is fine
        };
      } else {
        console.error('WebhookHandler: db.processWebhook returned invalid result:', result);
        return { 
          success: false, 
          message: 'Invalid result from database processing' 
        };
      }
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return { 
        success: false, 
        message: 'Processing error: ' + (error instanceof Error ? error.message : 'Unknown error') 
      };
    }
  }

  // Process Dify token consumption webhook
  private async processDifyTokenConsumption(
    payload: DifyWebhookPayload, 
    signature: string
  ): Promise<{success: boolean; message: string; scriptId?: string}> {
    try {
      console.log('Processing Dify token consumption webhook:', payload);

      // Create headers object for API processing
      const headers = {
        'x-api-key': signature,
        'x-user-id': payload.data && typeof payload.data === 'object' && 'user_id' in payload.data 
          ? payload.data.user_id as string 
          : '',
        'x-service-id': 'dify-service' // Default service ID for Dify
      };

      // Process using the enhanced Dify API
      const result = await difyAPI.processWebhook(payload, headers);

      return {
        success: result.success,
        message: result.message,
        scriptId: result.data && typeof result.data === 'object' && 'consumptionId' in result.data 
          ? result.data.consumptionId as string 
          : undefined
      };
    } catch (error) {
      console.error('Dify token consumption processing failed:', error);
      return {
        success: false,
        message: 'Dify processing error: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  // Check if payload is a Dify message_end event
  private isDifyTokenConsumptionEvent(payload: WebhookPayload | DifyWebhookPayload): boolean {
    if (!payload || typeof payload !== 'object') return false;
    
    // Check for Dify webhook structure
    return 'event' in payload && 
           payload.event === 'message_end' &&
           'data' in payload &&
           payload.data &&
           typeof payload.data === 'object' &&
           'model_name' in payload.data &&
           'input_tokens' in payload.data &&
           'output_tokens' in payload.data;
  }

  // Get webhook URL
  getWebhookUrl(): string {
    try {
      // Validate that window.location exists (in browser environment)
      if (typeof window !== 'undefined' && window.location) {
        // 修复模板字符串 (对应之前的第77行)
        return window.location.origin + this.webhookUrl;
      } else {
        // Fallback for server-side or non-browser environments
        console.warn('WebhookHandler: window.location not available, returning relative URL');
        return this.webhookUrl;
      }
    } catch (error) {
      console.error('Error getting webhook URL:', error);
      // Return the base webhook URL as a fallback
      return this.webhookUrl;
    }
  }

  // Get API key for configuration
  getApiKey(): string {
    try {
      // For UI purposes, return a placeholder value
      // The real key will be retrieved from the database during webhook processing
      return this.apiKey || 'prome_wh_key_123456'; // Extra safety check
    } catch (error) {
      console.error('Error getting API key:', error);
      return 'prome_wh_key_123456'; // Safe fallback
    }
  }

  // Update API key (admin function)
  async updateApiKey(newKey: string): Promise<{success: boolean; message: string}> {
    // Validate input
    if (!newKey) {
      console.error('WebhookHandler: updateApiKey called with null/undefined newKey');
      return { 
        success: false, 
        message: 'API key is required' 
      };
    }
    
    if (typeof newKey !== 'string') {
      console.error('WebhookHandler: updateApiKey called with non-string newKey');
      return { 
        success: false, 
        message: 'API key must be a string' 
      };
    }
    
    if (newKey.length < 8) {
      console.error('WebhookHandler: updateApiKey called with too short newKey');
      return { 
        success: false, 
        message: 'API key must be at least 8 characters' 
      };
    }
    
    try {
      // Check if db.supabase exists and has the required methods
      if (!db || !db.supabase || !db.supabase.from) {
        throw new Error('Database client not properly initialized');
      }

      // Insert a new API key
      const { error: insertError } = await db.supabase
        .from('api_keys')
        .insert({
          name: 'Webhook Key',
          key: newKey,
          is_active: true,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('WebhookHandler: Error inserting new API key:', insertError);
        throw insertError;
      }
      
      // Update existing keys to inactive (except the new one)
      const { error: updateError } = await db.supabase
        .from('api_keys')
        .update({ is_active: false })
        .neq('key', newKey);
      
      if (updateError) {
        console.warn('WebhookHandler: Warning - could not deactivate old keys:', updateError);
        // Don't throw here, as the main operation (inserting new key) succeeded
      }
      
      // Update local reference
      this.apiKey = newKey;
      
      return { 
        success: true, 
        message: 'API key updated successfully' 
      };
    } catch (error) {
      console.error('Error updating API key:', error);
      // 修复模板字符串 (对应之前的第137行)
      return { 
        success: false, 
        message: 'Update failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      };
    }
  }

  // Simulate webhook call for testing
  async simulateWebhook(title: string, content: string, model: string = 'GPT-4'): Promise<{success: boolean; message: string}> {
    // Validate inputs
    if (!title) {
      console.error('WebhookHandler: simulateWebhook called with empty title');
      return { 
        success: false, 
        message: 'Title is required' 
      };
    }
    
    if (!content) {
      console.error('WebhookHandler: simulateWebhook called with empty content');
      return { 
        success: false, 
        message: 'Content is required' 
      };
    }
    
    if (typeof model !== 'string') {
      console.warn('WebhookHandler: simulateWebhook called with non-string model, using default');
      model = 'GPT-4';
    }

    try {
      const user = await db.getCurrentUser();
      
      // Check if user exists
      if (!user) {
        console.warn('WebhookHandler: simulateWebhook called when no user is logged in');
        return { 
          success: false, 
          message: 'No user logged in' 
        };
      }
      
      // Validate user object
      if (!user.id) {
        console.error('WebhookHandler: simulateWebhook got user without ID:', user);
        return { 
          success: false, 
          message: 'Invalid user data' 
        };
      }

      const payload: WebhookPayload = {
        // 修复模板字符串 (对应之前的第181行)
        conversation_id: 'conv_' + Date.now(),
        user_id: user.id,
        query: title,
        response: { answer: content },
        model: model || 'GPT-4', // Ensure model is never empty
        metadata: {
          test_mode: true
        }
      };

      const result = await this.processWebhook(payload, this.apiKey);
      
      // Return a simplified result
      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      console.error('Error simulating webhook:', error);
      // 修复模板字符串 (对应之前的第201行)
      return { 
        success: false, 
        message: 'Simulation failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      };
    }
  }
}

export const webhookHandler = new WebhookHandler();

