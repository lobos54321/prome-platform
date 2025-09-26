#!/usr/bin/env node

/**
 * 调试当前生产环境使用的ChatFlow配置
 * 比较实际执行流程与正式版yml的差异
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

async function compareFlowVersions() {
  console.log('🔍 Analyzing current production ChatFlow vs formal version...\n');
  
  const conversationId = randomUUID();
  
  try {
    // 1. 分析生产环境的实际执行
    console.log('📊 Testing production environment execution...');
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '我想制作一个手机App的营销文案',
        user: 'debug-user'
      })
    });

    if (!response.ok) {
      console.error('❌ Production request failed:', response.status, response.statusText);
      return;
    }

    const reader = response.body.getReader();
    let productionNodes = [];
    let productionVariables = {};
    let hasWorkflowFinished = false;
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
            
            if (eventData.event === 'node_finished') {
              productionNodes.push({
                id: eventData.data.node_id,
                type: eventData.data.node_type,
                title: eventData.data.title,
                status: eventData.data.status
              });
              
              // 检查变量状态
              if (eventData.data.inputs) {
                Object.keys(eventData.data.inputs).forEach(key => {
                  if (key.includes('conversation')) {
                    productionVariables[key] = eventData.data.inputs[key];
                  }
                });
              }
            } else if (eventData.event === 'workflow_finished') {
              hasWorkflowFinished = true;
              if (eventData.data && eventData.data.outputs && eventData.data.outputs.answer) {
                finalAnswer = eventData.data.outputs.answer;
              }
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    }
    
    console.log('\n🏭 Production Environment Analysis:');
    console.log(`  Total nodes executed: ${productionNodes.length}`);
    console.log(`  Workflow finished: ${hasWorkflowFinished}`);
    console.log(`  Has final answer: ${!!finalAnswer}`);
    
    console.log('\n📋 Node execution sequence:');
    productionNodes.forEach((node, index) => {
      console.log(`  ${index + 1}. ${node.title} (${node.type}) - ${node.status}`);
    });
    
    console.log('\n📊 Variables found:');
    Object.keys(productionVariables).forEach(key => {
      console.log(`  ${key}: ${JSON.stringify(productionVariables[key])}`);
    });
    
    if (finalAnswer) {
      console.log('\n💬 Final Answer:');
      console.log(`  "${finalAnswer.substring(0, 200)}${finalAnswer.length > 200 ? '...' : ''}"`);
    }
    
    // 2. 分析正式版yml文件
    console.log('\n\n🔍 Analyzing formal version yml file...');
    
    try {
      const formalYml = readFileSync('/Users/boliu/Desktop/营销文案正式版.yml', 'utf8');
      
      // 提取变量定义
      const variableMatches = formalYml.match(/name: conversation_\w+/g) || [];
      const formalVariables = variableMatches.map(match => match.replace('name: ', ''));
      
      // 提取节点信息
      const nodeMatches = formalYml.match(/title: .+/g) || [];
      const formalNodes = nodeMatches.map(match => match.replace('title: ', '').trim());
      
      // 检查LLM节点数量
      const llmNodes = (formalYml.match(/type: llm/g) || []).length;
      const ifElseNodes = (formalYml.match(/type: if-else/g) || []).length;
      const answerNodes = (formalYml.match(/type: answer/g) || []).length;
      
      console.log('📋 Formal Version Configuration:');
      console.log(`  Variables defined: ${formalVariables.length}`);
      formalVariables.forEach(variable => {
        console.log(`    - ${variable}`);
      });
      
      console.log(`\n  Node types:`);
      console.log(`    - LLM nodes: ${llmNodes}`);
      console.log(`    - If-Else nodes: ${ifElseNodes}`);
      console.log(`    - Answer nodes: ${answerNodes}`);
      
      console.log(`\n  Total nodes in yml: ~${formalNodes.length}`);
      
      // 3. 比较差异
      console.log('\n\n🔍 COMPARISON ANALYSIS:');
      
      const hasNewVariables = formalVariables.some(v => 
        !Object.keys(productionVariables).some(prodVar => prodVar.includes(v))
      );
      
      console.log('📊 Key Differences:');
      
      if (productionNodes.length < 10 && llmNodes > 5) {
        console.log('  ❌ MAJOR ISSUE: Production executed only few nodes but yml has many LLMs');
        console.log('     → This suggests the ChatFlow in Dify was NOT updated');
      }
      
      if (hasNewVariables) {
        console.log('  ❌ VARIABLE MISMATCH: Formal yml has new variables not used in production');
        console.log('     → Dify App is using old ChatFlow configuration');
      }
      
      if (productionNodes.length > 0 && productionNodes[0].type !== 'start') {
        console.log('  ⚠️  Flow structure may be different');
      }
      
      console.log('\n🎯 CONCLUSION:');
      if (productionNodes.length < llmNodes / 2) {
        console.log('  ❌ The Dify App is definitely using OLD ChatFlow configuration');
        console.log('  📝 ACTION NEEDED: Import the formal yml file into Dify App');
        console.log(`     App ID: 420861a3-3ef0-4ead-9bb7-0c4337d4229a`);
      } else {
        console.log('  ✅ The ChatFlow seems to be updated and working');
      }
      
    } catch (ymlError) {
      console.error('❌ Error reading formal yml:', ymlError.message);
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

compareFlowVersions().catch(console.error);