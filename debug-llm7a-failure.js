#!/usr/bin/env node

/**
 * 调试LLM7a节点执行失败的具体原因
 */

import { randomUUID } from 'crypto';

async function debugLLM7aFailure() {
  console.log('🔍 Debugging LLM7a node failure...\n');
  
  // 测试1: 新对话，直接触发biubiu路径
  const conversationId = randomUUID();
  console.log('🔗 Fresh conversation ID:', conversationId);
  
  try {
    console.log('📤 Sending biubiu to trigger LLM7a path...');
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'biubiu',
        user: `llm7a-debug-${Date.now()}`
      })
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Initial request failed:', response.status, errorText);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let nodeSequence = [];
    let errorEvents = [];
    let chunkCount = 0;
    let rawData = '';
    
    console.log('\n📋 Processing stream...\n');
    
    while (chunkCount < 50) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('✅ Stream ended normally');
        break;
      }
      
      chunkCount++;
      const chunk = decoder.decode(value);
      rawData += chunk;
      
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            
            // Track all nodes
            if (parsed.event === 'node_started') {
              nodeSequence.push(`START: ${parsed.data?.title} (${parsed.data?.node_type})`);
              console.log(`🟢 ${parsed.data?.title} started`);
            }
            
            if (parsed.event === 'node_finished') {
              nodeSequence.push(`FINISH: ${parsed.data?.title} - ${parsed.data?.status}`);
              console.log(`✅ ${parsed.data?.title} finished: ${parsed.data?.status}`);
              
              // Check for LLM7a specifically
              if (parsed.data?.title === 'LLM 7a' || parsed.data?.title === 'LLM7a') {
                console.log('\n🎯 LLM7a NODE ANALYSIS:');
                console.log('   Status:', parsed.data.status);
                console.log('   Error:', parsed.data.error);
                console.log('   Elapsed time:', parsed.data.elapsed_time);
                console.log('   Outputs:', JSON.stringify(parsed.data.outputs, null, 2));
                
                if (parsed.data.status !== 'succeeded') {
                  console.log('❌ LLM7a failed!');
                }
              }
            }
            
            if (parsed.event === 'error') {
              errorEvents.push(parsed);
              console.log('❌ Error event:', JSON.stringify(parsed, null, 2));
            }
            
            // Track final answer
            if (parsed.event === 'workflow_finished') {
              console.log('🏁 Workflow finished');
              if (parsed.data?.outputs?.answer) {
                console.log('📝 Final answer:', parsed.data.outputs.answer.substring(0, 200));
              }
            }
            
          } catch (e) {
            // Ignore JSON parse errors
          }
        } else if (line.includes('[DONE]')) {
          console.log('🔚 Stream done marker received');
        }
      }
    }
    
    reader.releaseLock();
    
    console.log('\n📊 EXECUTION SUMMARY:');
    console.log(`Stream chunks processed: ${chunkCount}`);
    console.log(`Node sequence: ${nodeSequence.length} events`);
    console.log(`Error events: ${errorEvents.length}`);
    
    console.log('\n📝 Node Execution Flow:');
    nodeSequence.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event}`);
    });
    
    if (errorEvents.length > 0) {
      console.log('\n❌ Error Events:');
      errorEvents.forEach((error, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(error, null, 2)}`);
      });
    }
    
    // Check if LLM7a was in the sequence
    const llm7aEvents = nodeSequence.filter(event => event.includes('LLM 7a') || event.includes('LLM7a'));
    if (llm7aEvents.length > 0) {
      console.log('\n🎯 LLM7a Events:');
      llm7aEvents.forEach(event => console.log(`  ${event}`));
    } else {
      console.log('\n⚠️  LLM7a not found in execution sequence');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugLLM7aFailure().catch(console.error);