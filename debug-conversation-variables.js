#!/usr/bin/env node

/**
 * 调试conversation变量状态和条件分支逻辑
 */

import { randomUUID } from 'crypto';

async function debugConversationVariables() {
  console.log('🔍 Debugging conversation variables and conditional logic...\n');
  
  const conversationId = randomUUID();
  console.log('🔗 Using fresh conversation ID:', conversationId);
  
  try {
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '我想制作营销文案',
        user: 'variable-test-' + Date.now()
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status, await response.text());
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let nodeSequence = [];
    let variableStates = new Map();
    let conditionalNodes = [];
    
    console.log('📊 Analyzing variable states and node execution...\n');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const eventData = JSON.parse(line.slice(6));
            
            if (eventData.event === 'node_started') {
              nodeSequence.push({
                type: 'started',
                title: eventData.data?.title,
                nodeType: eventData.data?.node_type,
                id: eventData.data?.node_id
              });
              
              console.log(`🟢 Node Started: "${eventData.data?.title}" (${eventData.data?.node_type})`);
              
            } else if (eventData.event === 'node_finished') {
              nodeSequence.push({
                type: 'finished',
                title: eventData.data?.title,
                nodeType: eventData.data?.node_type,
                status: eventData.data?.status,
                inputs: eventData.data?.inputs,
                outputs: eventData.data?.outputs
              });
              
              console.log(`✅ Node Finished: "${eventData.data?.title}" - Status: ${eventData.data?.status}`);
              
              // 特别分析条件分支节点
              if (eventData.data?.node_type === 'if-else') {
                conditionalNodes.push({
                  title: eventData.data.title,
                  inputs: eventData.data.inputs,
                  outputs: eventData.data.outputs,
                  status: eventData.data.status
                });
                
                console.log('🔍 CONDITIONAL NODE ANALYSIS:');
                console.log('  Title:', eventData.data.title);
                console.log('  Status:', eventData.data.status);
                console.log('  Inputs:', JSON.stringify(eventData.data.inputs, null, 2));
                console.log('  Outputs:', JSON.stringify(eventData.data.outputs, null, 2));
              }
              
              // 提取变量状态
              if (eventData.data?.inputs) {
                Object.keys(eventData.data.inputs).forEach(key => {
                  if (key.includes('conversation_') || key.startsWith('sys.')) {
                    const value = eventData.data.inputs[key];
                    variableStates.set(key, value);
                    console.log(`📊 Variable: ${key} = ${JSON.stringify(value)}`);
                  }
                });
              }
              
              if (eventData.data?.outputs) {
                Object.keys(eventData.data.outputs).forEach(key => {
                  if (key.includes('conversation_') || key.startsWith('sys.')) {
                    const value = eventData.data.outputs[key];
                    variableStates.set(key, value);
                    console.log(`📊 Variable Output: ${key} = ${JSON.stringify(value)}`);
                  }
                });
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    console.log('\n📊 EXECUTION SUMMARY:');
    console.log(`  Total nodes executed: ${nodeSequence.length}`);
    console.log(`  Conditional nodes found: ${conditionalNodes.length}`);
    
    console.log('\n📝 Node Execution Sequence:');
    nodeSequence.forEach((node, index) => {
      console.log(`  ${index + 1}. ${node.type.toUpperCase()}: "${node.title}" (${node.nodeType})`);
    });
    
    console.log('\n📊 Variable States:');
    variableStates.forEach((value, key) => {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    });
    
    console.log('\n🔍 CONDITIONAL LOGIC ANALYSIS:');
    conditionalNodes.forEach((node, index) => {
      console.log(`\n${index + 1}. Conditional Node: "${node.title}"`);
      console.log(`   Status: ${node.status}`);
      
      // 分析关键变量
      const infoCompleteness = node.inputs?.['conversation.conversation_info_completeness'] || 
                              node.inputs?.['conversation_info_completeness'] || 0;
      const dialogueCount = node.inputs?.['sys.dialogue_count'] || 0;
      
      console.log(`   conversation_info_completeness: ${infoCompleteness}`);
      console.log(`   dialogue_count: ${dialogueCount}`);
      
      if (node.title === '条件分支 4') {
        console.log(`   Expected condition: conversation_info_completeness >= 4`);
        console.log(`   Actual value: ${infoCompleteness}`);
        console.log(`   Should go to: ${infoCompleteness >= 4 ? 'TRUE branch' : 'FALSE branch'}`);
      }
    });
    
    console.log('\n💡 DIAGNOSIS:');
    const hasLLMNodes = nodeSequence.some(n => n.nodeType === 'llm');
    const hasMultipleConditionals = conditionalNodes.length > 1;
    
    if (!hasLLMNodes) {
      console.log('❌ No LLM nodes executed - ChatFlow ending too early');
      console.log('   → Check if condition branches are preventing LLM execution');
    } else if (hasMultipleConditionals) {
      console.log('✅ Multiple conditional nodes found - ChatFlow has complex logic');
      console.log('   → Check if conditions are evaluating as expected');
    }
    
    const infoCompletenessValue = variableStates.get('conversation_info_completeness') || 
                                 variableStates.get('conversation.conversation_info_completeness') || 0;
    if (infoCompletenessValue === 0) {
      console.log('⚠️  conversation_info_completeness is 0 (initial state)');
      console.log('   → First-time user should follow initial information collection flow');
    } else {
      console.log(`✅ conversation_info_completeness = ${infoCompletenessValue}`);
      console.log('   → User should follow advanced flow based on completeness level');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugConversationVariables().catch(console.error);