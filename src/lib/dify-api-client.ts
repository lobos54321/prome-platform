/**
 * Dify API Client
 * 
 * Direct integration with Dify API to replace iframe approach and enable
 * accurate token monitoring and billing.
 */

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
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
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
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onChunk(data);
            } catch (error) {
              console.warn('Failed to parse streaming response:', line, error);
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
      conversation_id: conversationId,
      user: user || 'default-user',
      limit: (limit || 20).toString()
    });

    const response = await fetch(`${this.config.apiUrl}/messages?${params}`, {
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
   * Get conversations list
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
    // Return a unique identifier for tracking
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      language: string;
    };
    retriever_resource: {
      enabled: boolean;
    };
    annotation_reply: {
      enabled: boolean;
    };
    user_input_form: Array<{
      paragraph?: {
        label: string;
        variable: string;
        required: boolean;
        default: string;
      };
      select?: {
        label: string;
        variable: string;
        required: boolean;
        default: string;
        options: string[];
      };
      text_input?: {
        label: string;
        variable: string;
        required: boolean;
        max_length: number;
        default: string;
      };
      external_data_tool?: {
        label: string;
        variable: string;
        required: boolean;
        type: string;
        config: Record<string, unknown>;
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
 * Create a configured Dify API client using environment variables
 */
export function createDifyAPIClient(): DifyAPIClient {
  const apiUrl = import.meta.env.VITE_DIFY_API_URL;
  const appId = import.meta.env.VITE_DIFY_APP_ID;
  const apiKey = import.meta.env.VITE_DIFY_API_KEY;

  if (!apiUrl || !appId || !apiKey) {
    throw new Error('Dify API configuration missing. Please set VITE_DIFY_API_URL, VITE_DIFY_APP_ID, and VITE_DIFY_API_KEY environment variables.');
  }

  return new DifyAPIClient({
    apiUrl,
    appId,
    apiKey
  });
}

/**
 * Default client instance
 */
export const difyAPIClient = createDifyAPIClient();