/**
 * Simplified Dify API
 * Basic configuration and status checking for iframe integration
 */
export class DifyAPI {
  
  /**
   * Check if Dify iframe integration is enabled
   */
  isEnabled(): boolean {
    return import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true';
  }

  /**
   * Get supported origins for iframe communication
   */
  getSupportedOrigins(): string[] {
    const origins = [
      'https://dify.ai',
      'https://cloud.dify.ai',
      'https://app.dify.ai',
      window.location.origin, // Allow same-origin for testing
    ];

    // For development: also allow localhost and development origins
    if (import.meta.env.DEV) {
      origins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173');
    }

    return origins;
  }
}

// Export singleton instance
export const difyAPI = new DifyAPI();

// Simple helper for checking if Dify integration is enabled
export const isDifyEnabled = () => {
  return difyAPI.isEnabled();
};