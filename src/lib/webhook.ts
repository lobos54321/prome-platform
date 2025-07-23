import { WebhookPayload } from '@/types';
import { db } from './supabase';

// Enhanced webhook handler for processing Dify workflow callbacks
class WebhookHandler {
  private webhookUrl = '/api/webhook/dify';
  private apiKey = 'prome_wh_key_123456'; // In production, this should be in environment variables
  
  // Process incoming webhook from Dify
  async processWebhook(payload: WebhookPayload, signature: string): Promise<{success: boolean; message: string; scriptId?: string}> {
    try {
      // Use the database to process the webhook
      return await db.processWebhook(payload, signature);
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return { 
        success: false, 
        message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Get webhook URL
  getWebhookUrl(): string {
    return `${window.location.origin}${this.webhookUrl}`;
  }

  // Get API key for configuration
  getApiKey(): string {
    try {
      // For UI purposes, return a placeholder value
      // The real key will be retrieved from the database during webhook processing
      return this.apiKey;
    } catch (error) {
      console.error('Error getting API key:', error);
      return this.apiKey;
    }
  }

  // Update API key (admin function)
  async updateApiKey(newKey: string): Promise<void> {
    if (!newKey || newKey.length < 8) {
      throw new Error('API key must be at least 8 characters');
    }
    
    try {
      // Insert a new API key
      const { error } = await db.supabase
        .from('api_keys')
        .insert({
          name: 'Webhook Key',
          key: newKey,
          is_active: true
        });

      if (error) throw error;
      
      // Update existing keys to inactive
      await db.supabase
        .from('api_keys')
        .update({ is_active: false })
        .neq('key', newKey);
      
      // Update local reference
      this.apiKey = newKey;
    } catch (error) {
      console.error('Error updating API key:', error);
      throw error;
    }
  }

  // Simulate webhook call for testing
  async simulateWebhook(title: string, content: string, model: string = 'GPT-4'): Promise<void> {
    const user = await db.getCurrentUser();
    if (!user) return;

    const payload = {
      conversation_id: `conv_${Date.now()}`,
      user_id: user.id,
      query: title,
      response: { answer: content },
      model,
      metadata: {
        test_mode: true
      }
    };

    await this.processWebhook(payload, this.apiKey);
  }
}

export const webhookHandler = new WebhookHandler();