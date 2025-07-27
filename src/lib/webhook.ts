import { WebhookPayload, DifyWebhookPayload } from '@/types';
import { db } from './supabase';

/**
 * Simplified webhook handler for basic Dify integration
 * Removed complex configuration and testing features
 */
class WebhookHandler {
  private webhookUrl = '/api/webhook/dify';
  private apiKey = import.meta.env.VITE_WEBHOOK_API_KEY || 'prome_wh_key_default';
  
  // Simple webhook processing - removed complex validation and Dify-specific logic
  async processWebhook(payload: WebhookPayload | DifyWebhookPayload, signature: string): Promise<{success: boolean; message: string; scriptId?: string}> {
    try {
      // Basic validation
      if (!payload || !signature) {
        return { 
          success: false, 
          message: 'Invalid payload or signature' 
        };
      }

      // Simple API key validation
      if (signature !== this.apiKey) {
        return { 
          success: false, 
          message: 'Invalid API key' 
        };
      }

      // Check if database is available
      if (!db || !db.processWebhook) {
        console.warn('Database not available, webhook processing skipped');
        return { 
          success: true, 
          message: 'Webhook received but database not configured' 
        };
      }

      // Process webhook using basic database call
      const result = await db.processWebhook(payload, signature);
      
      return {
        success: result?.success ?? true,
        message: result?.message ?? 'Webhook processed',
        scriptId: result?.scriptId
      };
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return { 
        success: false, 
        message: 'Processing error: ' + (error instanceof Error ? error.message : 'Unknown error') 
      };
    }
  }

  // Simple URL getter
  getWebhookUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin + this.webhookUrl;
    }
    return this.webhookUrl;
  }

  // Simple API key getter
  getApiKey(): string {
    return this.apiKey;
  }
}

export const webhookHandler = new WebhookHandler();

