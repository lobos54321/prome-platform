import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// 初始化 Stripe，确保 Zeabur 或本地 .env 设置了 STRIPE_SECRET_KEY
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());

// Configuration from environment variables
const DIFY_API_URL = process.env.VITE_DIFY_API_URL || process.env.DIFY_API_URL || '';
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY || process.env.DIFY_API_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Timeout configurations
const DEFAULT_TIMEOUT = parseInt(process.env.VITE_DIFY_TIMEOUT_MS) || 30000; // 30 seconds
const WORKFLOW_TIMEOUT = parseInt(process.env.VITE_DIFY_WORKFLOW_TIMEOUT_MS) || 120000; // 2 minutes
const MAX_RETRIES = parseInt(process.env.VITE_DIFY_MAX_RETRIES) || 3;

// Enhanced fetch with timeout and retry logic
async function fetchWithTimeoutAndRetry(url, options, timeoutMs = DEFAULT_TIMEOUT, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If request succeeded or it's a client error (4xx), don't retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // For server errors (5xx), retry
      if (attempt < maxRetries) {
        console.warn(`🔄 Request failed with ${response.status}, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      // Handle timeout and network errors
      if (error.name === 'AbortError') {
        console.warn(`⏰ Request timed out after ${timeoutMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`❌ Network error: ${error.message} (attempt ${attempt + 1}/${maxRetries + 1})`);
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If all retries failed, throw the last error with a more user-friendly message
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      } else if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND') {
        throw new Error('Cannot connect to Dify API. Please check your internet connection or try again later.');
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed. Please check your connection and try again.');
}

// Utility function to save messages
async function saveMessages(supabase, conversationId, userMessage, difyResponse) {
  // Skip saving if Supabase is not configured
  if (!supabase) {
    console.log('📝 Skipping message saving (Supabase not configured)');
    return;
  }

  try {
    // Save user message
    const { error: userError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      });

    if (userError) {
      console.error('Error saving user message:', userError);
      return;
    }

    // Save assistant message
    const { error: assistantError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: difyResponse.answer,
        dify_message_id: difyResponse.message_id,
        token_usage: difyResponse.metadata?.usage || null,
        created_at: new Date().toISOString()
      });

    if (assistantError) {
      console.error('Error saving assistant message:', assistantError);
      return;
    }

    console.log('✅ Messages saved successfully');
  } catch (error) {
    console.error('Error in saveMessages:', error);
  }
}

// Utility function to handle conversation mapping operations
async function updateConversationMapping(supabase, conversationId, difyConversationId) {
  if (!supabase || !difyConversationId) {
    console.log('📝 Skipping conversation mapping (Supabase not configured or no dify conversation ID)');
    return;
  }

  try {
    const { error } = await supabase
      .from('conversations')
      .upsert({ 
        id: conversationId,
        dify_conversation_id: difyConversationId,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating conversation mapping:', error);
    } else {
      console.log('✅ Conversation mapping updated successfully');
    }
  } catch (error) {
    console.error('Error in updateConversationMapping:', error);
  }
}

// Utility function to get stored conversation ID
async function getStoredConversationId(supabase, conversationId) {
  if (!supabase || !conversationId) {
    return null;
  }

  try {
    const { data } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .single();

    return data?.dify_conversation_id || null;
  } catch (error) {
    console.log('Could not retrieve stored conversation ID:', error.message);
    return null;
  }
}

// Mock response generator for development/testing
function generateMockDifyResponse(message, conversationId = null) {
  const mockConversationId = conversationId || `mock-conv-${Date.now()}`;
  const mockMessageId = `mock-msg-${Date.now()}`;
  
  // Generate a meaningful mock response based on the input message
  let mockAnswer;
  if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('你好')) {
    mockAnswer = "Hello! I'm your AI assistant. I'm currently running in development mode with mock responses. How can I help you today?";
  } else if (message.toLowerCase().includes('test')) {
    mockAnswer = "This is a test response from the mock API. The chat interface is working correctly!";
  } else if (message.toLowerCase().includes('workflow')) {
    mockAnswer = "I understand you're asking about workflows. In a real environment, I would process complex workflows step by step.";
  } else {
    mockAnswer = `Thank you for your message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}". I'm currently operating in development mode with mock responses. In a production environment, I would provide real AI-powered responses through the Dify API.`;
  }
  
  return {
    answer: mockAnswer,
    conversation_id: mockConversationId,
    message_id: mockMessageId,
    metadata: {
      usage: {
        prompt_tokens: Math.floor(message.length / 4), // Rough estimation
        completion_tokens: Math.floor(mockAnswer.length / 4),
        total_tokens: Math.floor((message.length + mockAnswer.length) / 4)
      }
    }
  };
}

// Mock workflow response with streaming simulation
function generateMockWorkflowStream(message, conversationId = null) {
  const mockConversationId = conversationId || `mock-workflow-conv-${Date.now()}`;
  const mockMessageId = `mock-workflow-msg-${Date.now()}`;
  
  return [
    { event: 'workflow_started', data: { message: 'Starting workflow processing...' } },
    { event: 'node_started', node_id: 'input_node', node_name: 'Input Processing', node_title: 'Processing User Input' },
    { event: 'node_finished', node_id: 'input_node', node_name: 'Input Processing' },
    { event: 'node_started', node_id: 'analysis_node', node_name: 'Content Analysis', node_title: 'Analyzing Request' },
    { event: 'node_finished', node_id: 'analysis_node', node_name: 'Content Analysis' },
    { event: 'node_started', node_id: 'response_node', node_name: 'Response Generation', node_title: 'Generating Response' },
    { 
      event: 'message', 
      answer: `[MOCK WORKFLOW] Processing your request: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}". In a real environment, this would involve multiple AI processing steps.`,
      conversation_id: mockConversationId,
      message_id: mockMessageId
    },
    { event: 'node_finished', node_id: 'response_node', node_name: 'Response Generation' },
    { 
      event: 'workflow_finished', 
      conversation_id: mockConversationId,
      message_id: mockMessageId,
      metadata: {
        usage: {
          prompt_tokens: Math.floor(message.length / 4),
          completion_tokens: Math.floor(200 / 4), // Rough estimation for mock response
          total_tokens: Math.floor((message.length + 200) / 4)
        }
      }
    },
    { event: 'message_end', conversation_id: mockConversationId, message_id: mockMessageId }
  ];
}

// Dify chat proxy API (generic endpoint without conversationId - for backward compatibility)
app.post('/api/dify', async (req, res) => {
  try {
    const { message, query, user, conversation_id, inputs = {} } = req.body;
    const actualMessage = message || query; // Support both message and query fields
    
    if (!DIFY_API_URL || !DIFY_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing Dify API configuration' });
    }
    
    if (!actualMessage) {
      return res.status(400).json({ error: 'Message or query is required' });
    }
    
    // Initialize Supabase only if fully configured
    let supabase = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    // Use conversation_id from request body, or generate a new one
    let difyConversationId = conversation_id || null;
    let conversationId = conversation_id || 'default';

    // If we have a conversation_id, check if it exists in our database
    if (difyConversationId && supabase) {
      const { data: conversationRow } = await supabase
        .from('conversations')
        .select('dify_conversation_id')
        .eq('id', conversationId)
        .single();

      if (conversationRow?.dify_conversation_id) {
        difyConversationId = conversationRow.dify_conversation_id;
      }
    }

    const requestBody = {
      inputs: inputs,
      query: actualMessage,
      response_mode: 'blocking',
      user: user || 'default-user'
    };

    // Only add conversation_id if it exists and is valid
    if (difyConversationId && supabase) {
      requestBody.conversation_id = difyConversationId;
    }

    // Send message to Dify with fallback to mock response
    let response;
    let data;
    let isUsingMockResponse = false;
    
    try {
      response = await fetchWithTimeoutAndRetry(
        `${DIFY_API_URL}/chat-messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Dify API error:', errorData);

        if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
          console.log('Retrying without conversation_id');
          delete requestBody.conversation_id;

          response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            throw new Error('Dify API request failed after retry');
          }
        } else {
          throw new Error(`Dify API error: ${errorData.message || 'Unknown error'}`);
        }
      }

      data = await response.json();
      console.log('✅ Successfully received response from Dify API');
      
    } catch (error) {
      console.warn('⚠️ Dify API request failed, falling back to mock response:', error.message);
      
      // Use mock response in development or when external API is unavailable
      data = generateMockDifyResponse(actualMessage, difyConversationId);
      isUsingMockResponse = true;
      
      console.log('🤖 Using mock response for development/testing');
    }

    // If this was a new conversation and not using mock, save the mapping
    if (!difyConversationId && data.conversation_id && !isUsingMockResponse && supabase) {
      // Create or update conversation mapping
      const { error: upsertError } = await supabase
        .from('conversations')
        .upsert({ 
          id: conversationId,
          dify_conversation_id: data.conversation_id,
          updated_at: new Date().toISOString()
        });

      if (upsertError) {
        console.error('Error saving conversation mapping:', upsertError);
      }
    }

    // Save messages (but mark mock responses appropriately)
    if (supabase) {
      await saveMessages(supabase, conversationId, actualMessage, {
        ...data,
        answer: isUsingMockResponse ? `[MOCK] ${data.answer}` : data.answer
      });
    }

    const responseData = {
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      metadata: {
        ...data.metadata,
        mock_response: isUsingMockResponse,
        timestamp: new Date().toISOString()
      }
    };

    res.json(responseData);
  } catch (error) {
    console.error('Generic Dify API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced Dify workflow API with progress indicators
app.post('/api/dify/workflow', async (req, res) => {
  try {
    const { message, query, user, conversation_id, inputs = {}, stream = true } = req.body;
    const actualMessage = message || query; // Support both message and query fields
    
    if (!DIFY_API_URL || !DIFY_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing Dify API configuration' });
    }
    
    if (!actualMessage) {
      return res.status(400).json({ error: 'Message or query is required' });
    }
    
    console.log('[Workflow API] Processing request:', {
      message: actualMessage.substring(0, 100) + '...',
      user,
      conversation_id,
      stream,
      timestamp: new Date().toISOString()
    });
    
    // Initialize Supabase only if fully configured
    const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

    // Use conversation_id from request body, or generate a new one
    let difyConversationId = conversation_id || null;
    let conversationId = conversation_id || 'default';

    // If we have a conversation_id, check if it exists in our database
    if (difyConversationId && supabase) {
      const { data: conversationRow } = await supabase
        .from('conversations')
        .select('dify_conversation_id')
        .eq('id', conversationId)
        .single();

      if (conversationRow?.dify_conversation_id) {
        difyConversationId = conversationRow.dify_conversation_id;
      }
    }

    const requestBody = {
      inputs: {
        ...inputs,
        query: actualMessage // For workflows, message goes in inputs.query
      },
      response_mode: stream ? 'streaming' : 'blocking',
      user: user || 'default-user'
    };

    // Only add conversation_id if it exists and is valid
    if (difyConversationId && supabase) {
      requestBody.conversation_id = difyConversationId;
    }

    if (stream) {
      // Handle streaming response for workflow progress
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      try {
        let isUsingMockResponse = false;
        
        try {
          const response = await fetchWithTimeoutAndRetry(
            `${DIFY_API_URL}/workflows/run`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            },
            WORKFLOW_TIMEOUT,
            2 // Fewer retries for workflows since they're expensive
          );

          if (!response.ok) {
            throw new Error(`Workflow API error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to get response reader');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let fullAnswer = '';
          let finalData = null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  
                  if (data === '[DONE]') {
                    // Save messages to database if we have final data
                    if (finalData && supabase) {
                      await saveMessages(supabase, conversationId, actualMessage, finalData);
                      
                      // Update conversation mapping if needed
                      if (!difyConversationId && finalData.conversation_id) {
                        await supabase
                          .from('conversations')
                          .upsert({ 
                            id: conversationId,
                            dify_conversation_id: finalData.conversation_id,
                            updated_at: new Date().toISOString()
                          });
                      }
                    }
                    
                    res.write('data: [DONE]\n\n');
                    res.end();
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    
                    // Log workflow events for debugging
                    if (parsed.event && parsed.event.startsWith('node_')) {
                      console.log('[Workflow API] Node event:', {
                        event: parsed.event,
                        node_id: parsed.node_id,
                        node_name: parsed.node_name,
                        timestamp: new Date().toISOString()
                      });
                    }

                    // Collect answer content and final data
                    if (parsed.event === 'message' && parsed.answer) {
                      fullAnswer += parsed.answer;
                    } else if (parsed.event === 'message_end' || parsed.event === 'workflow_finished') {
                      finalData = {
                        answer: fullAnswer || parsed.answer || 'Workflow completed',
                        conversation_id: parsed.conversation_id,
                        message_id: parsed.message_id,
                        metadata: parsed.metadata
                      };
                    }

                    // Forward the parsed data to client
                    res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                  } catch (parseError) {
                    console.warn('[Workflow API] Parse error:', parseError, 'Data:', data);
                    // Still forward the raw data in case client can handle it
                    res.write(`data: ${data}\n\n`);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

        } catch (apiError) {
          console.warn('[Workflow API] External API failed, using mock response:', apiError.message);
          isUsingMockResponse = true;
          
          // Use mock workflow streaming response
          const mockEvents = generateMockWorkflowStream(actualMessage, difyConversationId);
          let finalMockData = null;
          
          for (const event of mockEvents) {
            // Add delay to simulate real workflow processing
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (event.event === 'message_end') {
              // Save mock messages to database if available
              if (finalMockData && supabase) {
                await saveMessages(supabase, conversationId, actualMessage, {
                  ...finalMockData,
                  answer: `[MOCK] ${finalMockData.answer}`
                });
              }
              
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            } else if (event.event === 'workflow_finished') {
              finalMockData = {
                answer: mockEvents.find(e => e.event === 'message')?.answer || 'Mock workflow completed',
                conversation_id: event.conversation_id,
                message_id: event.message_id,
                metadata: {
                  ...event.metadata,
                  mock_response: true
                }
              };
            }
            
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        }

      } catch (error) {
        console.error('[Workflow API] Streaming error:', error);
        const errorMessage = error.name === 'AbortError' 
          ? 'Workflow execution timed out. Please try again.' 
          : `Workflow streaming error: ${error.message}`;
        
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }

      // Handle client disconnect
      req.on('close', () => {
        console.log('[Workflow API] Client disconnected');
        res.end();
      });

    } else {
      // Handle non-streaming response
      try {
        let data;
        let isUsingMockResponse = false;
        
        try {
          const response = await fetchWithTimeoutAndRetry(
            `${DIFY_API_URL}/workflows/run`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            },
            WORKFLOW_TIMEOUT
          );

          if (!response.ok) {
            throw new Error(`Workflow API error: ${response.status}`);
          }

          data = await response.json();
          console.log('✅ Successfully received workflow response from Dify API');
          
        } catch (apiError) {
          console.warn('[Workflow API] External API failed, using mock response:', apiError.message);
          isUsingMockResponse = true;
          
          // Generate mock workflow response
          const mockEvents = generateMockWorkflowStream(actualMessage, difyConversationId);
          const mockMessageEvent = mockEvents.find(e => e.event === 'message');
          const mockFinishedEvent = mockEvents.find(e => e.event === 'workflow_finished');
          
          data = {
            answer: mockMessageEvent?.answer || 'Mock workflow response',
            conversation_id: mockFinishedEvent?.conversation_id,
            message_id: mockFinishedEvent?.message_id,
            metadata: {
              ...mockFinishedEvent?.metadata,
              mock_response: true
            }
          };
        }

        // If this was a new conversation and not using mock, save the mapping
        if (!difyConversationId && data.conversation_id && !isUsingMockResponse && supabase) {
          await supabase
            .from('conversations')
            .upsert({ 
              id: conversationId,
              dify_conversation_id: data.conversation_id,
              updated_at: new Date().toISOString()
            });
        }

        // Save messages (mark mock responses appropriately)
        if (supabase) {
          await saveMessages(supabase, conversationId, actualMessage, {
            ...data,
            answer: isUsingMockResponse ? `[MOCK] ${data.answer}` : data.answer
          });
        }

        res.json({
          answer: data.answer || data.data?.outputs?.answer || 'Workflow completed',
          conversation_id: data.conversation_id,
          message_id: data.message_id,
          metadata: {
            ...data.metadata,
            mock_response: isUsingMockResponse,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('[Workflow API] Error:', error);
        const errorMessage = error.name === 'AbortError' 
          ? 'Workflow execution timed out. Please try again.' 
          : 'Workflow processing failed';
        
        res.status(500).json({ error: errorMessage, details: error.message });
      }
    }

  } catch (error) {
    console.error('[Workflow API] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Dify chat proxy API (streaming)
app.post('/api/dify/:conversationId/stream', async (req, res) => {
  try {
    const { message, inputs = {} } = req.body;
    const { conversationId } = req.params;
    
    if (!DIFY_API_URL || !DIFY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing required environment variables' });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 查找当前会话的 dify_conversation_id
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .single();

    let difyConversationId = conversationRow?.dify_conversation_id || null;

    const requestBody = {
      inputs: inputs,
      query: message,
      response_mode: 'streaming',
      user: 'default-user'
    };

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId && supabase) {
      requestBody.conversation_id = difyConversationId;
    }

    // 发送消息到 Dify
    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);
      return res.status(response.status).json({
        error: errorData.message || 'Dify API error',
        detail: errorData
      });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Pipe the streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'No response body reader available' });
    }

    const decoder = new TextDecoder();
    let fullAnswer = '';
    let finalData = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Save messages to database
              if (finalData) {
                await saveMessages(supabase, conversationId, message, finalData);
                
                // Update conversation mapping if needed
                if (!difyConversationId && finalData.conversation_id) {
                  await supabase
                    .from('conversations')
                    .update({ dify_conversation_id: finalData.conversation_id })
                    .eq('id', conversationId);
                }
              }
              
              res.write(`data: [DONE]\n\n`);
              res.end();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Collect answer content and final data
              if (parsed.event === 'message' && parsed.answer) {
                fullAnswer += parsed.answer;
              } else if (parsed.event === 'message_end') {
                finalData = {
                  answer: fullAnswer,
                  conversation_id: parsed.conversation_id,
                  message_id: parsed.message_id,
                  metadata: parsed.metadata
                };
              }
              
              // Forward the chunk to client
              res.write(`data: ${data}\n\n`);
            } catch (e) {
              console.warn('Failed to parse stream chunk:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      res.end();
    }
  } catch (error) {
    console.error('Stream API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dify chat proxy API (blocking)
app.post('/api/dify/:conversationId', async (req, res) => {
  try {
    const { message, inputs = {} } = req.body;
    const { conversationId } = req.params;
    
    if (!DIFY_API_URL || !DIFY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing required environment variables' });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 查找当前会话的 dify_conversation_id
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .single();

    let difyConversationId = conversationRow?.dify_conversation_id || null;

    const requestBody = {
      inputs: inputs,
      query: message,
      response_mode: 'blocking',
      user: 'default-user'
    };

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId && supabase) {
      // 先验证对话是否仍然存在
      const checkResponse = await fetch(`${DIFY_API_URL}/conversations/${difyConversationId}`, {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
        },
      });

      if (checkResponse.ok) {
        requestBody.conversation_id = difyConversationId;
      } else {
        // 对话不存在，清除无效的 ID
        console.log('Dify conversation not found, creating new one');
        difyConversationId = null;
        await supabase
          .from('conversations')
          .update({ dify_conversation_id: null })
          .eq('id', conversationId);
        // 不直接 return，继续往下走，让 chat-messages 创建新对话
      }
    }

    // 发送消息到 Dify
    let response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // 如果是对话不存在的错误，尝试去掉 conversation_id 再试一次
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);

      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('Retrying without conversation_id');
        delete requestBody.conversation_id;

        response = await fetch(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // 如果重试依然失败，返回错误
        if (!response.ok) {
          const retryErrorData = await response.json();
          return res.status(response.status).json({
            error: retryErrorData.message || 'Dify API error',
            detail: retryErrorData
          });
        }
      } else {
        return res.status(response.status).json({
          error: errorData.message || 'Dify API error',
          detail: errorData
        });
      }
    }

    const data = await response.json();

    // 如果是新对话，保存 Dify 的 conversation_id
    if (!difyConversationId && data.conversation_id) {
      await supabase
        .from('conversations')
        .update({ dify_conversation_id: data.conversation_id })
        .eq('id', conversationId);
    }

    // 保存消息
    await saveMessages(supabase, conversationId, message, data);

    res.json({
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      metadata: data.metadata
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe 充值积分接口
app.post('/api/payment/stripe', async (req, res) => {
  try {
    const { amount } = req.body; // 单位：美元
    if (!amount || amount < 5) {
      return res.status(400).json({ error: '充值金额不能低于5美元' });
    }

    // Stripe 以分为单位，需*100
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      // 你可以在 metadata 里加上用户id等信息，方便后续业务处理
      metadata: {
        // userId: req.user.id (如有登录系统)
      }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 其它 API 路由可继续添加...

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
