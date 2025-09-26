// Debug conversation flow to understand why dialogue_count is always 0
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE = 'http://localhost:8080';

function generateTestId() {
  return 'test-debug-' + Date.now();
}

async function debugConversationFlow() {
  console.log('🔍 调试对话流程...\n');
  
  const testConversationId = generateTestId();
  console.log(`📝 使用测试对话ID: ${testConversationId}\n`);
  
  // 第一条消息
  console.log('1️⃣ 发送第一条消息...');
  const response1 = await fetch(`${API_BASE}/api/dify/${testConversationId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '第一条消息' })
  });
  
  console.log('响应状态:', response1.status);
  
  if (!response1.ok) {
    console.error('❌ 第一条消息失败');
    return;
  }
  
  // 读取流式响应
  const reader1 = response1.body.getReader();
  const decoder = new TextDecoder();
  let firstConversationId = null;
  let firstDialogueCount = null;
  
  console.log('📡 处理流式响应...');
  
  while (true) {
    const { done, value } = await reader1.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        
        try {
          const parsed = JSON.parse(data);
          
          // 查找workflow_started事件中的dialogue_count
          if (parsed.event === 'workflow_started' && parsed.data?.inputs) {
            firstDialogueCount = parsed.data.inputs['sys.dialogue_count'];
            firstConversationId = parsed.conversation_id;
            console.log(`   📊 第一条消息 - conversation_id: ${firstConversationId}`);
            console.log(`   📊 第一条消息 - dialogue_count: ${firstDialogueCount}`);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  
  console.log('\\n⏳ 等待2秒钟...\\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 第二条消息 - 使用相同的conversation_id
  console.log('2️⃣ 发送第二条消息（使用相同conversation_id）...');
  const response2 = await fetch(`${API_BASE}/api/dify/${testConversationId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '第二条消息' })
  });
  
  console.log('响应状态:', response2.status);
  
  if (!response2.ok) {
    console.error('❌ 第二条消息失败');
    return;
  }
  
  // 读取第二条消息的流式响应
  const reader2 = response2.body.getReader();
  let secondConversationId = null;
  let secondDialogueCount = null;
  
  console.log('📡 处理第二条消息的流式响应...');
  
  while (true) {
    const { done, value } = await reader2.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        
        try {
          const parsed = JSON.parse(data);
          
          // 查找workflow_started事件中的dialogue_count
          if (parsed.event === 'workflow_started' && parsed.data?.inputs) {
            secondDialogueCount = parsed.data.inputs['sys.dialogue_count'];
            secondConversationId = parsed.conversation_id;
            console.log(`   📊 第二条消息 - conversation_id: ${secondConversationId}`);
            console.log(`   📊 第二条消息 - dialogue_count: ${secondDialogueCount}`);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  
  // 分析结果
  console.log('\\n🔍 分析结果:');
  console.log('─'.repeat(60));
  console.log(`第一条消息 conversation_id: ${firstConversationId}`);
  console.log(`第二条消息 conversation_id: ${secondConversationId}`);
  console.log(`第一条消息 dialogue_count: ${firstDialogueCount}`);
  console.log(`第二条消息 dialogue_count: ${secondDialogueCount}`);
  
  if (firstConversationId === secondConversationId) {
    console.log('✅ Conversation ID 保持一致');
  } else {
    console.log('❌ Conversation ID 不一致 - 这是问题所在！');
  }
  
  if (secondDialogueCount > firstDialogueCount) {
    console.log('✅ Dialogue count 正确递增');
  } else {
    console.log('❌ Dialogue count 没有递增 - 这解释了为什么卡在第一个节点');
  }
  
  console.log('\\n💡 结论:');
  if (firstConversationId !== secondConversationId || secondDialogueCount <= firstDialogueCount) {
    console.log('❌ 对话状态没有正确传递给DIFY API');
    console.log('   - 每次请求都被当作新对话处理');
    console.log('   - dialogue_count始终为0，所以总是执行第一个节点');
    console.log('   - 需要修复conversation_id的传递逻辑');
  } else {
    console.log('✅ 对话状态正确传递，问题可能在别处');
  }
}

debugConversationFlow().catch(console.error);