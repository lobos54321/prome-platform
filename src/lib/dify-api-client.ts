/**
 * Dify API Client
 * 
 * Direct integration with Dify API to replace iframe approach and enable
 * accurate token monitoring and billing.
 */

import { generateUUID } from '@/lib/utils';

export interface DifyMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DifyUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_unit_price?: string;
  prompt_price_unit?: string;
  prompt_price?: string;
  completion_unit_price?: string;
  completion_price_unit?: string;
  completion_price?: string;
  total_price?: string;
  currency?: string;
}

export interface DifyResponse {
  answer: string;
  conversation_id: string;
  message_id: string;
  mode: string;
  metadata: {
    usage: DifyUsage;
    retriever_resources?: unknown[];
  };
  created_at: number;
}

export interface DifyStreamResponse {
  event: string;
  conversation_id?: string;
  message_id?: string;
  answer?: string;
  metadata?: {
    usage?: DifyUsage;
  };
  created_at?: number;
  data?: string;
  node_id?: string;
  node_name?: string;
  node_title?: string;
}

export interface DifyConversation {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  status: string;
  introduction: string;
  created_at: number;
  updated_at: number;
}

export interface DifyConversationHistoryResponse {
  limit: number;
  has_more: boolean;
  data: Array<{
    id: string;
    conversation_id: string;
    inputs: Record<string, unknown>;
    query: string;
    answer: string;
    message_files: unknown[];
    feedback: unknown | null;
    retriever_resources: unknown[];
    created_at: number;
    agent_thoughts: unknown[];
  }>;
}

export interface DifyAPIClientConfig {
  apiUrl: string;
  appId: string;
  apiKey: string;
  conversationExpiryHours?: number; // Default 24 hours
}

export interface ConversationMetadata {
  id: string;
  createdAt: number;
  lastUsed: number;
}

export class DifyAPIClient {
  private config: DifyAPIClientConfig;
  private readonly STORAGE_KEY = 'dify_conversation_metadata';

  constructor(config: DifyAPIClientConfig) {
    this.config = config;
  }

  /**
   * Store conversation metadata with timestamp
   */
  private storeConversationMetadata(conversationId: string): void {
    try {
      const now = Date.now();
      const metadata: ConversationMetadata = {
        id: conversationId,
        createdAt: now,
        lastUsed: now
      };
      
      // Store both individual conversation and update the list
      localStorage.setItem(`${this.STORAGE_KEY}_${conversationId}`, JSON.stringify(metadata));
      
      // Also maintain conversation ID in the old location for backward compatibility
      localStorage.setItem('dify_conversation_id', conversationId);
      
      console.log('💾 Stored conversation metadata:', { conversationId, createdAt: new Date(now).toISOString() });
    } catch (error) {
      console.warn('⚠️ Failed to store conversation metadata:', error);
    }
  }

  /**
   * Get conversation metadata from storage
   */
  private getConversationMetadata(conversationId: string): ConversationMetadata | null {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${conversationId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ Failed to retrieve conversation metadata:', error);
    }
    return null;
  }

  /**
   * Check if a conversation has expired
   */
  private isConversationExpired(metadata: ConversationMetadata): boolean {
    const expiryHours = this.config.conversationExpiryHours || 24;
    const expiryTime = metadata.lastUsed + (expiryHours * 60 * 60 * 1000);
    return Date.now() > expiryTime;
  }

  /**
   * Clean up expired conversations from storage
   */
  private cleanupExpiredConversations(): void {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(`${this.STORAGE_KEY}_`)) {
          const conversationId = key.replace(`${this.STORAGE_KEY}_`, '');
          const metadata = this.getConversationMetadata(conversationId);
          
          if (metadata && this.isConversationExpired(metadata)) {
            localStorage.removeItem(key);
            console.log('🧹 Cleaned up expired conversation:', conversationId);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup expired conversations:', error);
    }
  }

  /**
   * Validate if a conversation ID is still valid with Dify
   */
  private async validateConversationId(conversationId: string): Promise<boolean> {
    try {
      // Try to get conversation history to validate
      await this.getConversationHistory(conversationId, 'default-user', 1);
      return true;
    } catch (error) {
      console.log('❌ Conversation validation failed:', conversationId, error);
      return false;
    }
  }

  /**
   * Get a valid conversation ID, creating new one if needed
   */
  private async getOrCreateValidConversationId(requestedId?: string): Promise<string> {
    // Clean up expired conversations first
    this.cleanupExpiredConversations();

    if (requestedId) {
      const metadata = this.getConversationMetadata(requestedId);
      
      // Check if conversation exists in storage and hasn't expired
      if (metadata && !this.isConversationExpired(metadata)) {
        // Validate with Dify API
        const isValid = await this.validateConversationId(requestedId);
        if (isValid) {
          // Update last used time
          metadata.lastUsed = Date.now();
          localStorage.setItem(`${this.STORAGE_KEY}_${requestedId}`, JSON.stringify(metadata));
          return requestedId;
        } else {
          // Remove invalid conversation from storage
          localStorage.removeItem(`${this.STORAGE_KEY}_${requestedId}`);
        }
      }
    }

    // Create new conversation
    return await this.startNewConversation();
  }

  /**
   * Send a message to Dify via backend proxy and get response
   */
  async sendMessage(
    message: string, 
    conversationId?: string,
    user?: string,
    inputs?: Record<string, unknown>
  ): Promise<DifyResponse> {
    // If no conversationId provided, use a fallback
    const targetConversationId = conversationId || 'default';
    
    // Call backend API instead of Dify directly
    const response = await fetch(`/api/dify/${targetConversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user: user || 'default-user',
        inputs: inputs || {}
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle conversation not found errors
      if (response.status === 404 && errorData.error?.includes('Conversation')) {
        throw new Error('Conversation Not Exists. Starting new conversation.');
      }
      
      throw new Error(`Backend API error: ${response.status} - ${errorData.error || errorData.message || 'Unknown error'}`);
    }

    const result = await response.json();
    
    // Store metadata for new or validated conversations
    if (result.conversation_id) {
      // Store the conversation ID mapping
      this.storeConversationMetadata(result.conversation_id);
    }
    
    return result;
  }

  /**
   * Send a message with streaming response via backend proxy
   */
  async sendMessageStream(
    message: string,
    onChunk: (chunk: DifyStreamResponse) => void,
    conversationId?: string,
    user?: string,
    inputs?: Record<string, unknown>
  ): Promise<void> {
    // If no conversationId provided, use a fallback
    const targetConversationId = conversationId || 'default';

    // Call backend streaming API
    const response = await fetch(`/api/dify/${targetConversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user: user || 'default-user',
        inputs: inputs || {}
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle conversation errors for streaming
      if (response.status === 404 && errorData.error?.includes('Conversation')) {
        throw new Error('Conversation Not Exists. Starting new conversation.');
      }
      
      throw new Error(`Backend API error: ${response.status} - ${errorData.error || errorData.message || 'Unknown error'}`);
    }

    // Process streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let detectedConversationId: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Store metadata if we detected a new conversation ID
              if (detectedConversationId) {
                this.storeConversationMetadata(detectedConversationId);
                console.log('🆕 Started new conversation:', detectedConversationId);
              }
              return;
            }
            
            try {
              const parsed: DifyStreamResponse = JSON.parse(data);
              
              // Track conversation ID for storage
              if (parsed.conversation_id && !detectedConversationId) {
                detectedConversationId = parsed.conversation_id;
              }
              
              onChunk(parsed);
            } catch (error) {
              console.warn('Failed to parse streaming data:', data, error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    conversationId: string,
    user?: string,
    limit?: number
  ): Promise<DifyConversationHistoryResponse> {
    const params = new URLSearchParams({
      user: user || 'default-user',
      limit: (limit || 20).toString()
    });

    const response = await fetch(`${this.config.apiUrl}/messages?conversation_id=${conversationId}&${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get list of conversations
   */
  async getConversations(
    user?: string,
    limit?: number,
    pinned?: boolean
  ): Promise<{ limit: number; has_more: boolean; data: DifyConversation[] }> {
    const params = new URLSearchParams({
      user: user || 'default-user',
      limit: (limit || 20).toString()
    });

    if (pinned !== undefined) {
      params.set('pinned', pinned.toString());
    }

    const response = await fetch(`${this.config.apiUrl}/conversations?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Rename a conversation
   */
  async renameConversation(
    conversationId: string,
    name: string,
    user?: string
  ): Promise<{ result: string }> {
    const response = await fetch(`${this.config.apiUrl}/conversations/${conversationId}/name`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        user: user || 'default-user'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(
    conversationId: string,
    user?: string
  ): Promise<{ result: string }> {
    const response = await fetch(`${this.config.apiUrl}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: user || 'default-user'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Start a new conversation
   */
  async startNewConversation(): Promise<string> {
    const newConversationId = generateUUID();
    this.storeConversationMetadata(newConversationId);
    return newConversationId;
  }

  /**
   * Get app parameters (for understanding available inputs)
   */
  async getAppParameters(user?: string): Promise<{
    opening_statement: string;
    suggested_questions: string[];
    suggested_questions_after_answer: {
      enabled: boolean;
    };
    speech_to_text: {
      enabled: boolean;
    };
    text_to_speech: {
      enabled: boolean;
      voice: string;
    };
    retriever_resource: {
      enabled: boolean;
    };
    annotation_reply: {
      enabled: boolean;
    };
    user_input_form: Array<{
      text_input: {
        label: string;
        variable: string;
        required: boolean;
        max_length: number;
      };
    }>;
    file_upload: {
      image: {
        enabled: boolean;
        number_limits: number;
        detail: string;
        transfer_methods: string[];
      };
    };
    system_parameters: {
      image_file_size_limit: string;
    };
  }> {
    const params = new URLSearchParams({
      user: user || 'default-user'
    });

    const response = await fetch(`${this.config.apiUrl}/parameters?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }
}

/**
 * Create a configured Dify API client
 */
export function createDifyAPIClient(): DifyAPIClient {
  const config: DifyAPIClientConfig = {
    apiUrl: import.meta.env.VITE_DIFY_API_URL || '',
    appId: import.meta.env.VITE_DIFY_APP_ID || '',
    apiKey: import.meta.env.VITE_DIFY_API_KEY || '',
    conversationExpiryHours: 24, // Default 24 hours expiry
  };

  // Validate configuration
  if (!config.apiUrl || !config.appId || !config.apiKey) {
    throw new Error('Dify API configuration is incomplete. Please check environment variables.');
  }

  return new DifyAPIClient(config);
}

/**
 * Check if Dify integration is enabled and properly configured
 */
export function isDifyEnabled(): boolean {
  const enabled = import.meta.env.VITE_ENABLE_DIFY_INTEGRATION === 'true';
  const apiUrl = import.meta.env.VITE_DIFY_API_URL;
  const appId = import.meta.env.VITE_DIFY_APP_ID;
  const apiKey = import.meta.env.VITE_DIFY_API_KEY;

  return enabled && !!apiUrl && !!appId && !!apiKey;
}
