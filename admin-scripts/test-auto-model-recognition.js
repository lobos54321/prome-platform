/**
 * Test script for DifyIframeMonitor auto model recognition
 * This simulates Dify message_end events to test the auto model creation
 */

import { difyIframeMonitor } from '../src/lib/dify-iframe-monitor.js';

// Mock data for testing
const testEvents = [
  {
    event: 'message_end',
    conversation_id: 'test-conv-1',
    message_id: 'test-msg-1',
    model_name: 'gpt-4o-mini',
    input_tokens: 1500,
    output_tokens: 800,
    total_tokens: 2300,
    timestamp: new Date().toISOString(),
    user_id: 'test-user-123'
  },
  {
    event: 'message_end', 
    conversation_id: 'test-conv-2',
    message_id: 'test-msg-2',
    model_name: 'claude-3-sonnet-20240229',
    input_tokens: 2000,
    output_tokens: 1200,
    total_tokens: 3200,
    timestamp: new Date().toISOString(),
    user_id: 'test-user-123'
  },
  {
    event: 'message_end',
    conversation_id: 'test-conv-3', 
    message_id: 'test-msg-3',
    model_name: 'custom-local-model-v1',
    input_tokens: 1000,
    output_tokens: 500,
    total_tokens: 1500,
    timestamp: new Date().toISOString(),
    user_id: 'test-user-123'
  }
];

async function testAutoModelRecognition() {
  console.log('🧪 Testing Auto Model Recognition');
  console.log('================================');
  
  // Set up callbacks to monitor activity
  difyIframeMonitor.setOnNewModelDetected((model) => {
    console.log('🎉 New model auto-detected:', {
      name: model.modelName,
      serviceType: model.serviceType,
      inputPrice: model.inputTokenPrice,
      outputPrice: model.outputTokenPrice,
      autoCreated: model.autoCreated
    });
  });

  difyIframeMonitor.setOnTokenConsumption((event) => {
    console.log('💰 Token consumption processed:', {
      model: event.modelName,
      totalTokens: event.totalTokens,
      timestamp: event.timestamp
    });
  });

  difyIframeMonitor.setOnBalanceUpdate((newBalance) => {
    console.log('💳 Balance updated to:', newBalance);
  });

  // Initialize and start monitoring
  console.log('🚀 Starting iframe monitor...');
  difyIframeMonitor.startListening('test-user-123');

  // Simulate incoming events
  for (const event of testEvents) {
    console.log(`\n📡 Simulating event for model: ${event.model_name}`);
    
    // Create a mock message event
    const mockEvent = new MessageEvent('message', {
      data: {
        event: 'message_end',
        data: event
      },
      origin: window.location.origin
    });
    
    // Trigger the event handler
    window.dispatchEvent(mockEvent);
    
    // Wait a bit between events
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Test completed!');
  console.log('Check the console for auto-detected models and processed events.');
  
  // Stop monitoring
  difyIframeMonitor.stopListening();
}

// Export for use in console
window.testAutoModelRecognition = testAutoModelRecognition;

console.log('🔧 Auto model recognition test loaded!');
console.log('Run: testAutoModelRecognition() in the console to start the test');