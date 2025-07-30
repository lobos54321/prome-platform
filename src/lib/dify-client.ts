export class DifyClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, baseUrl: string = 'https://api.dify.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  async sendMessage(message: string, conversationId?: string, user?: string) {
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
    // 如果没有 conversationId，Dify 会自动创建新对话
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Dify API error: ${response.status} - ${JSON.stringify(error)}`);
    }
    
    return response.json();
  }
}
