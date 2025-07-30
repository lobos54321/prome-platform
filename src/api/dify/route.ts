import { NextRequest, NextResponse } from 'next/server';
import { DifyClient } from '@/lib/dify-client';

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId, user } = await req.json();
    
    // 验证必需参数
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    if (!process.env.DIFY_API_KEY) {
      console.error('DIFY_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Chat service is not configured' },
        { status: 500 }
      );
    }
    
    const difyClient = new DifyClient(
      process.env.DIFY_API_KEY,
      process.env.DIFY_API_URL // 可选，如果使用自定义部署
    );
    
    // 只传递有效的 conversationId
    const result = await difyClient.sendMessage(
      message,
      conversationId && conversationId !== '' ? conversationId : undefined,
      user
    );
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Dify API error:', error);
    
    // 返回适当的错误状态码
    const statusCode = error.statusCode || 500;
    return NextResponse.json(
      { 
        error: error.message,
        code: error.code
      },
      { status: statusCode }
    );
  }
}

// 可选：添加 GET 方法获取对话历史
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get('user');
    
    if (!process.env.DIFY_API_KEY) {
      return NextResponse.json(
        { error: 'Chat service is not configured' },
        { status: 500 }
      );
    }
    
    const difyClient = new DifyClient(process.env.DIFY_API_KEY);
    const conversations = await difyClient.getConversations(user || undefined);
    
    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
