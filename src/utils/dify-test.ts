// Test Dify API connection
async function testDifyConnection() {
  const testUserId = 'test-user-' + Date.now();
  
  console.log('Testing with user:', testUserId);
  
  try {
    // First conversation
    const response1 = await fetch('/api/dify/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello',
        conversationId: null,
        userId: testUserId,
      }),
    });
    
    const data1 = await response1.json();
    console.log('First response:', data1);
    
    if (!data1.conversation_id) {
      console.error('No conversation_id returned!');
      return;
    }
    
    // Second conversation - should go to next node
    const response2 = await fetch('/api/dify/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Continue',
        conversationId: data1.conversation_id,
        userId: testUserId,
      }),
    });
    
    const data2 = await response2.json();
    console.log('Second response:', data2);
    
    // Check if nodes changed
    if (data1.metadata?.node_id === data2.metadata?.node_id) {
      console.warn('Still in the same node!');
    } else {
      console.log('Successfully moved to next node');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for use in browser console or testing scripts
if (typeof window !== 'undefined') {
  (window as any).testDifyConnection = testDifyConnection;
}

export { testDifyConnection };