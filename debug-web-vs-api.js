async function compareWebVsApiUsage() {
  console.log('🔍 分析Web界面vs API调用的usage数据差异...');
  
  const config = {
    apiUrl: 'https://api.dify.ai/v1',
    appId: '420861a3-3ef0-4ead-9bb7-0c4337d4229a',
    apiKey: 'app-IjKktE91BQKi8J1lex4aFkbg'
  };
  
  const testMessage = '我们是ProMe Platform，AI营销内容生成平台，通过Dify工作流帮助企业快速生成营销文案。';
  const testUser = `debug-compare-${Date.now()}`;
  
  console.log('📋 测试配置:', {
    message: testMessage,
    user: testUser,
    timestamp: new Date().toISOString()
  });
  
  // 尝试不同的API调用方式来匹配Web界面
  const apiVariations = [
    {
      name: 'Standard API Call (current)',
      payload: {
        inputs: {},
        query: testMessage,
        user: testUser,
        response_mode: 'blocking'
      }
    },
    {
      name: 'With auto_generate_name = true',
      payload: {
        inputs: {},
        query: testMessage,
        user: testUser,
        response_mode: 'blocking',
        auto_generate_name: true
      }
    },
    {
      name: 'With files array',
      payload: {
        inputs: {},
        query: testMessage,
        user: testUser,
        response_mode: 'blocking',
        files: []
      }
    },
    {
      name: 'Streaming mode',
      payload: {
        inputs: {},
        query: testMessage,
        user: testUser,
        response_mode: 'streaming'
      }
    },
    {
      name: 'With conversation_id = ""',
      payload: {
        inputs: {},
        query: testMessage,
        user: testUser,
        response_mode: 'blocking',
        conversation_id: ''
      }
    },
    {
      name: 'Complete Web-like payload',
      payload: {
        inputs: {},
        query: testMessage,
        user: testUser,
        response_mode: 'blocking',
        conversation_id: '',
        auto_generate_name: true,
        files: []
      }
    }
  ];
  
  for (let i = 0; i < apiVariations.length; i++) {
    const variation = apiVariations[i];
    console.log(`\n🔍 测试 ${i+1}/${apiVariations.length}: ${variation.name}`);
    
    try {
      const isStreaming = variation.payload.response_mode === 'streaming';
      
      const response = await fetch(`${config.apiUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(variation.payload)
      });
      
      console.log(`📊 Status: ${response.status}`);
      
      if (response.ok) {
        if (isStreaming) {
          // 处理streaming响应
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let finalUsage = null;
          let hasRealTokens = false;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6);
                  if (dataStr === '[DONE]') continue;
                  
                  try {
                    const data = JSON.parse(dataStr);
                    
                    if (data.event === 'message_end' && data.metadata?.usage) {
                      finalUsage = data.metadata.usage;
                      hasRealTokens = finalUsage.total_tokens > 0;
                      break;
                    }
                  } catch (parseError) {
                    // 忽略非JSON数据
                  }
                }
              }
              
              if (finalUsage) break;
            }
          } finally {
            reader.releaseLock();
          }
          
          console.log(`✅ Streaming结果: Tokens=${finalUsage?.total_tokens || 0}, Price=$${finalUsage?.total_price || '0'}`);
          
          if (hasRealTokens) {
            console.log(`🎉 *** 找到有效配置 *** ${variation.name}`);
            console.log('🔑 成功的payload:', JSON.stringify(variation.payload, null, 2));
            console.log('📊 Usage数据:', finalUsage);
            return variation; // 找到成功的配置就返回
          }
          
        } else {
          // 处理blocking响应
          const data = await response.json();
          const usage = data.metadata?.usage;
          const hasRealTokens = usage && usage.total_tokens > 0;
          
          console.log(`✅ Blocking结果: Tokens=${usage?.total_tokens || 0}, Price=$${usage?.total_price || '0'}`);
          
          if (hasRealTokens) {
            console.log(`🎉 *** 找到有效配置 *** ${variation.name}`);
            console.log('🔑 成功的payload:', JSON.stringify(variation.payload, null, 2));
            console.log('📊 Usage数据:', usage);
            return variation; // 找到成功的配置就返回
          }
        }
        
      } else {
        const errorText = await response.text();
        console.log(`❌ 失败: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      
    } catch (error) {
      console.log(`❌ 网络错误: ${error.message}`);
    }
    
    // 延迟避免请求过快
    if (i < apiVariations.length - 1) {
      console.log('⏳ 等待3秒...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n❌ 所有API变体都没有返回真实的token数据');
  console.log('📋 可能的解决方案:');
  console.log('1. 检查Dify API文档是否有遗漏的参数');
  console.log('2. 联系Dify技术支持');
  console.log('3. 使用不同的API密钥或应用ID');
  console.log('4. 检查API版本或端点差异');
  
  return null;
}

// 运行对比测试
compareWebVsApiUsage()
  .then(result => {
    if (result) {
      console.log('\n🎉 找到了有效的API调用配置！');
    } else {
      console.log('\n❌ 需要进一步调查Web界面的实际API调用');
    }
  })
  .catch(error => {
    console.error('❌ 测试失败:', error);
  });