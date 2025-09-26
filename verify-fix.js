#!/usr/bin/env node

/**
 * 🔧 验证DIFY Workflow修复效果的脚本
 * 直接测试后端API是否正确传递初始化变量
 */

import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';

console.log('🔧 验证DIFY Workflow修复效果');
console.log('================================');
console.log('测试服务器:', SERVER_URL);

async function testNewConversationFix() {
  console.log('\n🧪 测试新会话初始化修复...\n');

  const testCases = [
    {
      message: "你好",
      description: "简单问候测试",
      expectedBehavior: "应该开始信息收集，而不是直接进入LLM0/LLM3"
    },
    {
      message: "我需要营销文案",
      description: "明确营销需求测试",
      expectedBehavior: "应该询问产品信息和痛点"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.description}`);
    console.log(`💬 用户输入: "${testCase.message}"`);
    console.log(`🎯 期望行为: ${testCase.expectedBehavior}`);
    console.log('---');

    try {
      // 🔧 测试通用 /api/dify 端点
      const requestBody = {
        message: testCase.message,
        user: `test-user-${Date.now()}`,
        conversation_id: null, // 新会话
        stream: false
      };

      console.log('📤 发送请求到 /api/dify...');
      console.log('请求体:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${SERVER_URL}/api/dify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ API 错误:', response.status, errorText);
        continue;
      }

      const result = await response.json();
      
      console.log('📥 API 响应:');
      console.log('  - 状态码:', response.status);
      console.log('  - 对话ID:', result.conversation_id);
      console.log('  - 消息ID:', result.message_id);
      console.log('  - 响应内容:', result.answer?.substring(0, 300) + '...');
      
      // 🔍 关键：检查响应内容判断修复是否生效
      const answer = result.answer?.toLowerCase() || '';
      
      console.log('\n🔍 修复效果分析:');
      
      if (answer.includes('revised_pain_point') || answer.includes('"pain_point"')) {
        console.log('❌ 修复失败：仍然直接进入LLM节点，跳过信息收集');
        console.log('   建议：检查后端inputs参数是否正确传递');
      } else if (answer.includes('产品') || answer.includes('信息') || answer.includes('了解') || answer.includes('告诉')) {
        console.log('✅ 修复成功：正确进入信息收集阶段');
      } else if (answer.includes('你好') && testCase.message === '你好') {
        console.log('✅ 修复成功：正常对话响应，未误入营销流程');
      } else {
        console.log('🤔 需要进一步分析响应内容');
        console.log('   完整响应:', result.answer?.substring(0, 500));
      }
      
      if (result.metadata) {
        console.log('  - 元数据:', JSON.stringify(result.metadata, null, 2));
      }
      
    } catch (error) {
      console.log('❌ 请求失败:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// 🔧 测试workflow端点
async function testWorkflowEndpoint() {
  console.log('\n🧪 测试Workflow端点修复...\n');
  
  const testMessage = "我需要写营销文案";
  
  console.log(`💬 测试消息: "${testMessage}"`);
  
  try {
    const requestBody = {
      message: testMessage,
      user: `workflow-test-${Date.now()}`,
      conversation_id: null,
      stream: false
    };

    console.log('📤 发送请求到 /api/dify/workflow...');

    const response = await fetch(`${SERVER_URL}/api/dify/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Workflow API 错误:', response.status, errorText);
      return;
    }

    const result = await response.json();
    
    console.log('📥 Workflow API 响应:');
    console.log('  - 对话ID:', result.conversation_id);
    console.log('  - 响应内容:', result.answer?.substring(0, 300) + '...');
    
    const answer = result.answer?.toLowerCase() || '';
    
    if (answer.includes('产品') || answer.includes('信息') || answer.includes('痛点')) {
      console.log('✅ Workflow修复成功：正确开始信息收集');
    } else {
      console.log('❌ Workflow修复失败：未进入预期流程');
    }
    
  } catch (error) {
    console.log('❌ Workflow测试失败:', error.message);
  }
}

// 主函数
async function main() {
  console.log(`\n⏰ 开始时间: ${new Date().toLocaleString()}`);
  
  await testNewConversationFix();
  await testWorkflowEndpoint();
  
  console.log('\n🎉 所有测试完成！');
  console.log('\n💡 如果测试显示修复成功：');
  console.log('   1. 新会话将正确进入信息收集阶段');
  console.log('   2. 不再直接跳转到LLM0/LLM3节点');
  console.log('   3. 对话流程按设计的workflow执行');
  
  console.log('\n💡 如果测试仍显示问题：');
  console.log('   1. 检查服务器是否重启以应用修改');
  console.log('   2. 验证DIFY workflow配置是否正确');
  console.log('   3. 查看服务器日志中的详细调试信息');
}

main().catch(console.error);