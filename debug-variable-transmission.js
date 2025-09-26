#!/usr/bin/env node

/**
 * 🔧 调试DIFY conversation变量传递问题
 * 深入验证为什么conversation_info_completeness没有正确传递
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const DIFY_API_URL = process.env.VITE_DIFY_API_URL;
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY;

console.log('🔧 调试DIFY Variable Transmission');
console.log('==================================');
console.log('API URL:', DIFY_API_URL);
console.log('API Key:', DIFY_API_KEY ? `${DIFY_API_KEY.substring(0, 10)}...` : 'Not set');

async function testVariableTransmission() {
  console.log('\n🧪 测试conversation变量是否能正确传递...\n');

  // 测试1: 验证空inputs的默认行为
  console.log('📝 测试1: 空inputs (应该使用DIFY默认值0)');
  console.log('预期: conversation_info_completeness = 0，进入信息收集阶段');
  console.log('---');

  try {
    const emptyInputsRequest = {
      inputs: {},
      query: "你好，我想了解营销文案服务",
      response_mode: 'blocking',
      user: `test-empty-${Date.now()}`
    };

    console.log('请求体:', JSON.stringify(emptyInputsRequest, null, 2));

    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emptyInputsRequest)
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    } else {
      const data = await response.json();
      console.log('✅ 请求成功');
      console.log('对话ID:', data.conversation_id);
      
      if (data.answer) {
        const answer = data.answer;
        console.log('响应内容:', answer.substring(0, 300) + '...');
        
        // 关键分析：判断是否进入了正确的分支
        if (answer.includes('revised_pain_point') || answer.includes('"pain_point"') || answer.startsWith('{')) {
          console.log('🚨 结果：进入了LLM节点（错误路径）');
          console.log('   分析：即使空inputs，DIFY也认为conversation_info_completeness ≥ 4');
          console.log('   可能原因：workflow配置有问题，或者默认值不是0');
        } else if (answer.includes('产品') || answer.includes('信息') || answer.includes('了解')) {
          console.log('✅ 结果：进入了信息收集阶段（正确路径）');
          console.log('   分析：DIFY默认值0生效，问题在于后端变量传递');
        } else {
          console.log('🤔 结果：响应类型未知');
          console.log('   需要手动分析完整响应内容');
        }
      }
    }
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');

  // 测试2: 明确设置conversation_info_completeness = 0
  console.log('📝 测试2: 明确设置conversation_info_completeness = 0');
  console.log('预期: 如果传递成功，应该进入信息收集阶段');
  console.log('---');

  try {
    const explicitZeroRequest = {
      inputs: {
        conversation_info_completeness: 0
      },
      query: "帮我写营销文案",
      response_mode: 'blocking',
      user: `test-zero-${Date.now()}`
    };

    console.log('请求体:', JSON.stringify(explicitZeroRequest, null, 2));

    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(explicitZeroRequest)
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
    } else {
      const data = await response.json();
      console.log('✅ 请求成功');
      
      if (data.answer) {
        const answer = data.answer;
        console.log('响应内容:', answer.substring(0, 300) + '...');
        
        if (answer.includes('revised_pain_point') || answer.includes('"pain_point"') || answer.startsWith('{')) {
          console.log('🚨 结果：仍然进入了LLM节点');
          console.log('   分析：DIFY忽略了inputs中的conversation_info_completeness');
          console.log('   解决方案：需要研究DIFY conversation变量的正确设置方法');
        } else if (answer.includes('产品') || answer.includes('信息')) {
          console.log('✅ 结果：成功进入信息收集阶段');
          console.log('   分析：变量传递成功，后端修复有效');
        } else {
          console.log('🤔 结果：需要进一步分析');
        }
      }
    }
  } catch (error) {
    console.error('❌ 测试2失败:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 测试3: 设置conversation_info_completeness = 5 (应该进入营销文案生成)
  console.log('📝 测试3: 设置conversation_info_completeness = 5');
  console.log('预期: 应该进入LLM0营销文案生成流程');
  console.log('---');

  try {
    const highValueRequest = {
      inputs: {
        conversation_info_completeness: 5
      },
      query: "生成营销文案",
      response_mode: 'blocking',
      user: `test-five-${Date.now()}`
    };

    console.log('请求体:', JSON.stringify(highValueRequest, null, 2));

    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(highValueRequest)
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
    } else {
      const data = await response.json();
      console.log('✅ 请求成功');
      
      if (data.answer) {
        const answer = data.answer;
        console.log('响应内容:', answer.substring(0, 300) + '...');
        
        if (answer.includes('revised_pain_point') || answer.includes('"pain_point"') || answer.startsWith('{')) {
          console.log('✅ 结果：进入了LLM节点（符合预期）');
          console.log('   分析：conversation_info_completeness=5触发了营销文案流程');
          console.log('   结论：变量传递机制是有效的');
        } else if (answer.includes('产品') || answer.includes('信息')) {
          console.log('🚨 结果：意外进入了信息收集阶段');
          console.log('   分析：即使设置为5，仍然被当作<4处理');
          console.log('   问题：变量传递完全无效');
        } else {
          console.log('🤔 结果：需要分析');
        }
      }
    }
  } catch (error) {
    console.error('❌ 测试3失败:', error.message);
  }
}

async function main() {
  if (!DIFY_API_URL || !DIFY_API_KEY) {
    console.error('❌ DIFY API配置缺失');
    console.log('请检查环境变量:');
    console.log('- VITE_DIFY_API_URL');
    console.log('- VITE_DIFY_API_KEY');
    return;
  }
  
  await testVariableTransmission();
  
  console.log('\n🎯 调试结论：');
  console.log('---');
  console.log('如果测试1(空inputs)进入信息收集：');
  console.log('  ✅ DIFY默认值0有效，问题在后端传递逻辑');
  console.log('  💡 解决方案：后端不需要传递变量，让DIFY使用默认值');
  console.log('');
  console.log('如果测试1(空inputs)进入LLM节点：');
  console.log('  ❌ DIFY workflow配置或默认值有问题');
  console.log('  💡 解决方案：需要重新检查workflow配置');
  console.log('');
  console.log('如果测试2和测试3都无效：');
  console.log('  ❌ DIFY完全忽略inputs中的conversation变量');
  console.log('  💡 解决方案：需要研究DIFY conversation变量的正确API');
  console.log('');
  console.log('如果测试3有效但测试2无效：');
  console.log('  🤔 可能是数据类型或格式问题');
  console.log('  💡 解决方案：调整变量传递格式');
}

main().catch(console.error);