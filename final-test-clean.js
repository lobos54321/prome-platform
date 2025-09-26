#!/usr/bin/env node

/**
 * 最终验证测试 - 全新对话测试修复效果
 * 测试移除inputs字段后的DIFY工作流行为
 */

import { randomUUID } from 'crypto';

async function finalTest() {
  console.log('🎯 最终验证测试 - 检验inputs字段修复效果\n');
  
  // 使用全新的conversation ID
  const conversationId = randomUUID();
  console.log('🆔 新对话ID:', conversationId);
  
  const testSteps = [
    { message: '你好', expected: '0', description: '初始问候' },
    { message: '我想推广我的产品', expected: '0', description: '表达意图(避免关键词)' },
    { message: '我的产品是AI编程助手', expected: '1/4', description: '第一个信息-产品' },
    { message: '主要特色是代码生成和bug修复', expected: '2/4', description: '第二个信息-特色' },
    { message: '目标用户是程序员', expected: '3/4', description: '第三个信息-用户群体' }
  ];
  
  console.log('\n📋 测试序列:');
  testSteps.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step.description}: "${step.message}" → 预期: ${step.expected}`);
  });
  console.log('\n开始测试...\n');
  
  for (let i = 0; i < testSteps.length; i++) {
    const { message, expected, description } = testSteps[i];
    
    console.log(`🎯 Step ${i + 1}: ${description}`);
    console.log(`📝 消息: "${message}"`);
    console.log(`🎯 预期: ${expected}`);
    
    try {
      const response = await fetch(`http://localhost:8080/api/dify/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          user: `final-test-${Date.now()}`,
          mode: 'blocking'
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.log('❌ 错误:', result.error);
        continue;
      }
      
      // 提取COMPLETENESS值
      const answerText = result.answer || '';
      const completenessMatch = answerText.match(/COMPLETENESS:\\s*(\\S+)/);
      
      if (completenessMatch) {
        const actualCompleteness = completenessMatch[1];
        console.log(`📊 实际: ${actualCompleteness}`);
        
        if (actualCompleteness === expected) {
          console.log('✅ 正确匹配！');
        } else {
          console.log(`❌ 不匹配 - 预期: ${expected}, 实际: ${actualCompleteness}`);
        }
      } else {
        console.log('⚠️ 未找到 COMPLETENESS');
        console.log('📝 响应内容预览:', answerText.substring(0, 100) + '...');
        console.log('❌ 可能跳转到其他模式');
      }
      
      console.log(''); // 空行分隔
      
    } catch (error) {
      console.error(`❌ Step ${i + 1} 网络错误:`, error.message);
      break;
    }
  }
  
  console.log('📊 测试完成');
  console.log('===============================');
  console.log('此测试验证移除inputs字段后的效果');
  console.log('如果看到COMPLETENESS正确递增，说明修复成功');
}

finalTest().catch(console.error);