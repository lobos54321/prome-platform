#!/usr/bin/env node

/**
 * 测试相同输入是否产生一致的分支结果
 */

import { randomUUID } from 'crypto';

async function testBranchConsistency() {
  console.log('🔍 Testing branch consistency with same input...\n');
  
  const conversationId = randomUUID();
  console.log('🔗 Using SAME conversation ID for all tests:', conversationId);
  
  for (let i = 1; i <= 4; i++) {
    console.log(`\n📊 Test ${i}/4: Sending "你好" to same conversation...`);
    
    try {
      const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '你好',
          user: `consistency-test-${Date.now()}`
        })
      });

      if (!response.ok) {
        console.error(`❌ Test ${i} failed:`, response.status);
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalAnswer = '';
      let nodeSequence = [];
      let variableStates = new Map();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              if (eventData.event === 'node_finished') {
                nodeSequence.push({
                  title: eventData.data?.title,
                  type: eventData.data?.node_type
                });
                
                // 捕获变量状态
                if (eventData.data?.inputs) {
                  Object.keys(eventData.data.inputs).forEach(key => {
                    if (key.includes('conversation_') || key.includes('dialogue_count')) {
                      variableStates.set(key, eventData.data.inputs[key]);
                    }
                  });
                }
              } else if (eventData.event === 'workflow_finished') {
                if (eventData.data?.outputs?.answer) {
                  finalAnswer = eventData.data.outputs.answer;
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      
      console.log(`📋 Test ${i} Results:`);
      console.log(`  Nodes executed: ${nodeSequence.map(n => n.title).join(' → ')}`);
      console.log(`  Final answer: "${finalAnswer.substring(0, 100)}${finalAnswer.length > 100 ? '...' : ''}"`);
      
      console.log(`📊 Variables:`);
      variableStates.forEach((value, key) => {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      });
      
      // 特别检查是否是信息收集分支
      const isInfoCollection = finalAnswer.includes('COMPLETENESS') || finalAnswer.includes('产品详情');
      const isCreativeAnalysis = finalAnswer.includes('identified_antithesis') || finalAnswer.includes('generated_constraints');
      const isBasicChat = finalAnswer.includes('AI助手') && !isInfoCollection;
      
      console.log(`🎯 Branch Type: ${
        isInfoCollection ? '信息收集' : 
        isCreativeAnalysis ? '创意分析' : 
        isBasicChat ? '基础对话' : '未知'
      }`);
      
    } catch (error) {
      console.error(`❌ Test ${i} error:`, error.message);
    }
  }
  
  console.log('\n🔍 CONSISTENCY ANALYSIS:');
  console.log('Expected: All 4 tests should return "COMPLETENESS: 0" (信息收集分支)');
  console.log('If results vary, it indicates:');
  console.log('1. 🐛 Conditional branch logic issues');
  console.log('2. 🔄 Unwanted randomness in ChatFlow execution');
  console.log('3. ⚡ Variable state inconsistency');
}

testBranchConsistency().catch(console.error);