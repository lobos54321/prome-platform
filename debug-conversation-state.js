#!/usr/bin/env node

/**
 * 调试和清理conversation状态问题
 */

import { randomUUID } from 'crypto';

async function debugConversationState() {
  console.log('🔍 Debugging conversation state issues...\n');
  
  // 1. 测试全新的conversation (不使用任何已存在的conversation ID)
  console.log('📊 Testing fresh conversation (no existing ID)...');
  const freshConversationId = randomUUID();
  
  try {
    const response = await fetch(`https://prome.live/api/dify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '我想制作一个移动应用的营销文案',
        user: 'fresh-test-user'
      })
    });

    if (!response.ok) {
      console.error('❌ Fresh conversation request failed:', response.status);
      return;
    }

    const reader = response.body.getReader();
    let freshNodes = [];
    let freshVars = new Set();
    let freshAnswer = null;
    let freshWorkflowFinished = false;
    
    console.log('📊 Processing fresh conversation stream...');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const eventData = JSON.parse(line.slice(6));
            
            if (eventData.event === 'node_finished') {
              freshNodes.push({
                title: eventData.data.title,
                type: eventData.data.node_type,
                status: eventData.data.status
              });
              
              // 检查变量
              if (eventData.data.inputs) {
                Object.keys(eventData.data.inputs).forEach(key => {
                  if (key.includes('conversation_')) {
                    freshVars.add(`${key}: ${JSON.stringify(eventData.data.inputs[key])}`);
                  }
                });
              }
            } else if (eventData.event === 'workflow_finished') {
              freshWorkflowFinished = true;
              if (eventData.data && eventData.data.outputs && eventData.data.outputs.answer) {
                freshAnswer = eventData.data.outputs.answer;
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    console.log('\n📊 Fresh Conversation Results:');
    console.log(`  Nodes executed: ${freshNodes.length}`);
    console.log(`  Workflow finished: ${freshWorkflowFinished}`);
    console.log(`  Has answer: ${!!freshAnswer}`);
    
    console.log('\n📝 Node sequence:');
    freshNodes.forEach((node, index) => {
      console.log(`    ${index + 1}. "${node.title}" (${node.type}) - ${node.status}`);
    });
    
    console.log('\n📊 Variables detected:');
    Array.from(freshVars).forEach(variable => {
      console.log(`    - ${variable}`);
    });
    
    if (freshAnswer) {
      console.log(`\n💬 Answer: "${freshAnswer.substring(0, 200)}..."`);
    }
    
    // 2. 对比分析
    console.log('\n\n🔍 ANALYSIS:');
    
    if (freshNodes.length < 5) {
      console.log('❌ Fresh conversation also shows limited nodes - this suggests:');
      console.log('   1. ChatFlow configuration issue in Dify App itself');
      console.log('   2. OR specific conversation variables causing early termination');
      console.log('   3. OR conditional logic skipping most nodes');
    } else {
      console.log('✅ Fresh conversation works properly - previous issue was conversation state');
    }
    
    // 3. 测试是否和conversation_info_completeness相关
    console.log('\n📊 Testing conversation variable states...');
    
    // 检查是否conversation_info_completeness导致提前结束
    const hasCompletenessVar = Array.from(freshVars).some(v => v.includes('conversation_info_completeness'));
    if (hasCompletenessVar) {
      console.log('✅ conversation_info_completeness variable detected');
    } else {
      console.log('❌ conversation_info_completeness variable NOT detected');
      console.log('   → This might be why the flow is ending early');
    }
    
    // 4. 提供解决方案
    console.log('\n💡 RECOMMENDED ACTIONS:');
    console.log('1. 清除浏览器中的conversation状态:');
    console.log('   localStorage.removeItem("dify_conversation_id")');
    console.log('   localStorage.removeItem("dify_user_id")');
    console.log('');
    console.log('2. 如果问题持续，检查Dify App中的条件分支逻辑');
    console.log('3. 确认conversation_info_completeness等变量的初始值设置');
    
  } catch (error) {
    console.error('❌ Fresh conversation test failed:', error.message);
  }
}

debugConversationState().catch(console.error);