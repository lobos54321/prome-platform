#!/usr/bin/env node

/**
 * 调试ChatFlow执行情况
 */

import { randomUUID } from 'crypto';

async function debugChatFlow() {
  const conversationId = randomUUID();
  console.log('🔍 Debugging ChatFlow execution with ID:', conversationId);
  
  try {
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '你好，我想制作营销文案',
        user: 'debug-user'
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status, response.statusText);
      return;
    }

    console.log('📊 Analyzing ChatFlow execution...');
    const reader = response.body.getReader();
    let nodeSequence = [];
    let variableStates = {};
    let hasAnswer = false;
    let finalAnswer = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const eventData = JSON.parse(line.slice(6));
            
            if (eventData.event === 'node_started') {
              nodeSequence.push({
                type: 'started',
                nodeId: eventData.data.node_id,
                nodeType: eventData.data.node_type,
                title: eventData.data.title,
                timestamp: new Date().toISOString()
              });
              console.log(`🟢 Node Started: ${eventData.data.title} (${eventData.data.node_type})`);
              
            } else if (eventData.event === 'node_finished') {
              nodeSequence.push({
                type: 'finished',
                nodeId: eventData.data.node_id,
                nodeType: eventData.data.node_type,
                title: eventData.data.title,
                status: eventData.data.status,
                inputs: eventData.data.inputs,
                outputs: eventData.data.outputs,
                timestamp: new Date().toISOString()
              });
              console.log(`✅ Node Finished: ${eventData.data.title} - Status: ${eventData.data.status}`);
              
              // 分析条件分支节点的输入输出
              if (eventData.data.node_type === 'if-else') {
                console.log('🔍 If-Else Node Analysis:');
                console.log('  Inputs:', JSON.stringify(eventData.data.inputs, null, 2));
                console.log('  Outputs:', JSON.stringify(eventData.data.outputs, null, 2));
                
                // 检查conversation variables
                if (eventData.data.inputs) {
                  Object.keys(eventData.data.inputs).forEach(key => {
                    if (key.startsWith('conversation.')) {
                      const varName = key.replace('conversation.', '');
                      variableStates[varName] = eventData.data.inputs[key];
                    }
                  });
                }
              }
              
            } else if (eventData.event === 'workflow_finished') {
              console.log('🏁 Workflow Finished');
              if (eventData.data && eventData.data.outputs && eventData.data.outputs.answer) {
                hasAnswer = true;
                finalAnswer = eventData.data.outputs.answer;
                console.log('💬 Final Answer:', finalAnswer);
              } else {
                console.log('⚠️ Workflow finished but no answer found');
                console.log('   Workflow Data:', JSON.stringify(eventData.data, null, 2));
              }
              
            } else if (eventData.event === 'error') {
              console.error('🚨 Workflow Error:', eventData);
            }
            
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    }
    
    console.log('\n📋 Execution Summary:');
    console.log(`  Total Nodes Executed: ${nodeSequence.filter(n => n.type === 'finished').length}`);
    console.log(`  Has Final Answer: ${hasAnswer}`);
    console.log(`  Final Answer: ${finalAnswer || 'None'}`);
    
    console.log('\n🔍 Node Execution Sequence:');
    nodeSequence.forEach((node, index) => {
      console.log(`  ${index + 1}. ${node.type.toUpperCase()}: ${node.title} (${node.nodeType})`);
      if (node.status) {
        console.log(`      Status: ${node.status}`);
      }
    });
    
    console.log('\n📊 Variable States:');
    Object.keys(variableStates).forEach(key => {
      console.log(`  ${key}: ${JSON.stringify(variableStates[key])}`);
    });
    
    if (!hasAnswer) {
      console.log('\n❓ Analysis: ChatFlow没有返回答案，可能原因：');
      console.log('  1. 条件分支没有匹配的case');
      console.log('  2. 缺少else/default分支');
      console.log('  3. 信息收集节点缺失');
      console.log('  4. 变量赋值失败');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugChatFlow().catch(console.error);