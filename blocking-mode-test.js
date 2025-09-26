#!/usr/bin/env node

/**
 * 使用阻塞模式测试 COMPLETENESS 流程
 * 避免流式解析的复杂性
 */

import { randomUUID } from 'crypto';

async function testBlockingMode(conversationId, message, stepNumber) {
  console.log(`\n📝 Step ${stepNumber}: "${message}"`);
  
  try {
    // 使用阻塞模式API
    const response = await fetch(`http://localhost:8080/api/dify/${conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        user: `blocking-test-${conversationId}`,
        mode: 'blocking'
      })
    });

    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, await response.text());
      return null;
    }

    const result = await response.json();
    console.log('📋 完整响应:', JSON.stringify(result, null, 2));
    
    if (result.answer) {
      // 查找 COMPLETENESS
      const completenessMatch = result.answer.match(/COMPLETENESS:\s*([\d\/]+)/);
      if (completenessMatch) {
        console.log(`✅ COMPLETENESS: ${completenessMatch[1]}`);
        return { completeness: completenessMatch[1], response: result.answer };
      } else {
        console.log('⚠️ 未找到 COMPLETENESS');
        console.log('📝 响应内容:', result.answer.substring(0, 200));
      }
    }
    
    return { completeness: null, response: result.answer || 'No answer' };
    
  } catch (error) {
    console.error('❌ 请求错误:', error.message);
    return null;
  }
}

async function blockingTest() {
  console.log('🔒 阻塞模式 COMPLETENESS 测试\n');
  
  const conversationId = randomUUID();
  console.log('🆔 对话ID:', conversationId);
  
  // 完整测试序列
  const testSteps = [
    { message: '你好', expected: '0', description: '初始问候' },
    { message: '我要做营销文案', expected: '0', description: '表达意图' },
    { message: '我的产品是AI编程助手', expected: '1/4', description: '第一个信息-产品' },
    { message: '主要特色是代码生成和bug修复', expected: '2/4', description: '第二个信息-特色' },
    { message: '目标用户是程序员', expected: '3/4', description: '第三个信息-用户群体' }
  ];
  
  const results = [];
  
  for (let i = 0; i < testSteps.length; i++) {
    const step = testSteps[i];
    console.log(`\n🎯 ${step.description} (预期: ${step.expected})`);
    
    const result = await testBlockingMode(conversationId, step.message, i + 1);
    results.push({
      step: i + 1,
      message: step.message,
      expected: step.expected,
      actual: result?.completeness,
      success: result?.completeness === step.expected
    });
    
    // 检查是否符合预期
    if (result?.completeness === step.expected) {
      console.log('✅ 正确');
    } else if (result?.completeness) {
      console.log(`❌ 错误 - 预期: ${step.expected}, 实际: ${result.completeness}`);
      
      // 如果这是关键步骤（第5步），记录详细信息
      if (i === 4 && result.completeness === '1/4') {
        console.log('🚨 确认BUG：第5步COMPLETENESS异常重置为1/4');
        console.log('📋 详细响应:', result.response);
      }
    } else {
      console.log('❌ 无法获取COMPLETENESS值');
    }
    
    // 延迟避免过快请求
    if (i < testSteps.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 测试总结
  console.log('\n📊 测试总结:');
  console.log('================================');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Step ${result.step}: ${result.expected} → ${result.actual || 'null'}`);
  });
  
  // 检查是否找到了BUG
  const step5 = results[4];
  if (step5 && step5.actual === '1/4' && step5.expected === '3/4') {
    console.log('\n🚨 BUG确认：第5步COMPLETENESS异常重置！');
    console.log('💡 这证实了用户报告的问题');
  }
  
  console.log('\n📋 下一步：分析DIFY工作流中导致重置的具体节点');
}

blockingTest().catch(console.error);