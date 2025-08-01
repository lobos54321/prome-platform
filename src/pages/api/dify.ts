import type { NextApiRequest, NextApiResponse } from 'next';

// 存储会话状态
const conversationState = new Map<string, {
  conversationId: string;
  lastInteraction: number;
  userId: string;
}>();

// 定期清理过期会话（1小时不活动则过期）
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of conversationState.entries()) {
    if (now - session.lastInteraction > 3600000) { // 1小时
      conversationState.delete(key);
    }
  }
}, 300000); // 每5分钟检查一次

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 处理OPTIONS请求（CORS预检）
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // 仅接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversation_id, user_id = 'default-user' } = req.body;
    const isStream = req.query.stream === 'true';
    
    console.log(`[Dify API] 收到请求: ${message?.substring(0, 50)}... | 会话ID: ${conversation_id || '新会话'}`);

    // 获取或创建会话状态
    let sessionId = user_id;
    let conversationId = conversation_id;
    
    if (conversationId) {
      // 更新现有会话
      conversationState.set(sessionId, {
        conversationId,
        lastInteraction: Date.now(),
        userId: user_id
      });
      console.log(`[Dify API] 继续现有会话: ${conversationId}`);
    } else if (conversationState.has(sessionId)) {
      // 恢复之前的会话
      conversationId = conversationState.get(sessionId)?.conversationId;
      console.log(`[Dify API] 恢复会话: ${conversationId}`);
    }

    // 准备Dify API请求
    const difyUrl = `${process.env.DIFY_API_URL}/v1/chat-messages`;
    const headers = {
      'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // 关键修复：确保请求格式符合Dify工作流预期
    const payload = {
      inputs: {}, // 工作流的输入参数
      query: message, // 用户查询
      response_mode: isStream ? 'streaming' : 'blocking',
      conversation_id: conversationId,
      user: user_id
    };

    console.log(`[Dify API] 发送请求到: ${difyUrl}`);
    console.log(`[Dify API] 请求负载: ${JSON.stringify(payload)}`);

    if (isStream) {
      // 流式响应处理
      const difyResponse = await fetch(difyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!difyResponse.ok) {
        const errorText = await difyResponse.text();
        console.error(`[Dify API] 错误: ${difyResponse.status} ${errorText}`);
        return res.status(difyResponse.status).json({ 
          error: `Dify API error: ${difyResponse.status}`,
          details: errorText
        });
      }

      // 设置流响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 将Dify响应流转发到客户端
      const reader = difyResponse.body?.getReader();
      if (!reader) {
        return res.status(500).json({ error: 'Failed to read response stream' });
      }

      // 开始流式传输
      const encoder = new TextEncoder();
      
      // 保存会话ID以在流结束时更新
      let extractedConversationId: string | undefined;
      
      // 手动处理流
      try {
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          
          // 尝试提取conversation_id
          try {
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                if (data.conversation_id && !extractedConversationId) {
                  extractedConversationId = data.conversation_id;
                  // 更新会话状态
                  conversationState.set(sessionId, {
                    conversationId: extractedConversationId,
                    lastInteraction: Date.now(),
                    userId: user_id
                  });
                  console.log(`[Dify API] 从流中提取并保存会话ID: ${extractedConversationId}`);
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
          
          // 将原始块转发给客户端
          res.write(chunk);
          
          // 确保立即刷新
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
        
        res.end();
      } catch (streamError) {
        console.error("[Dify API] 流处理错误:", streamError);
        res.end();
      }
    } else {
      // 阻塞式响应
      const difyResponse = await fetch(difyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!difyResponse.ok) {
        const errorText = await difyResponse.text();
        console.error(`[Dify API] 错误: ${difyResponse.status} ${errorText}`);
        return res.status(difyResponse.status).json({ 
          error: `Dify API error: ${difyResponse.status}`,
          details: errorText
        });
      }
      
      const responseData = await difyResponse.json();
      
      // 保存或更新会话状态
      if (responseData.conversation_id) {
        conversationState.set(sessionId, {
          conversationId: responseData.conversation_id,
          lastInteraction: Date.now(),
          userId: user_id
        });
        console.log(`[Dify API] 保存新会话ID: ${responseData.conversation_id}`);
      }
      
      // 返回响应
      return res.status(200).json(responseData);
    }
  } catch (error: any) {
    console.error('[Dify API] 处理请求时出错:', error);
    return res.status(500).json({ 
      error: 'Error processing request', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
