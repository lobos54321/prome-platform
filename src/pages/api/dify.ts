// 创建这个新文件：pages/api/dify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { difyClient } from '@/lib/dify-client';

// 存储会话状态
const conversationState = new Map<string, {
  conversationId: string;
  lastInteraction: number;
  context: any;
}>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只允许 POST 请求
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET 请求用于测试
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok',
      message: 'Dify API route is working',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const { query, user, conversation_id, inputs = {}, mode = 'chat' } = req.body;

    console.log('[API Route] Received request:', { query, user, conversation_id, mode });

    if (!query || !user) {
      return res.status(400).json({ error: 'Query and user are required' });
    }

    // 获取或使用会话ID
    let conversationId = conversation_id;
    const sessionState = conversationState.get(user);
    
    if (!conversationId && sessionState) {
      conversationId = sessionState.conversationId;
    }

    console.log('=== Dify Route Debug ===');
    console.log('Mode:', mode);
    console.log('User:', user);
    console.log('Query:', query);
    console.log('Conversation ID:', conversationId || 'New');
    console.log('Inputs:', inputs);

    let response;
    
    // 根据模式选择不同的 API
    if (mode === 'workflow') {
      response = await difyClient.workflowRun(query, user, conversationId, inputs);
    } else {
      response = await difyClient.chat(query, user, conversationId, inputs);
    }

    console.log('[API Route] Dify response:', response);

    // 更新会话状态
    const responseConversationId = response.conversation_id || response.data?.conversation_id;
    if (responseConversationId) {
      conversationState.set(user, {
        conversationId: responseConversationId,
        lastInteraction: Date.now(),
        context: response.data?.outputs || {}
      });
    }

    // 提取答案
    const answer = response.data?.outputs?.answer || 
                   response.data?.outputs?.text || 
                   response.answer ||
                   'No response';

    return res.status(200).json({
      answer,
      conversation_id: responseConversationId,
      metadata: {
        workflow_run_id: response.data?.workflow_run_id,
        elapsed_time: response.data?.elapsed_time,
        total_tokens: response.data?.total_tokens || response.usage?.total_tokens,
        created_at: response.data?.created_at || response.created_at,
      }
    });
  } catch (error) {
    console.error('[API Route] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

// 清理超时的会话
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30分钟超时
    
    for (const [user, state] of conversationState.entries()) {
      if (now - state.lastInteraction > timeout) {
        conversationState.delete(user);
        console.log(`Cleared timeout session for user: ${user}`);
      }
    }
  }, 5 * 60 * 1000); // 每5分钟检查一次
}
