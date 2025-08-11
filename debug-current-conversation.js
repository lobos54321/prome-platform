#!/usr/bin/env node

/**
 * 测试当前前端正在使用的conversation ID
 */

async function debugCurrentConversation() {
  console.log('🔍 Testing the conversation ID that frontend is currently using...\n');
  
  // 检查可能的conversation ID存储位置
  console.log('📋 POSSIBLE CONVERSATION ID SOURCES:');
  console.log('1. localStorage.getItem("dify_conversation_id")');
  console.log('2. localStorage.getItem("dify_conversation_id_streaming")'); 
  console.log('3. New random conversation ID');
  console.log('');
  
  console.log('请在浏览器开发者工具Console中运行以下命令：');
  console.log('');
  console.log('// 检查当前存储的conversation ID');
  console.log('console.log("Stored conversation ID:", localStorage.getItem("dify_conversation_id"));');
  console.log('console.log("Streaming conversation ID:", localStorage.getItem("dify_conversation_id_streaming"));');
  console.log('');
  console.log('// 检查当前聊天状态');  
  console.log('if (window.debugChat) {');
  console.log('  console.log("Current chat state:", window.debugChat.getCurrentState());');
  console.log('} else {');
  console.log('  console.log("Debug tools not available");');
  console.log('}');
  console.log('');
  console.log('// 强制重置并获取新的conversation ID');
  console.log('if (window.debugChat) {');
  console.log('  const result = window.debugChat.hardReset();');
  console.log('  console.log("Reset result:", result);');
  console.log('} else {');
  console.log('  // 手动清理');
  console.log('  Object.keys(localStorage).forEach(key => {');
  console.log('    if (key.startsWith("dify_")) localStorage.removeItem(key);');
  console.log('  });');
  console.log('  location.reload();');
  console.log('}');
  console.log('');
  console.log('然后重新发送"你好"并观察节点执行路径');
  
  // 同时测试一个全新的conversation
  const freshConversationId = `fresh-${Date.now()}`;
  console.log(`\n🆕 测试全新的conversation ID: ${freshConversationId}`);
  
  try {
    const response = await fetch(`https://prome.live/api/dify/${freshConversationId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '你好',
        user: `fresh-user-${Date.now()}`
      })
    });

    if (!response.ok) {
      console.error('❌ Fresh conversation test failed:', response.status);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let conditionalNodes = [];
    let llmNodes = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            
            if (parsed.event === 'node_finished' && parsed.data?.node_type === 'if-else') {
              conditionalNodes.push({
                title: parsed.data.title,
                result: parsed.data.outputs?.result
              });
            }
            
            if (parsed.event === 'node_started' && parsed.data?.node_type === 'llm') {
              llmNodes.push({
                title: parsed.data.title,
                id: parsed.data.node_id
              });
            }
            
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    console.log('\n📊 FRESH CONVERSATION RESULTS:');
    console.log(`Conditional nodes: ${conditionalNodes.length}`);
    conditionalNodes.forEach(node => {
      console.log(`  ${node.title}: ${node.result}`);
    });
    
    console.log(`LLM nodes: ${llmNodes.length}`);
    llmNodes.forEach(node => {
      console.log(`  ${node.title} [${node.id}]`);
      if (node.id === '1754637575709') {
        console.log('    ✅ This is LLM 18 - Correct!');
      } else if (node.id === '1752204584264') {
        console.log('    ❌ This is LLM 3 - Wrong!');
      }
    });
    
    console.log('\n💡 如果这里显示LLM 18，但前端显示LLM 3路径，那就是前端缓存或状态管理问题');
    
  } catch (error) {
    console.error('❌ Fresh conversation test failed:', error.message);
  }
}

debugCurrentConversation().catch(console.error);