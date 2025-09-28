/**
 * Dify配置验证工具 - 对比不同环境的配置差异
 */

export async function validateDifyConfig() {
  console.log('🔍 [Config Validator] Starting Dify configuration validation...');
  
  const config = {
    apiUrl: import.meta.env.VITE_DIFY_API_URL,
    appId: import.meta.env.VITE_DIFY_APP_ID,
    apiKey: import.meta.env.VITE_DIFY_API_KEY,
    enabled: import.meta.env.VITE_ENABLE_DIFY_INTEGRATION,
    timeout: import.meta.env.VITE_DIFY_TIMEOUT_MS,
    workflowTimeout: import.meta.env.VITE_DIFY_WORKFLOW_TIMEOUT_MS,
    maxRetries: import.meta.env.VITE_DIFY_MAX_RETRIES
  };

  console.log('🔍 [Config] Current Dify Configuration:', {
    apiUrl: config.apiUrl,
    appId: config.appId,
    hasApiKey: !!config.apiKey,
    apiKeyPrefix: config.apiKey?.substring(0, 8) + '...',
    enabled: config.enabled,
    timeout: config.timeout,
    workflowTimeout: config.workflowTimeout,
    maxRetries: config.maxRetries
  });

  const results = {
    timestamp: new Date().toISOString(),
    config,
    tests: [] as any[]
  };

  // 测试1: API密钥格式验证
  console.log('🔍 [Test 1] Validating API key format...');
  const apiKeyValid = config.apiKey?.startsWith('app-') && config.apiKey.length > 20;
  results.tests.push({
    name: 'API Key Format',
    success: apiKeyValid,
    details: {
      hasApiKey: !!config.apiKey,
      startsWithApp: config.apiKey?.startsWith('app-'),
      length: config.apiKey?.length,
      expected: 'Should start with "app-" and be longer than 20 chars'
    }
  });

  // 测试2: 应用ID格式验证
  console.log('🔍 [Test 2] Validating App ID format...');
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const appIdValid = uuidPattern.test(config.appId || '');
  results.tests.push({
    name: 'App ID Format',
    success: appIdValid,
    details: {
      appId: config.appId,
      isUUID: appIdValid,
      expected: 'Should be a valid UUID format'
    }
  });

  // 测试3: API URL连通性
  console.log('🔍 [Test 3] Testing API URL connectivity...');
  try {
    const response = await fetch(`${config.apiUrl}/meta`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    results.tests.push({
      name: 'API URL Connectivity',
      success: response.ok,
      details: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: `${config.apiUrl}/meta`
      }
    });

  } catch (error) {
    results.tests.push({
      name: 'API URL Connectivity',
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: `${config.apiUrl}/meta`
      }
    });
  }

  // 测试4: 应用参数获取
  console.log('🔍 [Test 4] Testing app parameters access...');
  try {
    const response = await fetch(`${config.apiUrl}/parameters?user=config-test-${Date.now()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      results.tests.push({
        name: 'App Parameters Access',
        success: true,
        details: {
          status: response.status,
          hasOpeningStatement: !!data.opening_statement,
          hasUserInputForm: !!data.user_input_form,
          appData: data
        }
      });
    } else {
      const errorText = await response.text();
      results.tests.push({
        name: 'App Parameters Access',
        success: false,
        details: {
          status: response.status,
          error: errorText
        }
      });
    }

  } catch (error) {
    results.tests.push({
      name: 'App Parameters Access',
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }

  // 测试5: 简单消息测试 (使用最小参数)
  console.log('🔍 [Test 5] Testing minimal message call...');
  try {
    const minimalPayload = {
      inputs: {},
      query: '测试',
      user: `config-test-${Date.now()}`,
      response_mode: 'blocking'
    };

    const response = await fetch(`${config.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalPayload)
    });

    if (response.ok) {
      const data = await response.json();
      results.tests.push({
        name: 'Minimal Message Test',
        success: true,
        details: {
          status: response.status,
          hasAnswer: !!data.answer,
          hasUsage: !!data.metadata?.usage,
          hasTokens: !!(data.metadata?.usage?.total_tokens),
          tokenValue: data.metadata?.usage?.total_tokens || 0,
          payload: minimalPayload,
          response: data
        }
      });
    } else {
      const errorText = await response.text();
      results.tests.push({
        name: 'Minimal Message Test',
        success: false,
        details: {
          status: response.status,
          error: errorText,
          payload: minimalPayload
        }
      });
    }

  } catch (error) {
    results.tests.push({
      name: 'Minimal Message Test',
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }

  console.log('🔍 [Config Validator] Validation completed');
  console.log('🔍 [Config Validator] Results:', results);
  
  return results;
}

// 暴露到全局
if (typeof window !== 'undefined') {
  (window as any).validateDifyConfig = validateDifyConfig;
}