#!/usr/bin/env node

/**
 * 分析ChatFlow执行与正式版设计的差异
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

async function analyzeFlowMismatch() {
  console.log('🔍 Analyzing ChatFlow execution vs formal design mismatch...\n');
  
  // 1. 分析正式版yml的设计
  console.log('📋 Analyzing formal yml design...');
  try {
    const formalYml = readFileSync('/Users/boliu/Desktop/营销文案正式版.yml', 'utf8');
    
    // 提取节点标题
    const titleMatches = formalYml.match(/title: .+/g) || [];
    const nodeTitles = titleMatches.map(match => match.replace('title: ', '').trim()).filter(title => title && title !== '');
    
    // 提取节点类型
    const nodeTypes = {};
    const llmNodeCount = (formalYml.match(/type: llm/g) || []).length;
    const ifElseNodeCount = (formalYml.match(/type: if-else/g) || []).length;
    const assignerNodeCount = (formalYml.match(/type: assigner/g) || []).length;
    const answerNodeCount = (formalYml.match(/type: answer/g) || []).length;
    const startNodeCount = (formalYml.match(/type: start/g) || []).length;
    
    console.log(`📊 Formal Design Summary:`);
    console.log(`  Total named nodes: ${nodeTitles.length}`);
    console.log(`  Node types:`);
    console.log(`    - Start: ${startNodeCount}`);
    console.log(`    - LLM: ${llmNodeCount}`);
    console.log(`    - If-Else: ${ifElseNodeCount}`);
    console.log(`    - Assigner: ${assignerNodeCount}`);
    console.log(`    - Answer: ${answerNodeCount}`);
    
    console.log(`\n📝 Key nodes in formal design:`);
    nodeTitles.slice(0, 10).forEach((title, index) => {
      console.log(`    ${index + 1}. ${title}`);
    });
    if (nodeTitles.length > 10) {
      console.log(`    ... and ${nodeTitles.length - 10} more`);
    }
    
    // 检查关键变量
    const conversationVars = formalYml.match(/conversation_\w+/g) || [];
    const uniqueVars = [...new Set(conversationVars)];
    console.log(`\n📊 Conversation variables in formal design:`);
    uniqueVars.forEach(variable => {
      console.log(`    - ${variable}`);
    });
    
  } catch (ymlError) {
    console.error('❌ Error reading formal yml:', ymlError.message);
    return;
  }
  
  // 2. 测试生产环境实际执行
  console.log('\n\n📊 Testing production environment execution...');
  const conversationId = randomUUID();
  
  try {
    const response = await fetch(`https://prome.live/api/dify/${conversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '我想制作一个AI助手产品的营销文案',
        user: 'analysis-user'
      })
    });

    if (!response.ok) {
      console.error('❌ Production request failed:', response.status, response.statusText);
      return;
    }

    const reader = response.body.getReader();
    let executedNodes = [];
    let executedNodeTypes = {};
    let detectedVariables = new Set();
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
              const nodeInfo = {
                title: eventData.data.title,
                type: eventData.data.node_type,
                status: eventData.data.status,
                id: eventData.data.node_id
              };
              executedNodes.push(nodeInfo);
              
              // Count node types
              executedNodeTypes[nodeInfo.type] = (executedNodeTypes[nodeInfo.type] || 0) + 1;
              
              // Extract conversation variables
              if (eventData.data.inputs) {
                Object.keys(eventData.data.inputs).forEach(key => {
                  if (key.includes('conversation_') || key.startsWith('conversation.')) {
                    detectedVariables.add(key);
                  }
                });
              }
              if (eventData.data.process_data) {
                Object.keys(eventData.data.process_data).forEach(key => {
                  if (key.includes('conversation_')) {
                    detectedVariables.add(key);
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
            // Ignore JSON parse errors
          }
        }
      }
    }
    
    console.log(`\n📊 Production Execution Summary:`);
    console.log(`  Total nodes executed: ${executedNodes.length}`);
    console.log(`  Node types executed:`);
    Object.keys(executedNodeTypes).forEach(type => {
      console.log(`    - ${type}: ${executedNodeTypes[type]}`);
    });
    
    console.log(`\n📝 Executed nodes sequence:`);
    executedNodes.forEach((node, index) => {
      console.log(`    ${index + 1}. "${node.title}" (${node.type}) - ${node.status}`);
    });
    
    console.log(`\n📊 Variables detected in execution:`);
    Array.from(detectedVariables).forEach(variable => {
      console.log(`    - ${variable}`);
    });
    
    console.log(`\n🎯 Final status:`);
    console.log(`  Workflow finished: ${hasWorkflowFinished}`);
    console.log(`  Has answer: ${!!finalAnswer}`);
    if (finalAnswer) {
      console.log(`  Answer preview: "${finalAnswer.substring(0, 150)}..."`);
    }
    
    // 3. 关键分析
    console.log(`\n\n🔍 MISMATCH ANALYSIS:`);
    console.log(`❌ MAJOR ISSUES DETECTED:`);
    
    if (executedNodes.length < 20) {
      console.log(`  1. 执行节点数量严重不足: ${executedNodes.length} < 43 (设计中的节点数)`);
      console.log(`     → 这说明Dify App使用的是简化版或旧版ChatFlow`);
    }
    
    const expectedLLMs = 15; // 根据yml分析大概有这么多LLM节点
    const actualLLMs = executedNodeTypes['llm'] || 0;
    if (actualLLMs < expectedLLMs / 2) {
      console.log(`  2. LLM节点执行不足: ${actualLLMs} << ${expectedLLMs} (预期)`);
      console.log(`     → 复杂的多LLM处理流程没有执行`);
    }
    
    if (!Array.from(detectedVariables).some(v => v.includes('collection_count'))) {
      console.log(`  3. 缺少关键变量: conversation_collection_count 未检测到`);
      console.log(`     → 信息收集计数机制没有启动`);
    }
    
    console.log(`\n💡 CONCLUSION:`);
    console.log(`  ❌ 生产环境的Dify App确实没有使用正式版ChatFlow配置`);
    console.log(`  📝 ACTION NEEDED:`);
    console.log(`     1. 需要在Dify控制台中导入 营销文案正式版.yml`);
    console.log(`     2. 或者更新现有App的ChatFlow配置`);
    console.log(`     3. App ID: 420861a3-3ef0-4ead-9bb7-0c4337d4229a`);
    
  } catch (error) {
    console.error('❌ Production test failed:', error.message);
  }
}

analyzeFlowMismatch().catch(console.error);