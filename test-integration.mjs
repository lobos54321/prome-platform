#!/usr/bin/env node

// Simple test script to verify Dify API integration
import { sendMessage } from './src/api/dify-api.ts';

async function testDifyIntegration() {
  console.log('🧪 Testing Dify API Integration...');
  
  try {
    // Test simple message
    console.log('📤 Sending test message...');
    const response = await sendMessage('Hello, this is a test message from the integration test');
    
    console.log('✅ Response received:');
    console.log('📝 Answer:', response.answer?.substring(0, 100) + '...');
    console.log('🔑 Conversation ID:', response.conversation_id);
    console.log('📊 Token Usage:', response.metadata?.usage);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDifyIntegration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('💥 Unexpected error:', err);
      process.exit(1);
    });
}

export { testDifyIntegration };