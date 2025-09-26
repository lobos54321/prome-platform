#!/usr/bin/env node

/**
 * 快速测试 COMPLETENESS 流程
 */

import { randomUUID } from 'crypto';

async function testSingleMessage(conversationId, message, stepNumber) {
  console.log(`\n📝 Step ${stepNumber}: "${message}"`);
  
  try {
    const response = await fetch(`http://localhost:8080/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        user: `test-user-${conversationId}`
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullResponse = '';
    let completenessFound = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.event === 'message' && data.answer) {
              fullResponse += data.answer;
              
              // 检查 COMPLETENESS 模式
              const completenessMatch = data.answer.match(/COMPLETENESS:\s*[\d\/]+/);
              if (completenessMatch) {
                completenessFound = completenessMatch[0];
              }
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    }
    
    console.log(`📊 COMPLETENESS: ${completenessFound || 'Not found'}`);
    console.log(`📤 Response: ${fullResponse.substring(0, 150)}...`);
    
    return { completeness: completenessFound, response: fullResponse };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🔧 Quick COMPLETENESS Test\n');
  
  const conversationId = randomUUID();
  console.log('🔗 Using conversation ID:', conversationId);
  
  // 测试序列
  await testSingleMessage(conversationId, '你好', 1);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testSingleMessage(conversationId, '我要做营销文案', 2);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testSingleMessage(conversationId, '我的产品是AI编程助手', 3);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testSingleMessage(conversationId, '主要特色是代码生成和bug修复', 4);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testSingleMessage(conversationId, '目标用户是程序员', 5);
  
  console.log('\n🏁 Test completed');
}

main().catch(console.error);