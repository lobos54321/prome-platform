/**
 * Dify端点测试工具 - 测试不同的API端点
 */

export async function testDifferentEndpoints() {
  console.log('🔍 [Endpoint Tester] Testing different Dify API endpoints...');
  
  const config = {
    appId: '420861a3-3ef0-4ead-9bb7-0c4337d4229a',
    apiKey: 'app-IjKktE91BQKi8J1lex4aFkbg'
  };
  
  const endpoints = [
    'https://api.dify.ai/v1',
    'https://udify.app/v1',
    'https://cloud.dify.ai/v1',
    'https://api.udify.app/v1'
  ];
  
  const testMessage = '请为一家AI营销公司写一段产品介绍，包括核心功能和竞争优势。';
  const testUser = `endpoint-test-${Date.now()}`;
  
  const results = {
    timestamp: new Date().toISOString(),
    config,
    testMessage,
    tests: [] as any[]
  };
  
  for (const endpoint of endpoints) {
    console.log(`🔍 [Test] Testing endpoint: ${endpoint}`);
    
    try {
      // 测试连接性
      const metaResponse = await fetch(`${endpoint}/meta`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        }
      });
      
      const connectivityTest = {
        endpoint,
        connectivity: {
          success: metaResponse.ok,
          status: metaResponse.status,
          statusText: metaResponse.statusText
        }
      };
      
      if (metaResponse.ok) {
        // 测试chat-messages
        console.log(`🔍 [Test] Testing chat-messages on: ${endpoint}`);
        
        const chatResponse = await fetch(`${endpoint}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: {},
            query: testMessage,
            user: testUser,
            response_mode: 'blocking'
          })
        });
        
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          
          const hasUsage = !!chatData.metadata?.usage;
          const hasTokens = !!(chatData.metadata?.usage?.total_tokens);
          const tokenValue = chatData.metadata?.usage?.total_tokens || 0;
          const priceValue = chatData.metadata?.usage?.total_price || '0';
          
          results.tests.push({
            ...connectivityTest,
            chatTest: {
              success: true,
              status: chatResponse.status,
              hasUsage,
              hasTokens,
              tokenValue,
              priceValue,
              answer: chatData.answer?.substring(0, 100) + '...',
              fullResponse: chatData
            }
          });
          
          console.log(`✅ [${endpoint}] Success - Tokens: ${tokenValue}, Price: $${priceValue}`);
          
        } else {
          const errorText = await chatResponse.text();
          results.tests.push({
            ...connectivityTest,
            chatTest: {
              success: false,
              status: chatResponse.status,
              error: errorText
            }
          });
          
          console.log(`❌ [${endpoint}] Chat failed: ${chatResponse.status}`);
        }
        
      } else {
        results.tests.push({
          ...connectivityTest,
          chatTest: {
            success: false,
            error: 'Connectivity failed'
          }
        });
        
        console.log(`❌ [${endpoint}] Connectivity failed: ${metaResponse.status}`);
      }
      
    } catch (error) {
      results.tests.push({
        endpoint,
        connectivity: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        chatTest: {
          success: false,
          error: 'Network error'
        }
      });
      
      console.log(`❌ [${endpoint}] Network error:`, error);
    }
  }
  
  console.log('🔍 [Endpoint Tester] All tests completed');
  console.log('🔍 [Endpoint Tester] Results:', results);
  
  // 找出工作的端点
  const workingEndpoints = results.tests.filter(test => 
    test.chatTest?.success && test.chatTest?.tokenValue > 0
  );
  
  if (workingEndpoints.length > 0) {
    console.log('🎉 [SUCCESS] Found working endpoints:', 
      workingEndpoints.map(test => test.endpoint)
    );
  } else {
    console.log('❌ [ISSUE] No endpoints returned valid token data');
  }
  
  return results;
}

// 暴露到全局
if (typeof window !== 'undefined') {
  (window as any).testDifferentEndpoints = testDifferentEndpoints;
}