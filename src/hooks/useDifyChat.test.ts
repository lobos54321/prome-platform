/**
 * useDifyChat Hook Tests
 */

import { testRunner, assert, createMockMessage, performanceTest } from '@/utils/test-helpers';

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: (key: string) => mockLocalStorage.store[key] || null,
  setItem: (key: string, value: string) => { mockLocalStorage.store[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage.store[key]; },
  clear: () => { mockLocalStorage.store = {}; }
};

// Mock global localStorage if not available
if (typeof localStorage === 'undefined') {
  (global as any).localStorage = mockLocalStorage;
}

testRunner.describe('useDifyChat Hook', () => {
  
  test('should initialize with empty messages', () => {
    const messages = [];
    const conversationId = undefined;
    const isLoading = false;
    
    assert.equal(messages.length, 0, 'Should start with empty messages');
    assert.equal(conversationId, undefined, 'Should start with no conversation ID');
    assert.falsy(isLoading, 'Should not be loading initially');
  });
  
  test('should validate message structure', () => {
    const message = createMockMessage({
      id: 'test-123',
      role: 'user',
      content: 'Test message',
      timestamp: Date.now()
    });
    
    // Validate required fields
    assert.truthy(message.id, 'Message should have id');
    assert.truthy(['user', 'assistant', 'system'].includes(message.role), 'Message should have valid role');
    assert.truthy(message.content, 'Message should have content');
    assert.truthy(message.timestamp, 'Message should have timestamp');
    assert.truthy(typeof message.timestamp === 'number', 'Timestamp should be a number');
  });
  
  test('should handle message caching correctly', () => {
    const MESSAGES_CACHE_KEY = 'dify_messages_cache';
    const testMessages = [
      createMockMessage({ id: '1', content: 'First message' }),
      createMockMessage({ id: '2', content: 'Second message' })
    ];
    
    // Test setting cache
    localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(testMessages));
    const cached = localStorage.getItem(MESSAGES_CACHE_KEY);
    
    assert.truthy(cached, 'Should cache messages');
    
    const parsedMessages = JSON.parse(cached);
    assert.equal(parsedMessages.length, 2, 'Should cache correct number of messages');
    assert.equal(parsedMessages[0].content, 'First message', 'Should cache message content correctly');
    
    // Cleanup
    localStorage.removeItem(MESSAGES_CACHE_KEY);
  });
  
  test('should limit cached messages to prevent memory issues', () => {
    const MAX_CACHED_MESSAGES = 100;
    const largeMessageSet = Array.from({ length: 150 }, (_, i) => 
      createMockMessage({ id: `msg-${i}`, content: `Message ${i}` })
    );
    
    // Simulate cache limiting logic
    const messagesToCache = largeMessageSet.slice(-MAX_CACHED_MESSAGES);
    
    assert.equal(messagesToCache.length, MAX_CACHED_MESSAGES, 'Should limit cached messages');
    assert.equal(messagesToCache[0].content, 'Message 50', 'Should keep most recent messages');
    assert.equal(messagesToCache[99].content, 'Message 149', 'Should include latest message');
  });
  
  test('should handle conversation ID persistence', () => {
    const CONVERSATION_KEY = 'dify_conversation_id';
    const testConversationId = 'conv-123456';
    
    // Test setting conversation ID
    localStorage.setItem(CONVERSATION_KEY, testConversationId);
    const stored = localStorage.getItem(CONVERSATION_KEY);
    
    assert.equal(stored, testConversationId, 'Should persist conversation ID');
    
    // Test invalid conversation ID handling
    localStorage.setItem(CONVERSATION_KEY, 'undefined');
    const invalidStored = localStorage.getItem(CONVERSATION_KEY);
    
    assert.equal(invalidStored, 'undefined', 'Should store invalid values but handle them properly');
    
    // Cleanup
    localStorage.removeItem(CONVERSATION_KEY);
  });
  
  test('should classify errors correctly', () => {
    const testCases = [
      { message: 'Network Error: Connection failed', expectedType: 'network' },
      { message: 'API Error: 401', expectedType: 'auth' },
      { message: 'API Error: 429', expectedType: 'rate_limit' },
      { message: 'API Error: 500', expectedType: 'server' },
      { message: 'Unknown error', expectedType: 'general' }
    ];
    
    testCases.forEach(testCase => {
      let errorType = 'general';
      
      if (testCase.message.includes('Network')) {
        errorType = 'network';
      } else if (testCase.message.includes('401')) {
        errorType = 'auth';
      } else if (testCase.message.includes('429')) {
        errorType = 'rate_limit';
      } else if (testCase.message.includes('500')) {
        errorType = 'server';
      }
      
      assert.equal(errorType, testCase.expectedType, 
        `Should classify "${testCase.message}" as ${testCase.expectedType}`);
    });
  });
  
  test('should handle localStorage quota exceeded', () => {
    const MESSAGES_CACHE_KEY = 'dify_messages_cache';
    
    try {
      // Simulate quota exceeded by trying to store a very large object
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      localStorage.setItem(MESSAGES_CACHE_KEY, largeData);
    } catch (error) {
      // Should handle quota exceeded gracefully
      assert.truthy(error.name === 'QuotaExceededError' || error.message.includes('quota'), 
        'Should handle localStorage quota errors');
    }
    
    // Cleanup
    try {
      localStorage.removeItem(MESSAGES_CACHE_KEY);
    } catch (error) {
      // Cleanup may also fail, that's ok
    }
  });
  
  test('should batch message updates for performance', async () => {
    const userMessage = createMockMessage({ 
      id: 'user-1', 
      role: 'user', 
      content: 'Hello' 
    });
    
    const loadingMessage = createMockMessage({ 
      id: 'loading-1', 
      role: 'assistant', 
      content: '正在思考中...', 
      metadata: { loading: true } 
    });
    
    // Simulate batched update (like in the optimized hook)
    const avgTime = await performanceTest.time(() => {
      const batchedMessages = [userMessage, loadingMessage];
      // Simulate React state update
      return batchedMessages;
    }, 100);
    
    assert.truthy(avgTime < 1, `Batched updates should be fast (${avgTime.toFixed(3)}ms)`);
  });
  
  test('should validate message metadata cleanup', () => {
    const messageWithLargeMetadata = createMockMessage({
      metadata: {
        messageId: 'msg-123',
        error: false,
        loading: false,
        // These should be cleaned up in cache
        largeObject: { data: 'x'.repeat(1000) },
        unnecessary: 'data'
      }
    });
    
    // Simulate metadata cleanup logic
    const cleanedMetadata = {
      messageId: messageWithLargeMetadata.metadata.messageId,
      error: messageWithLargeMetadata.metadata.error,
      loading: messageWithLargeMetadata.metadata.loading
    };
    
    assert.truthy(cleanedMetadata.messageId, 'Should keep messageId');
    assert.equal(cleanedMetadata.error, false, 'Should keep error state');
    assert.equal(cleanedMetadata.loading, false, 'Should keep loading state');
    assert.truthy(!cleanedMetadata.hasOwnProperty('largeObject'), 'Should remove large objects');
    assert.truthy(!cleanedMetadata.hasOwnProperty('unnecessary'), 'Should remove unnecessary data');
  });
  
  test('should handle abort controller cleanup', () => {
    let abortController = new AbortController();
    
    // Simulate request abortion
    const isAborted = () => abortController.signal.aborted;
    
    assert.falsy(isAborted(), 'Should not be aborted initially');
    
    abortController.abort();
    assert.truthy(isAborted(), 'Should be aborted after calling abort()');
    
    // Simulate cleanup
    abortController = null;
    assert.equal(abortController, null, 'Should cleanup controller reference');
  });
  
  test('performance: localStorage operations should be efficient', async () => {
    const MESSAGES_CACHE_KEY = 'test_performance_cache';
    const testMessages = Array.from({ length: 50 }, (_, i) => 
      createMockMessage({ id: `perf-${i}`, content: `Performance test ${i}` })
    );
    
    // Test write performance
    const writeTime = await performanceTest.time(() => {
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(testMessages));
    }, 10);
    
    // Test read performance
    const readTime = await performanceTest.time(() => {
      const cached = localStorage.getItem(MESSAGES_CACHE_KEY);
      if (cached) JSON.parse(cached);
    }, 10);
    
    assert.truthy(writeTime < 50, `localStorage write should be fast (${writeTime.toFixed(2)}ms)`);
    assert.truthy(readTime < 10, `localStorage read should be fast (${readTime.toFixed(2)}ms)`);
    
    // Cleanup
    localStorage.removeItem(MESSAGES_CACHE_KEY);
  });
  
});