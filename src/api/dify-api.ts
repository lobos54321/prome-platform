/**
 * Simplified Dify API Client for Frontend
 * Calls backend proxy endpoints instead of direct Dify API calls
 */

// 定义响应类型
export interface DifyResponse {
  conversation_id?: string;
  message_id?: string;
  answer?: string;
  metadata?: {
    usage?: {
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
    };
  };
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

// 尝试从localStorage加载使用统计数据
try {
  if (typeof window !== 'undefined') {
    const savedStats = localStorage.getItem('dify_usage_stats');
    if (savedStats) {
      usageStats = JSON.parse(savedStats);
    }
  }
} catch (e) {
  console.warn('Failed to load Dify usage stats from localStorage', e);
}

// 保存使用统计到localStorage
function saveUsageStats() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dify_usage_stats', JSON.stringify(usageStats));
    }
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
  return true; // 假设始终启用
};

// 发送消息（非流式） - 简化版本
export async function sendMessage(message: string, conversationId?: string, inputs?: Record<string, unknown>): Promise<DifyResponse> {
  try {
    console.log(`[Dify Client] 发送请求，消息长度: ${message.length}, 会话ID: ${conversationId || '新会话'}`);
    
    const response = await fetch('/api/dify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        query: message, // 支持两种字段名
        conversation_id: conversationId,
        inputs: inputs || {}
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Dify Client] API错误 (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}...`);
    }
    
    const data = await response.json();
    
    // 更新使用统计
    if (data.metadata?.usage) {
      updateUsageStats(data.metadata.usage);
    }
    
    console.log(`[Dify Client] 响应成功，答案长度: ${data.answer?.length || 0}`);
    return data;
  } catch (error) {
    console.error("[Dify Client] 发送消息错误:", error);
    throw error;
  }
}

// 流式发送消息 - 简化版本
export async function streamMessage(
  message: string, 
  conversationId?: string, 
  onMessage?: (chunk: string) => void, 
  onError?: (error: Error) => void,
  onComplete?: (usage: DifyResponse['metadata']) => void,
  inputs?: Record<string, unknown>
): Promise<DifyResponse> {
  try {
    console.log(`[Dify Client] 发送流请求，消息长度: ${message.length}, 会话ID: ${conversationId || '新会话'}`);
    
    // 使用通用的Dify API端点，让服务器决定使用哪种模式
    const response = await fetch('/api/dify/workflow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        query: message, // 支持两种字段名  
        conversation_id: conversationId,
        inputs: inputs || {},
        stream: true // 明确指定要流式响应
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Dify Client] API流错误 (${response.status}):`, errorText);
      throw new Error(`API stream error: ${response.status} - ${errorText.substring(0, 100)}...`);
    }

    if (!response.body) throw new Error("No response body");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const finalResponse: DifyResponse = {};
    let fullAnswer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      try {
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (dataStr === '[DONE]') {
              // 流结束
              if (onComplete && finalResponse.metadata) {
                onComplete(finalResponse.metadata);
              }
              finalResponse.answer = fullAnswer;
              return finalResponse;
            }
            
            try {
              const data = JSON.parse(dataStr);
              
              // 处理回答内容
              if (data.answer) {
                if (onMessage) onMessage(data.answer);
                fullAnswer += data.answer;
              }
              
              // 保存会话ID和消息ID
              if (data.conversation_id) finalResponse.conversation_id = data.conversation_id;
              if (data.message_id) finalResponse.message_id = data.message_id;
              
              // 处理使用统计数据
              if (data.metadata?.usage) {
                finalResponse.metadata = data.metadata;
                updateUsageStats(data.metadata.usage);
              }
            } catch (parseError) {
              console.warn("Error parsing JSON from stream:", parseError, dataStr);
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
    console.error("[Dify Client] 流消息错误:", error);
    throw error;
  }
}
