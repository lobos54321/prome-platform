// 修改前端API客户端，使用相对路径而非绝对路径
// 定义响应类型
export interface DifyResponse {
  conversation_id?: string;
  message_id?: string;
  answer?: string;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
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

// 直接调用Dify API的函数
// 这将绕过我们的API路由，直接调用Dify
export async function callDifyDirectly(message: string, conversationId?: string): Promise<DifyResponse> {
  try {
    // 这里需要从环境变量或配置中获取Dify API密钥和URL
    // 在浏览器端无法安全获取服务器端环境变量，所以这只是一个示例
    // 实际项目中应该通过后端API代理这个请求
    const apiKey = 'your-dify-api-key'; // 不要直接在前端暴露API密钥
    const apiUrl = 'https://api.dify.ai/v1/chat-messages';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: 'blocking',
        conversation_id: conversationId,
        user: 'user-id'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error calling Dify directly:", error);
    throw error;
  }
}

// 发送消息（非流式）
export async function sendMessage(message: string, conversationId?: string): Promise<DifyResponse> {
  try {
    // 使用相对路径，而不是绝对路径
    // 或者，如果您的网站托管在子路径下，可能需要调整
    const apiPath = window.location.origin + '/api/dify';
    console.log(`[Dify Client] 发送请求到: ${apiPath}`);
    
    const response = await fetch(apiPath, {
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
      const errorText = await response.text();
      console.error(`[Dify Client] API错误 (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}...`);
    }
    
    try {
      const data = await response.json();
      
      // 更新使用统计
      if (data.usage) {
        updateUsageStats(data.usage);
      }
      
      return data;
    } catch (parseError) {
      console.error("[Dify Client] JSON解析错误:", await response.text());
      throw new Error("Invalid JSON response");
    }
  } catch (error) {
    console.error("[Dify Client] 发送消息错误:", error);
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
    // 使用相对路径
    const apiPath = window.location.origin + '/api/dify?stream=true';
    console.log(`[Dify Client] 发送流请求到: ${apiPath}`);
    
    const response = await fetch(apiPath, {
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
      const errorText = await response.text();
      console.error(`[Dify Client] API流错误 (${response.status}):`, errorText);
      throw new Error(`API stream error: ${response.status} - ${errorText.substring(0, 100)}...`);
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
    console.error("[Dify Client] 流消息错误:", error);
    throw error;
  }
}
