async function compareEnvironments() {
  console.log('🔍 对比本地vs当前环境的Dify API调用差异...');
  
  const config = {
    apiUrl: 'https://api.dify.ai/v1',
    appId: '420861a3-3ef0-4ead-9bb7-0c4337d4229a',
    apiKey: 'app-IjKktE91BQKi8J1lex4aFkbg'
  };
  
  console.log('📋 当前环境信息:');
  console.log('- Node.js版本:', process.version);
  console.log('- 操作系统:', process.platform);
  console.log('- 时区:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('- 当前时间:', new Date().toISOString());
  
  // 检查网络环境
  console.log('\\n🌐 网络环境检查:');
  
  // 1. 检查IP地址
  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    if (ipResponse.ok) {
      const ipData = await ipResponse.json();
      console.log('- 当前IP地址:', ipData.ip);
    }
  } catch (error) {
    console.log('- IP检查失败:', error.message);
  }
  
  // 2. 检查User-Agent差异
  console.log('\\n🔍 测试不同User-Agent的影响:');
  
  const userAgents = [
    {
      name: '默认Node.js',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: '模拟浏览器',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    },
    {
      name: '模拟本地开发',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ProMe-Platform-Local/1.0',
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1'
      }
    }
  ];
  
  for (const ua of userAgents) {
    console.log(`\\n📡 测试: ${ua.name}`);
    
    try {
      const response = await fetch(`${config.apiUrl}/chat-messages`, {
        method: 'POST',
        headers: ua.headers,
        body: JSON.stringify({
          inputs: {},
          query: '本地环境测试usage数据',
          user: `env-compare-${Date.now()}`,
          response_mode: 'blocking',
          conversation_id: ''
        })
      });
      
      console.log(`📊 状态: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        const usage = data.metadata?.usage;
        
        console.log('📋 结果分析:');
        console.log(`  - 响应长度: ${data.answer?.length || 0}`);
        console.log(`  - Total tokens: ${usage?.total_tokens || 0}`);
        console.log(`  - Total price: $${usage?.total_price || '0'}`);
        console.log(`  - Latency: ${usage?.latency || 0}s`);
        console.log(`  - Currency: ${usage?.currency || 'N/A'}`);
        
        if (usage && usage.total_tokens > 0) {
          console.log(`🎉 *** ${ua.name} 返回了真实token数据! ***`);
          return { success: true, method: ua.name, usage };
        }
      } else {
        console.log(`❌ 失败: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ 错误: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 3. 检查时间戳和请求ID的影响
  console.log('\\n🕐 测试时间相关参数:');
  
  const timeTests = [
    {
      name: '标准请求',
      payload: {
        inputs: {},
        query: '时间测试标准',
        user: `time-test-${Date.now()}`,
        response_mode: 'blocking',
        conversation_id: ''
      }
    },
    {
      name: '带时间戳',
      payload: {
        inputs: {},
        query: '时间测试带戳',
        user: `time-test-${Date.now()}`,
        response_mode: 'blocking',
        conversation_id: '',
        timestamp: Date.now()
      }
    },
    {
      name: '模拟本地用户ID',
      payload: {
        inputs: {},
        query: '时间测试本地',
        user: `local-user-${Math.random().toString(36).substr(2, 9)}`,
        response_mode: 'blocking',
        conversation_id: ''
      }
    }
  ];
  
  for (const test of timeTests) {
    console.log(`\\n⏰ 测试: ${test.name}`);
    
    try {
      const response = await fetch(`${config.apiUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        const usage = data.metadata?.usage;
        
        console.log(`📊 ${test.name} - Tokens: ${usage?.total_tokens || 0}, Latency: ${usage?.latency || 0}s`);
        
        if (usage && usage.total_tokens > 0) {
          console.log(`🎉 *** ${test.name} 成功! ***`);
          return { success: true, method: test.name, usage };
        }
      }
      
    } catch (error) {
      console.log(`❌ ${test.name} 错误: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\\n📋 环境对比分析完成');
  console.log('💡 建议检查本地环境的差异:');
  console.log('  1. 本地是否使用了不同的网络代理?');
  console.log('  2. 本地是否有特殊的环境变量?');
  console.log('  3. 本地的Dify配置是否不同?');
  console.log('  4. 本地的API调用方式是否有差异?');
  
  console.log('\\n🔍 请提供本地环境的详细信息:');
  console.log('  - 本地Node.js版本');
  console.log('  - 本地网络环境');
  console.log('  - 本地的具体API调用代码');
  console.log('  - 本地返回的usage数据示例');
  
  return null;
}

// 运行环境对比分析
compareEnvironments()
  .then(result => {
    if (result) {
      console.log('\\n✅ 找到了有效的配置方式!');
      console.log('💡 建议在server.js中采用这种配置');
    } else {
      console.log('\\n❌ 当前环境无法复现本地的success case');
      console.log('💡 需要分析本地环境的具体差异');
    }
  })
  .catch(error => {
    console.error('❌ 环境对比失败:', error);
  });