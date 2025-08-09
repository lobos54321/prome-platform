#!/usr/bin/env node

/**
 * 生产环境错误诊断工具
 * 用于分析 prome.live 的 API 问题
 */

const BASE_URL = 'https://prome.live';

async function testHealthCheck() {
  console.log('🔍 Testing health check endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health check response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return null;
  }
}

async function testStreamingAPI() {
  console.log('🌊 Testing streaming API...');
  try {
    const response = await fetch(`${BASE_URL}/api/dify/test-debug-id/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '我的产品是智能手机App',
        user: 'debug-user-123'
      })
    });

    if (!response.ok) {
      console.error('❌ Streaming API failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return null;
    }

    console.log('✅ Streaming API response received, parsing...');
    const reader = response.body.getReader();
    let chunks = [];
    let errorEvents = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      chunks.push(chunk);
      
      // 查找错误事件
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.event === 'error') {
              errorEvents.push(data);
              console.error('🚨 Error event found:', JSON.stringify(data, null, 2));
            } else if (data.event === 'workflow_finished') {
              console.log('✅ Workflow finished event:', JSON.stringify(data, null, 2));
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    }
    
    console.log(`📊 Total chunks received: ${chunks.length}`);
    console.log(`🚨 Error events found: ${errorEvents.length}`);
    
    if (errorEvents.length > 0) {
      console.log('💡 Detailed error analysis:');
      errorEvents.forEach((error, index) => {
        console.log(`Error ${index + 1}:`, error);
      });
    }
    
    return { chunks, errorEvents };
  } catch (error) {
    console.error('❌ Streaming API test failed:', error.message);
    return null;
  }
}

async function testBlockingAPI() {
  console.log('🔒 Testing blocking API...');
  try {
    const response = await fetch(`${BASE_URL}/api/dify/test-debug-blocking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '我的产品是智能手机App，主要功能是帮助用户管理时间',
        user: 'debug-user-blocking'
      })
    });

    if (!response.ok) {
      console.error('❌ Blocking API failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('✅ Blocking API response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Blocking API test failed:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting production environment diagnostics...\n');
  
  // 1. 健康检查
  const health = await testHealthCheck();
  console.log('\n' + '='.repeat(60) + '\n');
  
  // 2. 流式API测试
  const streamResult = await testStreamingAPI();
  console.log('\n' + '='.repeat(60) + '\n');
  
  // 3. 阻塞API测试
  const blockingResult = await testBlockingAPI();
  console.log('\n' + '='.repeat(60) + '\n');
  
  // 总结
  console.log('📋 Diagnostic Summary:');
  console.log('  Health Check:', health ? '✅ PASS' : '❌ FAIL');
  console.log('  Streaming API:', streamResult ? '✅ PASS' : '❌ FAIL');
  console.log('  Blocking API:', blockingResult ? '✅ PASS' : '❌ FAIL');
  
  if (health && !health.environment_configured.dify_api_key) {
    console.log('\n⚠️  WARNING: Dify API key not configured in production!');
  }
  
  if (health && !health.environment_configured.dify_api_url) {
    console.log('\n⚠️  WARNING: Dify API URL not configured in production!');
  }
  
  if (streamResult && streamResult.errorEvents.length > 0) {
    console.log('\n🚨 CRITICAL: Dify ChatFlow is producing errors');
    console.log('   This indicates a problem with the ChatFlow configuration');
    console.log('   Check dialogue_count conditions and variable assignments');
  }
}

main().catch(console.error);