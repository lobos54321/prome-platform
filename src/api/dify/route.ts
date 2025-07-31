import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DIFY_API_KEY, DIFY_API_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '@/lib/config'
import { saveMessages } from '@/lib/save-messages'

export async function POST(request: Request, { params }: { params: { conversationId: string } }) {
  try {
    const { message } = await request.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 查找当前会话的 dify_conversation_id
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', params.conversationId)
      .single()

    let difyConversationId = conversationRow?.dify_conversation_id || null

    const requestBody: any = {
      inputs: {},
      query: message,
      response_mode: 'blocking',
      user: 'default-user'
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
        // 不直接 return，继续往下走，让 chat-messages 创建新对话
      }
    }

    // 发送消息到 Dify
    let response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    // 如果是对话不存在的错误，尝试去掉 conversation_id 再试一次
    if (!response.ok) {
      const errorData = await response.json()
      console.error('Dify API error:', errorData)

      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('Retrying without conversation_id')
        delete requestBody.conversation_id

        response = await fetch(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        // 如果重试依然失败，返回错误
        if (!response.ok) {
          const retryErrorData = await response.json()
          return NextResponse.json(
            { error: retryErrorData.message || 'Dify API error', detail: retryErrorData },
            { status: response.status }
          )
        }
      } else {
        return NextResponse.json(
          { error: errorData.message || 'Dify API error', detail: errorData },
          { status: response.status }
        )
      }
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
