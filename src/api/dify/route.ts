// 更新您现有的路由文件
import { NextRequest, NextResponse } from 'next/server';
import { difyClient } from '@/lib/dify-client';

// 存储会话状态（在生产环境中应该使用 Redis 或数据库）
const conversationState = new Map<string, {
  conversationId: string;
  lastInteraction: number;
  context: any;
}>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, user, conversation_id, inputs = {}, mode = 'chat' } = body;

    if (!query || !user) {
      return NextResponse.json(
        { error: 'Query and user are required' },
        { status: 400 }
      );
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

    return NextResponse.json({
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
    console.error('Dify Route Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Dify API is running' });
}

// 清理超时的会话
if (typeof window === 'undefined') { // 只在服务器端运行
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
