// 这是您现有的文件，我们需要更新它
import { DifyResponse, DifyStreamResponse } from './dify-types';

export class DifyClient {
  private apiKey: string;
  private baseUrl: string;
  private conversationStore: Map<string, string> = new Map(); // 添加会话存储

  constructor(apiKey: string, baseUrl: string = 'https://api.dify.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(
    query: string, 
    user: string, 
    conversationId?: string,
    inputs?: Record<string, any>
  ): Promise<DifyResponse> {
    try {
      // 使用存储的 conversation_id 或传入的
      const actualConversationId = conversationId || this.conversationStore.get(user);
      
      const payload = {
        inputs: inputs || {},
        query: query,
        response_mode: 'blocking',
        user: user,
        ...(actualConversationId && { conversation_id: actualConversationId })
      };

      console.log('[Dify Client] Chat Request:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dify API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[Dify Client] Chat Response:', JSON.stringify(data, null, 2));

      // 保存 conversation_id
      if (data.conversation_id) {
        this.conversationStore.set(user, data.conversation_id);
      }

      return data;
    } catch (error) {
      console.error('[Dify Client] Chat Error:', error);
      throw error;
    }
  }

  async chatStream(
    query: string, 
    user: string, 
    conversationId?: string,
    inputs?: Record<string, any>
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    try {
      const actualConversationId = conversationId || this.conversationStore.get(user);
      
      const payload = {
        inputs: inputs || {},
        query: query,
        response_mode: 'streaming',
        user: user,
        ...(actualConversationId && { conversation_id: actualConversationId })
      };

      console.log('[Dify Client] Stream Request:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Dify API error: ${response.status}`);
      }

      // 注意：流式响应中也需要处理 conversation_id
      // 这需要在解析流数据时处理

      return response.body!.getReader();
    } catch (error) {
      console.error('[Dify Client] Stream Error:', error);
      throw error;
    }
  }

  // 新增：工作流运行方法
  async workflowRun(
    query: string,
    user: string,
    conversationId?: string,
    inputs?: Record<string, any>
  ): Promise<DifyResponse> {
    try {
      const actualConversationId = conversationId || this.conversationStore.get(user);
      
      const payload = {
        inputs: {
          ...inputs,
          query: query, // 确保 query 在 inputs 中
        },
        response_mode: 'blocking',
        user: user,
        ...(actualConversationId && { conversation_id: actualConversationId })
      };

      console.log('[Dify Client] Workflow Request:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Workflow API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[Dify Client] Workflow Response:', JSON.stringify(data, null, 2));

      // 保存 workflow 的 conversation_id
      if (data.data?.conversation_id) {
        this.conversationStore.set(user, data.data.conversation_id);
      }

      return data;
    } catch (error) {
      console.error('[Dify Client] Workflow Error:', error);
      throw error;
    }
  }

  // 新增：清除会话
  clearConversation(user: string) {
    this.conversationStore.delete(user);
  }

  // 新增：获取存储的会话ID
  getConversationId(user: string): string | undefined {
    return this.conversationStore.get(user);
  }
}

// 导出单例
export const difyClient = new DifyClient(
  process.env.NEXT_PUBLIC_DIFY_API_KEY || '',
  process.env.NEXT_PUBLIC_DIFY_API_URL
);
