import { NextRequest, NextResponse } from 'next/server';
import { DifyClient } from '@/lib/dify-client';

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId, user } = await req.json();
    
    if (!process.env.DIFY_API_KEY) {
      throw new Error('DIFY_API_KEY is not configured');
    }
    
    const difyClient = new DifyClient(process.env.DIFY_API_KEY);
    
    // 只传递有效的 conversationId
    const result = await difyClient.sendMessage(
      message,
      conversationId && conversationId !== '' ? conversationId : undefined,
      user
    );
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Dify API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('404') ? 404 : 500 }
    );
  }
}
