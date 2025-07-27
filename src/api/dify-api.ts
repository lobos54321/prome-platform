import { DifyWebhookPayload } from '@/types';

/**
 * Simplified Dify API
 * Basic webhook processing without complex token tracking
 */
export class DifyAPI {
  
  /**
   * Basic webhook processing - simplified from complex token consumption system
   */
  async processWebhook(
    payload: DifyWebhookPayload,
    headers: Record<string, string>
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    try {
      // Basic API key validation
      const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
      if (!apiKey) {
        return { success: false, message: 'Missing API key' };
      }

      // Log webhook received (basic processing)
      console.log('Dify webhook received:', {
        event: payload.event,
        timestamp: new Date().toISOString(),
        hasData: !!payload.data
      });

      // Simple success response
      return {
        success: true,
        message: 'Webhook processed successfully',
        data: { processedAt: new Date().toISOString() }
      };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return {
        success: false,
        message: `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const difyAPI = new DifyAPI();

// Simple helper for checking if Dify integration is enabled
export const isDifyEnabled = () => {
  return import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true';
};