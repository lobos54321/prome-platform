#!/usr/bin/env node

/**
 * DIFY COMPLETENESS 逻辑修复脚本
 * 
 * 问题分析：
 * 1. COMPLETENESS计数器在信息收集过程中出现异常重置
 * 2. 对话变量管理存在状态冲突
 * 3. 条件分支逻辑可能导致流程回退
 * 
 * 解决方案：
 * 1. 清理对话状态缓存
 * 2. 验证 DIFY chatflow 中的变量传递逻辑
 * 3. 确保状态管理的原子性
 */

import { randomUUID } from 'crypto';

async function testCompletenessFlow() {
  console.log('🔧 Testing COMPLETENESS flow logic...\n');
  
  const conversationId = randomUUID();
  console.log('🔗 Using conversation ID:', conversationId);
  
  const testSequence = [
    { message: '你好', expected: 'COMPLETENESS: 0' },
    { message: '我要做营销文案', expected: 'COMPLETENESS: 0' },
    { message: '我的产品是AI编程助手', expected: 'COMPLETENESS: 1/4' },
    { message: '主要特色是代码生成和bug修复', expected: 'COMPLETENESS: 2/4' },
    { message: '目标用户是程序员', expected: 'COMPLETENESS: 3/4' }
  ];
  
  for (let i = 0; i < testSequence.length; i++) {
    const test = testSequence[i];
    console.log(`\n📝 Step ${i + 1}: Sending "${test.message}"`);
    console.log(`📋 Expected: ${test.expected}`);
    
    try {
      const response = await fetch(`http://localhost:8080/api/dify/${conversationId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: test.message,
          user: `test-user-${conversationId}`
        })
      });

      if (!response.ok) {
        console.error('❌ Request failed:', response.status);
        continue;
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
      
      console.log(`📤 Response: ${fullResponse.substring(0, 100)}...`);
      if (completenessFound) {
        console.log(`📊 Found: ${completenessFound}`);
        
        // 检查是否符合预期
        if (completenessFound === test.expected) {
          console.log('✅ PASSED');
        } else {
          console.log('❌ FAILED - Unexpected COMPLETENESS value');
          console.log(`   Expected: ${test.expected}`);
          console.log(`   Got: ${completenessFound}`);
        }
      } else {
        console.log('⚠️ No COMPLETENESS found in response');
      }
      
      // 等待一下再发送下一个消息
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

async function clearConversationCache() {
  console.log('🧹 Clearing conversation cache...');
  
  try {
    const response = await fetch('http://localhost:8080/api/debug/clear-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      console.log('✅ Cache cleared successfully');
    } else {
      console.log('⚠️ Cache clear endpoint not available');
    }
  } catch (error) {
    console.log('ℹ️ Cache clear not implemented:', error.message);
  }
}

async function main() {
  console.log('🔧 DIFY COMPLETENESS Logic Fix\n');
  
  await clearConversationCache();
  await testCompletenessFlow();
  
  console.log('\n🏁 Test completed. Check the results above for flow consistency.');
  console.log('\n📋 Recommendations:');
  console.log('1. 如果 COMPLETENESS 计数异常，需要在 DIFY 中检查变量更新逻辑');
  console.log('2. 确保条件分支正确处理状态累积');
  console.log('3. 验证对话变量的持久化机制');
}

main().catch(console.error);