// 这是一个替代文件，将调用重定向到正确的API路由
import axios from 'axios';

// 定义响应类型
export interface DifyResponse {
  conversation_id?: string;
  message_id?: string;
  answer?: string;
  // 添加其他可能的字段
}

// 导出使用的函数
export async function sendMessage(message: string, conversationId?: string): Promise<DifyResponse> {
  try {
    // 调用正确路径的API
    const response = await axios.post('/api/dify', {
      message,
      conversation_id: conversationId
    });
    return response.data;
  } catch (error) {
    console.error("Error sending message to Dify:", error);
    throw error;
  }
}

export async function streamMessage(message: string, conversationId?: string, 
  onMessage?: (chunk: string) => void, onError?: (error: any) => void): Promise<DifyResponse> {
  try {
    const response = await fetch('/api/dify?stream=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId
      })
    });

    // 处理流式响应
    if (!response.body) throw new Error("No response body");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalResponse: DifyResponse = {};
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      try {
        // 尝试解析每个块
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            if (onMessage && data.answer) onMessage(data.answer);
            // 保存最后一个响应的会话ID
            if (data.conversation_id) finalResponse.conversation_id = data.conversation_id;
            if (data.message_id) finalResponse.message_id = data.message_id;
          }
        }
      } catch (e) {
        console.warn("Error parsing chunk:", chunk, e);
        if (onMessage) onMessage(chunk);
      }
    }
    
    return finalResponse;
  } catch (error) {
    if (onError) onError(error);
    console.error("Error streaming message from Dify:", error);
    throw error;
  }
}
