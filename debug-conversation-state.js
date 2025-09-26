#!/usr/bin/env node

/**
 * 调试对话状态维持问题
 * 检查是否正确使用了conversation_id
 */

import { randomUUID } from 'crypto';

async function debugConversationState() {
  console.log('🔍 调试对话状态维持\n');
  
  const conversationId = randomUUID();
  console.log('🆔 本地对话ID:', conversationId);
  
  // 第一次调用
  console.log('\n=== 第一次调用 ===');
  const response1 = await fetch(`http://localhost:8080/api/dify/${conversationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '你好',
      user: `debug-${conversationId}`,
      mode: 'blocking'
    })
  });
  
  const result1 = await response1.json();
  console.log('📋 DIFY conversation_id:', result1.conversation_id);
  console.log('📝 响应:', result1.answer);
  
  // 第二次调用 - 应该使用相同的DIFY conversation_id
  console.log('\n=== 第二次调用 ===');
  const response2 = await fetch(`http://localhost:8080/api/dify/${conversationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '我的产品是AI编程助手',
      user: `debug-${conversationId}`,
      mode: 'blocking'
    })
  });
  
  const result2 = await response2.json();
  console.log('📋 DIFY conversation_id:', result2.conversation_id);
  console.log('📝 响应:', result2.answer);
  
  // 检查conversation_id是否一致
  if (result1.conversation_id === result2.conversation_id) {
    console.log('\n✅ 对话状态正确维持 - DIFY conversation_id 一致');
  } else {
    console.log('\n❌ 对话状态错误 - DIFY conversation_id 不一致');
    console.log('第一次:', result1.conversation_id);
    console.log('第二次:', result2.conversation_id);
  }
}

debugConversationState().catch(console.error);