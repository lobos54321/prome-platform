import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// 初始化 Stripe，确保 Zeabur 或本地 .env 设置了 STRIPE_SECRET_KEY
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());

// Configuration from environment variables
const DIFY_API_URL = process.env.VITE_DIFY_API_URL || process.env.DIFY_API_URL || '';
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY || process.env.DIFY_API_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Utility function to save messages
async function saveMessages(supabase, conversationId, userMessage, difyResponse) {
  try {
    // Save user message
    const { error: userError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      });

    if (userError) {
      console.error('Error saving user message:', userError);
      return;
    }

    // Save assistant message
    const { error: assistantError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: difyResponse.answer,
        dify_message_id: difyResponse.message_id,
        token_usage: difyResponse.metadata?.usage || null,
        created_at: new Date().toISOString()
      });

    if (assistantError) {
      console.error('Error saving assistant message:', assistantError);
      return;
    }

    console.log('✅ Messages saved successfully');
  } catch (error) {
    console.error('Error in saveMessages:', error);
  }
}

// Dify chat proxy API (streaming)
app.post('/api/dify/:conversationId/stream', async (req, res) => {
  try {
    const { message } = req.body;
    const { conversationId } = req.params;
    
    if (!DIFY_API_URL || !DIFY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing required environment variables' });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 查找当前会话的 dify_conversation_id
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .single();

    let difyConversationId = conversationRow?.dify_conversation_id || null;

    const requestBody = {
      inputs: {},
      query: message,
      response_mode: 'streaming',
      user: 'default-user'
    };

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId) {
      requestBody.conversation_id = difyConversationId;
    }

    // 发送消息到 Dify
    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);
      return res.status(response.status).json({
        error: errorData.message || 'Dify API error',
        detail: errorData
      });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Pipe the streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'No response body reader available' });
    }

    const decoder = new TextDecoder();
    let fullAnswer = '';
    let finalData = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Save messages to database
              if (finalData) {
                await saveMessages(supabase, conversationId, message, finalData);
                
                // Update conversation mapping if needed
                if (!difyConversationId && finalData.conversation_id) {
                  await supabase
                    .from('conversations')
                    .update({ dify_conversation_id: finalData.conversation_id })
                    .eq('id', conversationId);
                }
              }
              
              res.write(`data: [DONE]\n\n`);
              res.end();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Collect answer content and final data
              if (parsed.event === 'message' && parsed.answer) {
                fullAnswer += parsed.answer;
              } else if (parsed.event === 'message_end') {
                finalData = {
                  answer: fullAnswer,
                  conversation_id: parsed.conversation_id,
                  message_id: parsed.message_id,
                  metadata: parsed.metadata
                };
              }
              
              // Forward the chunk to client
              res.write(`data: ${data}\n\n`);
            } catch (e) {
              console.warn('Failed to parse stream chunk:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      res.end();
    }
  } catch (error) {
    console.error('Stream API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dify chat proxy API (blocking)
app.post('/api/dify/:conversationId', async (req, res) => {
  try {
    const { message } = req.body;
    const { conversationId } = req.params;
    
    if (!DIFY_API_URL || !DIFY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing required environment variables' });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 查找当前会话的 dify_conversation_id
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .single();

    let difyConversationId = conversationRow?.dify_conversation_id || null;

    const requestBody = {
      inputs: {},
      query: message,
      response_mode: 'blocking',
      user: 'default-user'
    };

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId) {
      // 先验证对话是否仍然存在
      const checkResponse = await fetch(`${DIFY_API_URL}/conversations/${difyConversationId}`, {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
        },
      });

      if (checkResponse.ok) {
        requestBody.conversation_id = difyConversationId;
      } else {
        // 对话不存在，清除无效的 ID
        console.log('Dify conversation not found, creating new one');
        difyConversationId = null;
        await supabase
          .from('conversations')
          .update({ dify_conversation_id: null })
          .eq('id', conversationId);
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
    });

    // 如果是对话不存在的错误，尝试去掉 conversation_id 再试一次
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);

      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('Retrying without conversation_id');
        delete requestBody.conversation_id;

        response = await fetch(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // 如果重试依然失败，返回错误
        if (!response.ok) {
          const retryErrorData = await response.json();
          return res.status(response.status).json({
            error: retryErrorData.message || 'Dify API error',
            detail: retryErrorData
          });
        }
      } else {
        return res.status(response.status).json({
          error: errorData.message || 'Dify API error',
          detail: errorData
        });
      }
    }

    const data = await response.json();

    // 如果是新对话，保存 Dify 的 conversation_id
    if (!difyConversationId && data.conversation_id) {
      await supabase
        .from('conversations')
        .update({ dify_conversation_id: data.conversation_id })
        .eq('id', conversationId);
    }

    // 保存消息
    await saveMessages(supabase, conversationId, message, data);

    res.json({
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      metadata: data.metadata
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe 充值积分接口
app.post('/api/payment/stripe', async (req, res) => {
  try {
    const { amount } = req.body; // 单位：美元
    if (!amount || amount < 5) {
      return res.status(400).json({ error: '充值金额不能低于5美元' });
    }

    // Stripe 以分为单位，需*100
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      // 你可以在 metadata 里加上用户id等信息，方便后续业务处理
      metadata: {
        // userId: req.user.id (如有登录系统)
      }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 其它 API 路由可继续添加...

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
