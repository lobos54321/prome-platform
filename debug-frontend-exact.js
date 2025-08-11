#!/usr/bin/env node

/**
 * 精确模拟前端请求来调试差异
 */

import { randomUUID } from 'crypto';

async function debugFrontendExact() {
  console.log('🔍 Debugging with EXACT frontend request pattern...\n');
  
  // 使用与前端完全相同的请求格式
  const conversationId = randomUUID();
  const userId = `user-${Date.now()}`;
  
  console.log('🔗 Conversation ID:', conversationId);
  console.log('👤 User ID:', userId);
  
  try {
    // 模拟前端的精确请求
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '你好',
        user: userId
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status, await response.text());
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let allEvents = [];
    let nodeEvents = [];
    let conditionalResults = [];
    let finalAnswer = '';
    
    console.log('📋 TRACKING ALL EVENTS (matching frontend logic):\n');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            allEvents.push(parsed);
            
            // 完全模拟前端的事件处理逻辑
            if (parsed.event === 'node_started' && parsed.data?.node_id) {
              const nodeInfo = {
                event: 'node_started',
                nodeId: parsed.data.node_id,
                title: parsed.data.title,
                type: parsed.data.node_type
              };
              nodeEvents.push(nodeInfo);
              console.log(`🟢 FRONTEND LOGIC - Node Started: "${nodeInfo.title}" (${nodeInfo.type}) [${nodeInfo.nodeId}]`);
            }
            
            if (parsed.event === 'node_finished' && parsed.data?.node_id) {
              const nodeInfo = {
                event: 'node_finished',
                nodeId: parsed.data.node_id,
                title: parsed.data.title,
                type: parsed.data.node_type,
                status: parsed.data.status,
                outputs: parsed.data.outputs
              };
              nodeEvents.push(nodeInfo);
              console.log(`✅ FRONTEND LOGIC - Node Finished: "${nodeInfo.title}" - Status: ${nodeInfo.status}`);
              
              // 特别关注条件分支
              if (nodeInfo.type === 'if-else') {
                conditionalResults.push({
                  title: nodeInfo.title,
                  result: nodeInfo.outputs?.result,
                  selectedCase: nodeInfo.outputs?.selected_case_id
                });
                console.log(`🔀 CONDITIONAL RESULT: "${nodeInfo.title}" → ${nodeInfo.outputs?.result}`);
                if (nodeInfo.outputs?.selected_case_id) {
                  console.log(`   Selected Case ID: ${nodeInfo.outputs.selected_case_id}`);
                }
              }
            }
            
            // 捕获最终答案
            if (parsed.event === 'workflow_finished' && parsed.data?.outputs?.answer) {
              finalAnswer = parsed.data.outputs.answer;
            }
            
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPLETE EVENT ANALYSIS');
    console.log('='.repeat(80));
    
    console.log('\n🎯 NODE EXECUTION SEQUENCE (as frontend sees it):');
    nodeEvents.forEach((node, index) => {
      const prefix = node.event === 'node_started' ? '🟢 START:' : '✅ FINISH:';
      console.log(`${prefix} ${index + 1}. "${node.title}" (${node.type})`);
    });
    
    console.log('\n🔀 CONDITIONAL NODE DECISIONS:');
    conditionalResults.forEach((cond, index) => {
      console.log(`${index + 1}. "${cond.title}"`);
      console.log(`   Result: ${cond.result}`);
      console.log(`   Case ID: ${cond.selectedCase || 'null'}`);
      
      // 分析每个条件分支的预期行为
      if (cond.title === '条件分支 4') {
        console.log(`   Expected: false (conversation_info_completeness < 4) → should go to LLM18`);
        console.log(`   Actual: ${cond.result} → ${cond.result ? 'goes to 条件分支0' : 'goes to LLM18'}`);
      } else if (cond.title === '条件分支 0') {
        console.log(`   If this executed, 条件分支4 returned TRUE (conversation_info_completeness >= 4)`);
      } else if (cond.title === '条件分支 3') {
        console.log(`   If this executed, both 条件分支4 and 条件分支0 returned specific values`);
      }
    });
    
    console.log('\n🤖 LLM NODES DETECTED:');
    const llmNodes = nodeEvents.filter(n => n.type === 'llm');
    if (llmNodes.length === 0) {
      console.log('❌ NO LLM NODES FOUND IN FRONTEND EVENT STREAM!');
    } else {
      llmNodes.forEach((llm, index) => {
        console.log(`${index + 1}. "${llm.title}" [${llm.nodeId}]`);
        if (llm.nodeId === '1754637575709') {
          console.log('   ✅ This is LLM 18 - CORRECT');
        } else if (llm.nodeId === '1752204584264') {
          console.log('   ❌ This is LLM 3 - WRONG for first-time user');
        } else {
          console.log('   ❓ Unknown LLM');
        }
      });
    }
    
    console.log('\n💬 FINAL ANSWER ANALYSIS:');
    const preview = finalAnswer.substring(0, 300);
    console.log(`Answer: ${preview}${finalAnswer.length > 300 ? '...' : ''}`);
    
    // 根据答案内容判断执行的分支
    const isInfoCollection = finalAnswer.includes('COMPLETENESS') || 
                            finalAnswer.includes('产品详情') ||
                            finalAnswer.includes('收集信息') ||
                            finalAnswer.includes('了解更多');
                            
    const isBasicChat = finalAnswer.includes('AI助手') || 
                       finalAnswer.includes('很高兴') ||
                       finalAnswer.includes('有什么可以帮') && !isInfoCollection;
    
    console.log('\n🎯 CONCLUSION:');
    if (isInfoCollection) {
      console.log('✅ Content suggests LLM18 (Information Collection) was executed');
    } else if (isBasicChat) {
      console.log('❌ Content suggests LLM3 (Basic Chat) was executed');
    } else {
      console.log('❓ Content analysis inconclusive');
    }
    
    // 检查条件分支逻辑链
    console.log('\n🔍 CONDITIONAL CHAIN ANALYSIS:');
    const branch4 = conditionalResults.find(c => c.title === '条件分支 4');
    const branch0 = conditionalResults.find(c => c.title === '条件分支 0');
    const branch3 = conditionalResults.find(c => c.title === '条件分支 3');
    
    if (branch4) {
      console.log(`条件分支4 result: ${branch4.result}`);
      if (branch4.result === false) {
        console.log('✅ Should go directly to LLM18');
        if (branch0 || branch3) {
          console.log('❌ ERROR: Other branches executed when they shouldnt have!');
        }
      } else {
        console.log('❌ Should go to 条件分支0 (advanced flow)');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugFrontendExact().catch(console.error);