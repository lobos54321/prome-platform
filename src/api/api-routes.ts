// 创建一个新的API路由处理文件
import express from 'express';

// 这个文件将在服务器端处理API路由
// 如果您的项目使用了express或其他服务器框架

export function setupDifyRoutes(app: express.Application) {
  app.post('/api/dify', async (req, res) => {
    try {
      const { message, conversation_id, user_id = 'default-user' } = req.body;
      const isStream = req.query.stream === 'true';
      
      console.log(`[Dify API] 收到请求: ${message?.substring(0, 50)}... | 会话ID: ${conversation_id || '新会话'}`);
  
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
        conversation_id: conversation_id,
        user: user_id
      };
  
      console.log(`[Dify API] 发送请求到: ${difyUrl}`);
  
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
        difyResponse.body?.pipe(res);
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
        
        // 返回响应
        return res.status(200).json(responseData);
      }
    } catch (error: any) {
      console.error('[Dify API] 处理请求时出错:', error);
      return res.status(500).json({ 
        error: 'Error processing request', 
        message: error.message
      });
    }
  });
}
