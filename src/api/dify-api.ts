// 完整的Dify API客户端 - API方式替代iframe方式
// 这将处理会话管理和多轮对话问题

// 响应类型定义
export interface DifyResponse {
  conversation_id?: string;
  message_id?: string;
  answer?: string;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  created_at?: string;
}

// 统计数据接口
export interface DifyUsageStats {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  lastUpdated: string;
}

// 本地存储的使用数据
let usageStats: DifyUsageStats = {
  totalRequests: 0,
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  lastUpdated: new Date().toISOString()
};

// 从localStorage加载使用统计数据
try {
  const savedStats = localStorage.getItem('dify_usage_stats');
  if (savedStats) {
    usageStats = JSON.parse(savedStats);
  }
} catch (e) {
  console.warn('Failed to load Dify usage stats from localStorage', e);
}

// 保存使用统计到localStorage
function saveUsageStats() {
  try {
    localStorage.setItem('dify_usage_stats', JSON.stringify(usageStats));
  } catch (e) {
    console.warn('Failed to save Dify usage stats to localStorage', e);
  }
}

// 更新使用统计
function updateUsageStats(usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }) {
  if (!usage) return;
  
  usageStats.totalRequests++;
  usageStats.totalTokens += usage.total_tokens || 0;
  usageStats.promptTokens += usage.prompt_tokens || 0;
  usageStats.completionTokens += usage.completion_tokens || 0;
  usageStats.lastUpdated = new Date().toISOString();
  
  saveUsageStats();
}

// 获取使用统计
export function getDifyUsageStats(): DifyUsageStats {
  return {...usageStats};
}

// 检查Dify是否启用
export const isDifyEnabled = (): boolean => {
  return true; // 假设始终启用，根据需要调整
};

// 发送消息（非流式）
export async function sendMessage(message: string, conversationId?: string): Promise<DifyResponse> {
  try {
    const response = await fetch('/api/dify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 更新使用统计
    if (data.usage) {
      updateUsageStats(data.usage);
    }
    
    return data;
  } catch (error) {
    console.error("Error sending message to Dify:", error);
    throw error;
  }
}

// 流式发送消息
export async function streamMessage(
  message: string, 
  conversationId?: string, 
  onMessage?: (chunk: string) => void, 
  onError?: (error: any) => void,
  onComplete?: (usage: DifyResponse['usage']) => void
): Promise<DifyResponse> {
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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    if (!response.body) throw new Error("No response body");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalResponse: DifyResponse = {};
    let fullAnswer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      try {
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // 处理回答内容
              if (data.answer) {
                if (onMessage) onMessage(data.answer);
                fullAnswer += data.answer;
              }
              
              // 保存会话ID和消息ID
              if (data.conversation_id) finalResponse.conversation_id = data.conversation_id;
              if (data.message_id) finalResponse.message_id = data.message_id;
              
              // 处理使用统计数据
              if (data.usage) {
                finalResponse.usage = data.usage;
                if (onComplete) onComplete(data.usage);
                updateUsageStats(data.usage);
              }
            } catch (parseError) {
              console.warn("Error parsing JSON from stream:", parseError);
            }
          }
        }
      } catch (e) {
        console.warn("Error processing chunk:", chunk, e);
        if (onMessage) onMessage(chunk);
      }
    }
    
    finalResponse.answer = fullAnswer;
    return finalResponse;
  } catch (error) {
    if (onError) onError(error);
    console.error("Error streaming message from Dify:", error);
    throw error;
  }
}
