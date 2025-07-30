// 完善的 Dify 客户端实现
import { DifyResponse, DifyError } from '@/types/dify';

export class DifyClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, baseUrl: string = 'https://api.dify.ai/v1') {
    if (!apiKey) {
      throw new Error('Dify API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾的斜杠
  }
  
  async sendMessage(message: string, conversationId?: string, user?: string): Promise<DifyResponse> {
    const url = `${this.baseUrl}/chat-messages`;
    
    const payload: any = {
      inputs: {},
      query: message,
      response_mode: 'blocking',
      user: user || 'default-user'
    };
    
    // 只有在 conversationId 存在且非空时才添加到 payload
    if (conversationId && conversationId.trim() !== '') {
      payload.conversation_id = conversationId;
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new DifyError(
          data.message || 'Unknown error',
          response.status,
          data.code
        );
      }
      
      return data;
    } catch (error) {
      if (error instanceof DifyError) {
        throw error;
      }
      throw new Error(`Network error: ${error.message}`);
    }
  }
  
  // 添加其他可能需要的方法
  async getConversations(user?: string) {
    const url = `${this.baseUrl}/conversations`;
    const params = new URLSearchParams();
    if (user) params.append('user', user);
    
    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get conversations: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// 自定义错误类
export class DifyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'DifyError';
  }
}
