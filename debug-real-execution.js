#!/usr/bin/env node

/**
 * 精确测试实际执行路径，特别关注条件分支的详细过程
 */

import { randomUUID } from 'crypto';

async function debugRealExecution() {
  console.log('🔍 Debugging REAL execution path with detailed node tracking...\n');
  
  const conversationId = randomUUID();
  console.log('🔗 Using fresh conversation ID:', conversationId);
  
  try {
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '你好',
        user: `real-test-${Date.now()}`
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status, await response.text());
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let executionPath = [];
    let conditionalDetails = [];
    let llmNodesExecuted = [];
    let finalAnswer = '';
    
    console.log('📋 TRACKING ALL NODE EVENTS:\n');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const event = JSON.parse(line.slice(6));
            
            // Track node started events
            if (event.event === 'node_started') {
              const nodeInfo = {
                event: 'started',
                title: event.data?.title || 'Unknown',
                type: event.data?.node_type || 'unknown',
                id: event.data?.node_id || 'unknown'
              };
              
              executionPath.push(nodeInfo);
              console.log(`🟢 STARTED: "${nodeInfo.title}" (${nodeInfo.type}) [${nodeInfo.id}]`);
            }
            
            // Track node finished events with detailed analysis
            if (event.event === 'node_finished') {
              const nodeInfo = {
                event: 'finished',
                title: event.data?.title || 'Unknown',
                type: event.data?.node_type || 'unknown',
                id: event.data?.node_id || 'unknown',
                status: event.data?.status,
                inputs: event.data?.inputs,
                outputs: event.data?.outputs
              };
              
              executionPath.push(nodeInfo);
              console.log(`✅ FINISHED: "${nodeInfo.title}" (${nodeInfo.type}) - Status: ${nodeInfo.status}`);
              
              // Special analysis for conditional nodes
              if (nodeInfo.type === 'if-else') {
                const condition = {
                  title: nodeInfo.title,
                  result: nodeInfo.outputs?.result,
                  inputs: nodeInfo.inputs,
                  outputs: nodeInfo.outputs
                };
                
                conditionalDetails.push(condition);
                
                console.log('🔍 CONDITIONAL ANALYSIS:');
                console.log(`   Title: ${condition.title}`);
                console.log(`   Result: ${condition.result}`);
                console.log(`   Inputs:`, JSON.stringify(condition.inputs, null, 2));
                console.log(`   Outputs:`, JSON.stringify(condition.outputs, null, 2));
                console.log('');
              }
              
              // Track LLM nodes specifically
              if (nodeInfo.type === 'llm') {
                llmNodesExecuted.push({
                  title: nodeInfo.title,
                  id: nodeInfo.id
                });
                console.log(`🤖 LLM EXECUTED: "${nodeInfo.title}" [${nodeInfo.id}]`);
              }
            }
            
            // Capture final answer
            if (event.event === 'workflow_finished' && event.data?.outputs?.answer) {
              finalAnswer = event.data.outputs.answer;
            }
            
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 EXECUTION SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n🛤️  COMPLETE EXECUTION PATH:');
    executionPath.forEach((node, index) => {
      const arrow = index > 0 ? ' → ' : '   ';
      console.log(`${arrow}${node.event.toUpperCase()}: "${node.title}" (${node.type})`);
    });
    
    console.log('\n🔀 CONDITIONAL NODES RESULTS:');
    conditionalDetails.forEach((cond, index) => {
      console.log(`   ${index + 1}. "${cond.title}" → ${cond.result}`);
    });
    
    console.log('\n🤖 LLM NODES EXECUTED:');
    if (llmNodesExecuted.length === 0) {
      console.log('   ❌ NO LLM NODES EXECUTED!');
    } else {
      llmNodesExecuted.forEach((llm, index) => {
        console.log(`   ${index + 1}. "${llm.title}" [${llm.id}]`);
        
        // Check which LLM this is
        if (llm.id === '1754637575709') {
          console.log('       ✅ This is LLM 18 - CORRECT for first-time user');
        } else if (llm.id === '1752204584264') {
          console.log('       ⚠️  This is LLM 3 - WRONG for first-time user');
        } else if (llm.id === '1752154438971') {
          console.log('       📊 This is LLM 7 - Advanced processing');
        } else {
          console.log('       ❓ Unknown LLM node');
        }
      });
    }
    
    console.log('\n💬 FINAL ANSWER ANALYSIS:');
    const preview = finalAnswer.substring(0, 200);
    console.log(`Preview: ${preview}${finalAnswer.length > 200 ? '...' : ''}`);
    
    // Determine the branch type from content
    const isInfoCollection = finalAnswer.includes('COMPLETENESS') || 
                            finalAnswer.includes('产品详情') ||
                            finalAnswer.includes('了解您的需求') ||
                            finalAnswer.includes('收集信息');
                            
    const isBasicChat = finalAnswer.includes('AI助手') || 
                       finalAnswer.includes('有什么可以帮助') ||
                       finalAnswer.includes('很高兴为您服务');
                       
    const isCreativeAnalysis = finalAnswer.includes('identified_antithesis') || 
                              finalAnswer.includes('generated_constraints');
    
    console.log('\n🎯 BRANCH IDENTIFICATION:');
    if (isInfoCollection) {
      console.log('✅ Information Collection Branch (Expected: LLM18)');
    } else if (isBasicChat) {
      console.log('❌ Basic Chat Branch (This suggests LLM3 was executed)');
    } else if (isCreativeAnalysis) {
      console.log('📊 Creative Analysis Branch (LLM7)');
    } else {
      console.log('❓ Unidentified branch type');
    }
    
    console.log('\n🏆 DIAGNOSIS:');
    const expectedLLM18 = llmNodesExecuted.some(llm => llm.id === '1754637575709');
    const wrongLLM3 = llmNodesExecuted.some(llm => llm.id === '1752204584264');
    
    if (expectedLLM18) {
      console.log('✅ SUCCESS: LLM18 was executed correctly');
    } else if (wrongLLM3) {
      console.log('❌ PROBLEM: LLM3 was executed instead of LLM18');
      console.log('   → This suggests conversation_info_completeness >= 4');
      console.log('   → Check why the variable is not initializing to 0');
    } else {
      console.log('❓ UNCLEAR: Different LLM was executed');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugRealExecution().catch(console.error);