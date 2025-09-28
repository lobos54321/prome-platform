/**
 * 直接测试Dify API调用 - 绕过我们的代理服务器
 */

export async function testDirectDifyAPI() {
  console.log('🔍 [Direct Test] Starting direct Dify API test...');
  
  // 从环境变量获取Dify配置
  const DIFY_API_URL = import.meta.env.VITE_DIFY_API_URL;
  const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY;
  
  if (!DIFY_API_URL || !DIFY_API_KEY) {
    console.error('❌ [Direct Test] Missing Dify configuration');
    return { error: 'Missing Dify API configuration' };
  }
  
  const testUser = `direct-test-${Date.now()}`;
  const testMessage = '请详细介绍人工智能的发展历程，包括主要里程碑事件。';
  
  console.log('🔍 [Direct Test] Configuration:', {
    apiUrl: DIFY_API_URL,
    hasApiKey: !!DIFY_API_KEY,
    testUser,
    testMessage
  });
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  };
  
  // 测试1: 直接调用chat-messages端点
  try {
    console.log('🔍 [Direct Test 1] Testing direct chat-messages call...');
    
    const directUrl = `${DIFY_API_URL}/chat-messages`;
    console.log('🔍 [Direct Test 1] Calling URL:', directUrl);
    
    const payload = {
      inputs: {},
      query: testMessage,
      user: testUser,
      conversation_id: '',
      response_mode: 'blocking',
      auto_generate_name: false
    };
    
    console.log('🔍 [Direct Test 1] Request payload:', payload);
    
    const response = await fetch(directUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Prome-Direct-Test/1.0'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('🔍 [Direct Test 1] Response status:', response.status);
    console.log('🔍 [Direct Test 1] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔍 [Direct Test 1] Response data:', JSON.stringify(data, null, 2));
      
      results.tests.push({
        name: 'Direct chat-messages call',
        success: true,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        usageAnalysis: {
          hasMetadata: !!data.metadata,
          hasUsage: !!data.metadata?.usage,
          hasTokens: !!(data.metadata?.usage?.total_tokens),
          tokenValue: data.metadata?.usage?.total_tokens || 0,
          priceValue: data.metadata?.usage?.total_price || '0',
          allUsageFields: data.metadata?.usage ? Object.keys(data.metadata.usage) : []
        }
      });
    } else {
      const errorText = await response.text();
      console.error('🔍 [Direct Test 1] API Error:', errorText);
      
      results.tests.push({
        name: 'Direct chat-messages call',
        success: false,
        status: response.status,
        error: errorText
      });
    }
    
  } catch (error) {
    console.error('🔍 [Direct Test 1] Network Error:', error);
    results.tests.push({
      name: 'Direct chat-messages call',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // 测试2: 调用app信息端点
  try {
    console.log('🔍 [Direct Test 2] Testing app parameters...');
    
    const appUrl = `${DIFY_API_URL}/parameters?user=${testUser}`;
    console.log('🔍 [Direct Test 2] Calling URL:', appUrl);
    
    const response = await fetch(appUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Prome-Direct-Test/1.0'
      }
    });
    
    console.log('🔍 [Direct Test 2] Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔍 [Direct Test 2] App parameters:', JSON.stringify(data, null, 2));
      
      results.tests.push({
        name: 'App parameters',
        success: true,
        status: response.status,
        data
      });
    } else {
      const errorText = await response.text();
      console.error('🔍 [Direct Test 2] Error:', errorText);
      
      results.tests.push({
        name: 'App parameters',
        success: false,
        status: response.status,
        error: errorText
      });
    }
    
  } catch (error) {
    console.error('🔍 [Direct Test 2] Network Error:', error);
    results.tests.push({
      name: 'App parameters',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  console.log('🔍 [Direct Test] All tests completed');
  console.log('🔍 [Direct Test] Results:', results);
  
  return results;
}

// 暴露到全局以便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).testDirectDifyAPI = testDirectDifyAPI;
}