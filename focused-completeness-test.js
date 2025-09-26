#!/usr/bin/env node

/**
 * 专注测试 COMPLETENESS 异常的精确脚本
 * 重点关注第3-4步的状态转换
 */

import { randomUUID } from 'crypto';

async function sendMessage(conversationId, message, stepNumber) {
  console.log(`\n🔸 Step ${stepNumber}: "${message}"`);
  
  try {
    const response = await fetch(`http://localhost:8080/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        user: `focus-test-${conversationId}`
      })
    });

    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullResponse = '';
    let completenessValue = '';
    let hasCompleteness = false;
    
    console.log('📡 Reading stream...');
    
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
              const answerChunk = data.answer;
              fullResponse += answerChunk;
              
              // 实时检查 COMPLETENESS
              const match = answerChunk.match(/COMPLETENESS:\s*([\d\/]+)/);
              if (match) {
                completenessValue = match[1];
                hasCompleteness = true;
                console.log(`📊 发现 COMPLETENESS: ${completenessValue}`);
              }
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    }
    
    console.log(`📝 完整响应: ${fullResponse.substring(0, 200)}...`);
    
    if (hasCompleteness) {
      console.log(`✅ COMPLETENESS 结果: ${completenessValue}`);
    } else {
      console.log('❌ 未发现 COMPLETENESS');
      
      // 尝试在完整响应中查找
      const fallbackMatch = fullResponse.match(/COMPLETENESS:\s*([\d\/]+)/);
      if (fallbackMatch) {
        console.log(`🔄 备用检查发现: ${fallbackMatch[1]}`);
        completenessValue = fallbackMatch[1];
      }
    }
    
    return { 
      completeness: completenessValue, 
      response: fullResponse,
      hasCompleteness: hasCompleteness 
    };
    
  } catch (error) {
    console.error('❌ 请求错误:', error.message);
    return null;
  }
}

async function focusedTest() {
  console.log('🎯 专注 COMPLETENESS 异常测试\n');
  
  const conversationId = randomUUID();
  console.log('🆔 对话ID:', conversationId);
  
  // 快速到达问题区域
  console.log('\n=== 快速序列测试 ===');
  
  // Step 1: 问候
  const result1 = await sendMessage(conversationId, '你好', 1);
  if (result1?.completeness) {
    console.log(`步骤1 完成度: ${result1.completeness} (预期: 0)`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 2: 意图
  const result2 = await sendMessage(conversationId, '我要做营销文案', 2);
  if (result2?.completeness) {
    console.log(`步骤2 完成度: ${result2.completeness} (预期: 0)`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 3: 第一个信息 - 这里应该是 1/4
  console.log('\n🔍 关键步骤3 - 预期 COMPLETENESS: 1/4');
  const result3 = await sendMessage(conversationId, '我的产品是AI编程助手', 3);
  if (result3?.completeness) {
    console.log(`步骤3 完成度: ${result3.completeness} (预期: 1/4)`);
    if (result3.completeness !== '1/4') {
      console.log('⚠️ 步骤3异常 - 应该是1/4');
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 4: 第二个信息 - 这里应该是 2/4
  console.log('\n🔍 关键步骤4 - 预期 COMPLETENESS: 2/4');
  const result4 = await sendMessage(conversationId, '主要特色是代码生成和bug修复', 4);
  if (result4?.completeness) {
    console.log(`步骤4 完成度: ${result4.completeness} (预期: 2/4)`);
    if (result4.completeness !== '2/4') {
      console.log('⚠️ 步骤4异常 - 应该是2/4');
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 5: 第三个信息 - 这里是问题步骤！
  console.log('\n🚨 问题步骤5 - 预期 COMPLETENESS: 3/4');
  const result5 = await sendMessage(conversationId, '目标用户是程序员', 5);
  if (result5?.completeness) {
    console.log(`步骤5 完成度: ${result5.completeness} (预期: 3/4)`);
    if (result5.completeness === '1/4') {
      console.log('🚨 确认BUG - 完成度异常回退到1/4！');
      console.log('📋 详细响应:', result5.response);
    } else if (result5.completeness !== '3/4') {
      console.log('⚠️ 步骤5异常 - 不是预期的3/4');
    } else {
      console.log('✅ 步骤5正常');
    }
  }
  
  console.log('\n📊 测试总结:');
  const results = [result1, result2, result3, result4, result5];
  results.forEach((result, index) => {
    if (result?.completeness) {
      console.log(`步骤${index + 1}: COMPLETENESS = ${result.completeness}`);
    } else {
      console.log(`步骤${index + 1}: 无法获取COMPLETENESS`);
    }
  });
}

focusedTest().catch(console.error);