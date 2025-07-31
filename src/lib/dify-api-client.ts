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
}

export class DifyAPIClient {
  private config: DifyAPIClientConfig;

  constructor(config: DifyAPIClientConfig) {
    this.config = config;
  }



  /**
   * Send a message to Dify and get response
   */
  async sendMessage(
    message: string, 
    conversationId?: string,
    user?: string,
    inputs?: Record<string, unknown>
  ): Promise<DifyResponse> {
    const response = await fetch(`${this.config.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs || {},
        query: message,
        response_mode: 'blocking',
        conversation_id: conversationId || undefined,
        user: user || 'default-user',
        files: []
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Special handling for conversation ID format errors
      if (response.status === 400 && errorText.includes('not a valid uuid')) {
        throw new Error('Conversation ID format error. Please start a new conversation.');
      }
      
      // Handle conversation not found errors
      if (response.status === 404 && errorText.includes('Conversation')) {
        throw new Error('Conversation Not Exists. Starting new conversation.');
      }
      
      throw new Error(`Dify API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Send a message with streaming response
   */
  async sendMessageStream(
    message: string,
    onChunk: (chunk: DifyStreamResponse) => void,
    conversationId?: string,
    user?: string,
    inputs?: Record<string, unknown>
  ): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs || {},
        query: message,
        response_mode: 'streaming',
        conversation_id: conversationId || undefined,
        user: user || 'default-user',
        files: []
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle conversation errors for streaming
      if (response.status === 404 && errorText.includes('Conversation')) {
        throw new Error('Conversation Not Exists. Starting new conversation.');
      }
      
      throw new Error(`Dify API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    
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
              return;
            }
            
            try {
              const parsed: DifyStreamResponse = JSON.parse(data);
              onChunk(parsed);
            } catch (e) {
              console.warn('Failed to parse stream chunk:', data);
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
    // Dify doesn't have explicit "start conversation" endpoint
    // Conversations are created automatically when sending first message
    // Return a proper UUID v4 identifier for tracking
    return generateUUID();
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
