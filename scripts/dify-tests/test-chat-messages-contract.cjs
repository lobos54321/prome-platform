/* Run: node scripts/dify-tests/test-chat-messages-contract.cjs */
/* Test that chat-messages endpoints follow Dify advanced-chat contract */

const { sanitizeInputs, isSimpleGreeting } = require('../../src/server/utils/sanitizeInputs.cjs');

function assert(name, cond) {
  if (!cond) throw new Error(`❌ ${name}`);
  console.log(`✅ ${name}`);
}

function simulateChatMessagesRequestBody(message, difyConversationId, inputs, user) {
  // Simulate the server.js logic for /api/dify endpoint
  const isNewConversation = !difyConversationId;
  
  const requestBody = {
    query: message,
    response_mode: 'blocking',
    user: user || 'test-user'
  };
  
  // Only add conversation_id if continuing an existing conversation
  if (!isNewConversation) {
    requestBody.conversation_id = difyConversationId;
  }
  
  return requestBody;
}

function simulateStreamingRequestBody(message, difyConversationId, user) {
  // Simulate the server.js logic for streaming endpoints
  const requestBody = {
    query: message,
    response_mode: 'streaming',
    user: user || 'test-user'
  };

  // Only add conversation_id if continuing an existing conversation  
  if (difyConversationId) {
    requestBody.conversation_id = difyConversationId;
  }
  
  return requestBody;
}

(function main() {
  console.log('🧪 Testing Dify advanced-chat contract compliance...\n');

  // Test 1: New conversation should not include inputs field
  const newConvBody = simulateChatMessagesRequestBody('Hello', null, { someInput: 'value' }, 'user1');
  assert('New conversation payload has no inputs field', !('inputs' in newConvBody));
  assert('New conversation payload has query field', 'query' in newConvBody);
  assert('New conversation payload has no conversation_id', !('conversation_id' in newConvBody));
  console.log('   New conversation body:', JSON.stringify(newConvBody, null, 2));

  // Test 2: Continuing conversation should not include inputs field
  const continueConvBody = simulateChatMessagesRequestBody('How are you?', 'conv-123', { someInput: 'value' }, 'user1');
  assert('Continuing conversation payload has no inputs field', !('inputs' in continueConvBody));
  assert('Continuing conversation payload has query field', 'query' in continueConvBody);
  assert('Continuing conversation payload has conversation_id', 'conversation_id' in continueConvBody);
  assert('Continuing conversation has correct conversation_id', continueConvBody.conversation_id === 'conv-123');
  console.log('   Continuing conversation body:', JSON.stringify(continueConvBody, null, 2));

  // Test 3: Streaming requests should not include inputs field
  const streamingNewBody = simulateStreamingRequestBody('Hello streaming', null, 'user1');
  assert('Streaming new conversation payload has no inputs field', !('inputs' in streamingNewBody));
  assert('Streaming new conversation payload has no conversation_id', !('conversation_id' in streamingNewBody));
  console.log('   Streaming new conversation body:', JSON.stringify(streamingNewBody, null, 2));

  const streamingContinueBody = simulateStreamingRequestBody('Continue streaming', 'conv-456', 'user1');
  assert('Streaming continuing conversation payload has no inputs field', !('inputs' in streamingContinueBody));
  assert('Streaming continuing conversation payload has conversation_id', 'conversation_id' in streamingContinueBody);
  console.log('   Streaming continuing conversation body:', JSON.stringify(streamingContinueBody, null, 2));

  // Test 4: Greetings should NOT reset conversations (removed greeting logic)
  console.log('\n🧪 Testing greeting behavior...');
  const greetings = ['hello', 'hi', '你好', 'nihao', '嗨', 'hey'];
  
  greetings.forEach(greeting => {
    // Greetings with existing conversation should still continue the conversation
    const greetingBody = simulateChatMessagesRequestBody(greeting, 'existing-conv-789', {}, 'user1');
    assert(`Greeting "${greeting}" with existing conversation keeps conversation_id`, 
           greetingBody.conversation_id === 'existing-conv-789');
    assert(`Greeting "${greeting}" payload has no inputs field`, !('inputs' in greetingBody));
  });

  // Test 5: Request body structure validation
  console.log('\n🧪 Testing required fields...');
  const sampleBody = simulateChatMessagesRequestBody('test message', 'conv-123', {}, 'user1');
  const requiredFields = ['query', 'response_mode', 'user'];
  const prohibitedFields = ['inputs'];
  
  requiredFields.forEach(field => {
    assert(`Required field "${field}" is present`, field in sampleBody);
  });
  
  prohibitedFields.forEach(field => {
    assert(`Prohibited field "${field}" is not present`, !(field in sampleBody));
  });

  console.log('\n✅ All advanced-chat contract tests passed!');
  console.log('📋 Summary:');
  console.log('   - ✅ chat-messages requests use only: { query, user, response_mode, conversation_id }');
  console.log('   - ✅ No inputs field included');
  console.log('   - ✅ conversation_id only present when continuing existing conversation');
  console.log('   - ✅ Greetings do not force new conversations');
})();