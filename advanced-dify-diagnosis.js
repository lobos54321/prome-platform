async function advancedDifyDiagnosis() {
  console.log('🔍 高级Dify API诊断 - 付费模型零token问题...');
  
  const config = {
    apiUrl: 'https://api.dify.ai/v1',
    appId: '420861a3-3ef0-4ead-9bb7-0c4337d4229a',
    apiKey: 'app-IjKktE91BQKi8J1lex4aFkbg'
  };
  
  console.log('📋 诊断目标: 付费模型为什么返回0 tokens\n');
  
  // 测试1: 分析响应的详细结构
  console.log('🔍 测试1: 详细响应结构分析');
  try {
    const response = await fetch(`${config.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: '你好，请介绍一下你的功能',
        user: `diagnosis-${Date.now()}`,
        response_mode: 'blocking',
        conversation_id: ''
      })
    });
    
    console.log(`HTTP状态: ${response.status}`);
    
    // 分析所有响应头
    console.log('\\n📋 响应头分析:');
    for (const [key, value] of response.headers.entries()) {
      if (key.includes('usage') || key.includes('token') || key.includes('dify') || key.includes('model')) {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('\\n📊 完整响应结构:');
      console.log('- conversation_id:', data.conversation_id);
      console.log('- created_at:', data.created_at);
      console.log('- answer长度:', data.answer?.length);
      
      // 深度分析metadata
      console.log('\\n🔍 Metadata深度分析:');
      if (data.metadata) {
        console.log('✅ metadata存在');
        console.log('- metadata keys:', Object.keys(data.metadata));
        
        if (data.metadata.usage) {
          console.log('✅ usage对象存在');
          console.log('- usage结构:', JSON.stringify(data.metadata.usage, null, 2));
          
          // 检查是否有隐藏的token数据
          const usageKeys = Object.keys(data.metadata.usage);
          console.log('- usage所有键:', usageKeys);
          
          // 检查可能的非标准字段
          for (const key of usageKeys) {
            const value = data.metadata.usage[key];
            if (typeof value === 'number' && value > 0) {
              console.log(`🎯 发现非零数值: ${key} = ${value}`);
            }
          }
        } else {
          console.log('❌ usage对象不存在');
        }
        
        // 检查其他可能包含token信息的字段
        console.log('\\n🔍 搜索其他可能的token字段:');
        const searchForTokens = (obj, path = '') => {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (key.toLowerCase().includes('token') || 
                key.toLowerCase().includes('usage') ||
                key.toLowerCase().includes('cost') ||
                key.toLowerCase().includes('price')) {
              console.log(`🔍 找到相关字段: ${currentPath} = ${value}`);
            }
            
            if (typeof value === 'object' && value !== null) {
              searchForTokens(value, currentPath);
            }
          }
        };
        
        searchForTokens(data.metadata, 'metadata');
        
      } else {
        console.log('❌ metadata不存在');
      }
      
      console.log('\\n📄 完整响应JSON (前1000字符):');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000) + '...');
      
    } else {
      console.log('❌ 请求失败');
    }
    
  } catch (error) {
    console.log('❌ 测试1失败:', error.message);
  }
  
  console.log('\\n' + '='.repeat(60));
  
  // 测试2: 对比streaming vs blocking模式
  console.log('\\n🔍 测试2: Streaming vs Blocking模式对比');
  
  const modes = ['blocking', 'streaming'];
  
  for (const mode of modes) {
    console.log(`\\n📡 测试${mode}模式:`);
    
    try {
      const response = await fetch(`${config.apiUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {},
          query: `测试${mode}模式token计算`,
          user: `${mode}-test-${Date.now()}`,
          response_mode: mode,
          conversation_id: ''
        })
      });
      
      if (mode === 'streaming') {
        // 处理streaming响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalUsage = null;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                
                try {
                  const streamData = JSON.parse(dataStr);
                  
                  // 寻找usage数据
                  if (streamData.metadata?.usage) {
                    finalUsage = streamData.metadata.usage;
                    console.log(`📊 Streaming中发现usage:`, finalUsage);
                  }
                  
                  if (streamData.event === 'message_end') {
                    console.log(`📋 Message end事件:`, streamData);
                  }
                  
                } catch (parseError) {
                  // 忽略非JSON数据
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        console.log(`最终streaming usage:`, finalUsage);
        
      } else {
        // blocking模式
        if (response.ok) {
          const data = await response.json();
          console.log(`📊 Blocking usage:`, data.metadata?.usage);
        }
      }
      
    } catch (error) {
      console.log(`❌ ${mode}模式失败:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\\n' + '='.repeat(60));
  
  // 测试3: 检查不同conversation状态
  console.log('\\n🔍 测试3: 不同Conversation状态的Token差异');
  
  const scenarios = [
    { name: '新对话', conversation_id: '' },
    { name: '指定对话ID', conversation_id: 'test-conv-123' },
    { name: '无conversation_id字段', skipConvId: true }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\\n📝 测试场景: ${scenario.name}`);
    
    try {
      const payload = {
        inputs: {},
        query: `测试${scenario.name}的token计算`,
        user: `scenario-test-${Date.now()}`,
        response_mode: 'blocking'
      };
      
      if (!scenario.skipConvId) {
        payload.conversation_id = scenario.conversation_id;
      }
      
      const response = await fetch(`${config.apiUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 ${scenario.name} usage:`, data.metadata?.usage);
        console.log(`📋 返回的conversation_id:`, data.conversation_id);
      } else {
        console.log(`❌ ${scenario.name}失败: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${scenario.name}错误:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\\n' + '='.repeat(60));
  console.log('\\n📋 诊断完成 - 请查看上述详细信息以找出付费模型零token的原因');
}

// 运行高级诊断
advancedDifyDiagnosis().catch(console.error);