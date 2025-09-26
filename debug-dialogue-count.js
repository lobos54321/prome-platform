#!/usr/bin/env node

/**
 * 专门测试dialogue_count变量的行为
 */

import { randomUUID } from 'crypto';

async function testDialogueCount() {
  console.log('🔍 Testing dialogue_count behavior across multiple messages...\n');
  
  // 测试1: 使用同一个conversation ID发送多次消息
  const conversationId = randomUUID();
  console.log('🔗 Using SAME conversation ID:', conversationId);
  
  for (let i = 1; i <= 4; i++) {
    console.log(`\n📊 Message ${i}/4: Testing dialogue_count progression...`);
    
    try {
      const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `测试消息${i}`,
          user: `dialogue-test-${Date.now()}`
        })
      });

      if (!response.ok) {
        console.error(`❌ Message ${i} failed:`, response.status);
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let dialogueCountFound = null;
      let conditionalNodes = [];
      
      // 简化处理，只读取前几个chunks
      let chunkCount = 0;
      while (chunkCount < 10) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount++;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              if (eventData.event === 'node_finished' && eventData.data?.node_type === 'if-else') {
                conditionalNodes.push({
                  title: eventData.data.title,
                  inputs: eventData.data.inputs
                });
                
                // 查找dialogue_count
                if (eventData.data.inputs) {
                  Object.keys(eventData.data.inputs).forEach(key => {
                    if (key.includes('dialogue_count')) {
                      dialogueCountFound = eventData.data.inputs[key];
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
      
      reader.releaseLock();
      
      console.log(`📊 Message ${i} Results:`);
      console.log(`  dialogue_count found: ${dialogueCountFound}`);
      console.log(`  Conditional nodes: ${conditionalNodes.length}`);
      conditionalNodes.forEach(node => {
        console.log(`    - ${node.title}`);
      });
      
    } catch (error) {
      console.error(`❌ Message ${i} error:`, error.message);
    }
  }
  
  console.log('\n🔍 DIALOGUE COUNT ANALYSIS:');
  console.log('Expected behavior:');
  console.log('  Message 1: dialogue_count = 0');
  console.log('  Message 2: dialogue_count = 1'); 
  console.log('  Message 3: dialogue_count = 2');
  console.log('  Message 4: dialogue_count = 3');
  console.log('');
  console.log('If dialogue_count is not incrementing properly:');
  console.log('  → Each message creates new conversation state');
  console.log('  → Backend conversation tracking is broken');
  console.log('  → ChatFlow conditional logic becomes unpredictable');
}

testDialogueCount().catch(console.error);