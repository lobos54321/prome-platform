const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('dist')); // 提供静态文件

// Dify API 配置
const DIFY_API_URL = process.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY;
const DIFY_APP_ID = process.env.VITE_DIFY_APP_ID;

// 验证必需的环境变量
if (!DIFY_API_KEY || !DIFY_APP_ID) {
  console.error('❌ Missing required environment variables: VITE_DIFY_API_KEY or VITE_DIFY_APP_ID');
  process.exit(1);
}

console.log('🔧 Server Configuration:');
console.log('- Dify API URL:', DIFY_API_URL);
console.log('- Dify App ID:', DIFY_APP_ID ? `${DIFY_APP_ID.substring(0, 8)}...` : 'Not set');
console.log('- Port:', PORT);

// 通用 Dify API 代理处理函数
const handleDifyRequest = async (req, res, endpoint, conversationId = null) => {
  try {
    const { query, user, conversation_id, response_mode = 'streaming', stream = true, inputs = {}, auto_generate_name = true } = req.body;

    // 验证必需字段
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!user) {
      return res.status(400).json({ error: 'User is required' });
    }

    // 智能对话ID管理
    let finalConversationId = null;
    
    // 如果URL包含conversation_id参数，优先使用
    if (conversationId) {
      finalConversationId = conversationId;
      console.log(`[Dify API] 🎯 使用URL指定的conversation_id: ${conversationId}`);
    } 
    // 否则使用请求体中的conversation_id
    else if (conversation_id) {
      finalConversationId = conversation_id;
      console.log(`[Dify API] 🔄 使用请求体中的conversation_id: ${conversation_id}`);
    } 
    // 空值表示新对话
    else {
      console.log('[Dify API] 🆕 创建新对话 (conversation_id: null)');
    }

    console.log(`[Dify API] 📤 请求详情:`, {
      endpoint: endpoint,
      user: user,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      conversation_id: finalConversationId,
      response_mode: response_mode,
      stream: stream,
      timestamp: new Date().toISOString()
    });

    // 构建 Dify API 请求
    const difyRequestBody = {
      query: query,
      user: user,
      response_mode: response_mode,
      auto_generate_name: auto_generate_name,
      inputs: inputs || {}
    };

    // 只有在有有效conversation_id时才添加，避免发送null值
    if (finalConversationId) {
      difyRequestBody.conversation_id = finalConversationId;
    }

    console.log(`[Dify API] 🚀 发送到 Dify:`, {
      url: `${DIFY_API_URL}${endpoint}`,
      body: {
        ...difyRequestBody,
        query: difyRequestBody.query.substring(0, 50) + '...'
      }
    });

    const response = await fetch(`${DIFY_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyRequestBody),
    });

    console.log(`[Dify API] 📥 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        console.error(`[Dify API] ❌ 错误响应:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 500)
        });
      } catch (parseError) {
        console.error(`[Dify API] ❌ 无法解析错误响应:`, parseError);
      }

      return res.status(response.status).json({
        error: `Dify API error: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    // 流式响应处理
    if (stream && response_mode === 'streaming') {
      console.log('[Dify API] 🌊 开始流式响应');
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // 管道流式数据到客户端
      response.body.pipe(res);
      
      response.body.on('end', () => {
        console.log('[Dify API] 🏁 流式响应结束');
        res.end();
      });

      response.body.on('error', (error) => {
        console.error('[Dify API] ❌ 流式响应错误:', error);
        res.status(500).json({ error: 'Stream processing failed' });
      });
    } else {
      // 非流式响应处理
      const data = await response.json();
      console.log(`[Dify API] ✅ 非流式响应完成`, {
        hasAnswer: !!data.answer,
        answerLength: data.answer?.length || 0,
        conversation_id: data.conversation_id,
        message_id: data.message_id
      });
      
      res.json(data);
    }

  } catch (error) {
    console.error(`[Dify API] ❌ 服务器错误:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// API 路由

// 通用 Dify 聊天端点 - 无对话ID（新对话）
app.post('/api/dify', (req, res) => {
  console.log('[Route] 🆕 新对话请求');
  handleDifyRequest(req, res, '/chat-messages');
});

// 特定对话ID的 Dify 聊天端点 - 继续现有对话
app.post('/api/dify/:conversationId', (req, res) => {
  const conversationId = req.params.conversationId;
  console.log(`[Route] 🔄 继续对话请求: ${conversationId}`);
  handleDifyRequest(req, res, '/chat-messages', conversationId);
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    dify_configured: !!(DIFY_API_KEY && DIFY_APP_ID)
  });
});

// 环境信息端点 (仅开发环境)
app.get('/api/env-info', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  res.json({
    dify_api_url: DIFY_API_URL,
    dify_app_id: DIFY_APP_ID ? `${DIFY_APP_ID.substring(0, 8)}...` : 'Not set',
    has_api_key: !!DIFY_API_KEY,
    node_env: process.env.NODE_ENV || 'development'
  });
});

// SPA 路由支持 - 为所有非 API 路由返回 index.html
app.get('*', (req, res) => {
  // 跳过 API 路由
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  console.log(`[SPA] 📄 服务页面: ${req.path}`);
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 全局错误处理
app.use((error, req, res, next) => {
  console.error('[Server] ❌ 未捕获的错误:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Chat interface available at: http://localhost:${PORT}/chat/dify`);
  console.log(`🔗 API endpoints:`);
  console.log(`   POST /api/dify - New conversation`);
  console.log(`   POST /api/dify/:conversationId - Continue conversation`);
  console.log(`   GET /api/health - Health check`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`   GET /api/env-info - Environment info (dev only)`);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');  
  process.exit(0);
});