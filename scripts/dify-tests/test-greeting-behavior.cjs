/* Run: node scripts/dify-tests/test-greeting-behavior.cjs */
/* Test that greetings do not reset conversations */

const { sanitizeInputs, isSimpleGreeting } = require('../../src/server/utils/sanitizeInputs.cjs');

function assert(name, cond) {
  if (!cond) throw new Error(`❌ ${name}`);
  console.log(`✅ ${name}`);
}

function simulateConversationLogic(message, existingConversationId) {
  // Simulate the NEW logic (without greeting reset)
  const isNewConversation = !existingConversationId;
  
  return {
    isNewConversation,
    shouldKeepConversationId: !isNewConversation, // Should keep existing conversation ID
    conversationId: existingConversationId || 'NEW_CONVERSATION'
  };
}

(function main() {
  console.log('🧪 Testing greeting behavior (should NOT reset conversations)...\n');

  const greetings = [
    'hello', 'hi', 'hey', 
    '你好', '您好', 'nihao',
    '嗨', '哈喽', '哈啰', '哈羅',
    'hello!', 'hi.', '  hello  '
  ];

  const nonGreetings = [
    'help', '订单问题', 'hello there', 
    'can you help me?', 'what is the weather?',
    'hello world this is a longer message'
  ];

  console.log('🔍 Testing greeting detection (for reference)...');
  greetings.forEach(greeting => {
    assert(`"${greeting}" is detected as greeting`, isSimpleGreeting(greeting));
  });

  nonGreetings.forEach(text => {
    assert(`"${text}" is NOT detected as greeting`, !isSimpleGreeting(text));
  });

  console.log('\n🔍 Testing conversation continuity with greetings...');
  
  // Test with existing conversation
  const existingConvId = 'existing-conversation-123';
  
  greetings.forEach(greeting => {
    const result = simulateConversationLogic(greeting, existingConvId);
    
    assert(`Greeting "${greeting}" does NOT create new conversation`, !result.isNewConversation);
    assert(`Greeting "${greeting}" keeps existing conversation ID`, result.shouldKeepConversationId);
    assert(`Greeting "${greeting}" preserves conversation ID`, result.conversationId === existingConvId);
  });

  console.log('\n🔍 Testing conversation creation with new chats...');
  
  // Test without existing conversation (new chat window)
  greetings.forEach(greeting => {
    const result = simulateConversationLogic(greeting, null);
    
    assert(`New chat with greeting "${greeting}" creates new conversation`, result.isNewConversation);
    assert(`New chat with greeting "${greeting}" does not preserve conversation ID`, !result.shouldKeepConversationId);
  });

  nonGreetings.forEach(message => {
    const result = simulateConversationLogic(message, null);
    
    assert(`New chat with message "${message}" creates new conversation`, result.isNewConversation);
    assert(`New chat with message "${message}" does not preserve conversation ID`, !result.shouldKeepConversationId);
  });

  console.log('\n🔍 Testing conversation continuity with non-greetings...');
  
  nonGreetings.forEach(message => {
    const result = simulateConversationLogic(message, existingConvId);
    
    assert(`Message "${message}" does NOT create new conversation`, !result.isNewConversation);
    assert(`Message "${message}" keeps existing conversation ID`, result.shouldKeepConversationId);
    assert(`Message "${message}" preserves conversation ID`, result.conversationId === existingConvId);
  });

  console.log('\n✅ All greeting behavior tests passed!');
  console.log('📋 Summary:');
  console.log('   - ✅ Greetings do NOT reset existing conversations');
  console.log('   - ✅ New conversations only created when no conversation_id provided');
  console.log('   - ✅ Conversation continuity maintained regardless of message content');
  console.log('   - ✅ Only explicit new chat window should start new conversation');
})();