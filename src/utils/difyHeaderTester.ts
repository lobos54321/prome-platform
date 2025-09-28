/**
 * Dify请求头测试工具 - 测试不同的header组合
 */

export async function testDifferentHeaders() {
  console.log('🔍 [Header Tester] Testing different header combinations...');
  
  const config = {
    apiUrl: 'https://api.dify.ai/v1',
    appId: '420861a3-3ef0-4ead-9bb7-0c4337d4229a',
    apiKey: 'app-IjKktE91BQKi8J1lex4aFkbg'
  };
  
  const basePayload = {
    inputs: {},
    query: '请为一家AI营销公司写一段详细的产品介绍，包括核心功能和竞争优势。',
    user: `header-test-${Date.now()}`,
    response_mode: 'blocking'
  };
  
  const headerTests = [
    {
      name: 'Basic Headers (Current)',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'With User-Agent',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    {
      name: 'With Origin and Referer',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Origin': 'https://cloud.dify.ai',
        'Referer': `https://cloud.dify.ai/app/${config.appId}/workflow`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    },
    {
      name: 'Web Browser Simulation',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'no-cache',
        'Origin': 'https://cloud.dify.ai',
        'Referer': `https://cloud.dify.ai/app/${config.appId}/workflow`,
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    {
      name: 'With X-Requested-With',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    },
    {
      name: 'Dify Specific Headers',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-App-Code': config.appId,
        'X-Dify-Version': '1.0',
        'User-Agent': 'Dify-Client/1.0'
      }
    }
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    config,
    basePayload,
    tests: [] as any[]
  };
  
  for (const test of headerTests) {
    console.log(`🔍 [Test] ${test.name}`);
    
    try {
      const response = await fetch(`${config.apiUrl}/chat-messages`, {
        method: 'POST',
        headers: test.headers,
        body: JSON.stringify(basePayload)
      });
      
      console.log(`📊 [${test.name}] Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        
        const hasUsage = !!data.metadata?.usage;
        const hasTokens = !!(data.metadata?.usage?.total_tokens);
        const tokenValue = data.metadata?.usage?.total_tokens || 0;
        const priceValue = data.metadata?.usage?.total_price || '0';
        
        results.tests.push({
          name: test.name,
          headers: test.headers,
          success: true,
          status: response.status,
          hasUsage,
          hasTokens,
          tokenValue,
          priceValue,
          answer: data.answer?.substring(0, 100) + '...',
          fullResponse: data
        });
        
        console.log(`✅ [${test.name}] Tokens: ${tokenValue}, Price: $${priceValue}`);
        
        if (tokenValue > 0) {
          console.log(`🎉 [SUCCESS] ${test.name} returned real token data!`);
          console.log('🔑 Working headers:', test.headers);
        }
        
      } else {
        const errorText = await response.text();
        results.tests.push({
          name: test.name,
          headers: test.headers,
          success: false,
          status: response.status,
          error: errorText
        });
        
        console.log(`❌ [${test.name}] Failed: ${response.status} - ${errorText}`);
      }
      
    } catch (error) {
      results.tests.push({
        name: test.name,
        headers: test.headers,
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      });
      
      console.log(`❌ [${test.name}] Network error:`, error);
    }
    
    // 短暂延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('🔍 [Header Tester] All tests completed');
  console.log('🔍 [Header Tester] Results:', results);
  
  // 找出成功的配置
  const successfulTests = results.tests.filter(test => 
    test.success && test.tokenValue > 0
  );
  
  if (successfulTests.length > 0) {
    console.log('🎉 [SUCCESS] Found working header configurations:');
    successfulTests.forEach(test => {
      console.log(`- ${test.name}: ${test.tokenValue} tokens, $${test.priceValue}`);
    });
  } else {
    console.log('❌ [ISSUE] No header configuration returned valid token data');
  }
  
  return results;
}

// 暴露到全局
if (typeof window !== 'undefined') {
  (window as any).testDifferentHeaders = testDifferentHeaders;
}