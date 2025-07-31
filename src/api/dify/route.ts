import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createBrowserClient } from '@/lib/supabase/browser-client'

const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1'
const DIFY_API_KEY = process.env.DIFY_API_KEY

export async function POST(
  request: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createBrowserClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, inputs = {} } = await request.json()

    // 获取对话信息
    const { data: conversation } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', params.conversationId)
      .single()

    let difyConversationId = conversation?.dify_conversation_id

    // 构建请求体
    const requestBody: any = {
      inputs,
      query: message,
      user: user.id,
      response_mode: 'blocking',
    }

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId) {
      // 先验证对话是否仍然存在
      const checkResponse = await fetch(`${DIFY_API_URL}/conversations/${difyConversationId}`, {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
        },
      })

      if (checkResponse.ok) {
        requestBody.conversation_id = difyConversationId
      } else {
        // 对话不存在，清除无效的 ID
        console.log('Dify conversation not found, creating new one')
        difyConversationId = null
        await supabase
          .from('conversations')
          .update({ dify_conversation_id: null })
          .eq('id', params.conversationId)
      }
    }

    // 调用 Dify API
    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Dify API error:', errorData)
      
      // 如果是对话不存在的错误，尝试创建新对话
      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('Retrying without conversation_id')
        delete requestBody.conversation_id
        
        const retryResponse = await fetch(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!retryResponse.ok) {
          const retryError = await retryResponse.json()
          return NextResponse.json(retryError, { status: retryResponse.status })
        }

        const retryData = await retryResponse.json()
        
        // 保存新的 conversation_id
        if (retryData.conversation_id) {
          await supabase
            .from('conversations')
            .update({ dify_conversation_id: retryData.conversation_id })
            .eq('id', params.conversationId)
        }

        // 保存消息
        await saveMessages(supabase, params.conversationId, message, retryData)
        
        return NextResponse.json({
          answer: retryData.answer,
          conversation_id: retryData.conversation_id,
          message_id: retryData.message_id,
        })
      }
      
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()

    // 如果是新对话，保存 Dify 的 conversation_id
    if (!difyConversationId && data.conversation_id) {
      await supabase
        .from('conversations')
        .update({ dify_conversation_id: data.conversation_id })
        .eq('id', params.conversationId)
    }

    // 保存消息
    await saveMessages(supabase, params.conversationId, message, data)

    return NextResponse.json({
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function saveMessages(supabase: any, conversationId: string, userMessage: string, difyResponse: any) {
  const messages = [
    {
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    },
    {
      conversation_id: conversationId,
      role: 'assistant',
      content: difyResponse.answer,
      created_at: new Date().toISOString(),
      metadata: {
        message_id: difyResponse.message_id,
        tokens: difyResponse.metadata?.usage,
      },
    },
  ]

  await supabase.from('messages').insert(messages)
}
