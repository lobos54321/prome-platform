import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

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

// Environment validation
console.log('🚀 Starting Prome Platform server');
const requiredVars = ['DIFY_API_URL', 'DIFY_API_KEY'];
const missing = requiredVars.filter(varName => !process.env[`VITE_${varName}`] && !process.env[varName]);

if (missing.length > 0) {
  console.error('⚠️ WARNING: Missing required environment variables:', missing);
  console.error('Please set the following environment variables for proper API functionality:');
  missing.forEach(varName => {
    console.error(`  - VITE_${varName} or ${varName}`);
  });
  console.error('API calls may fail without proper configuration.');
} else {
  console.log('✅ Dify API environment variables are configured');
}

// UUID utility functions
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to get a valid user ID
function getValidUserId(user) {
  // If user is provided and it's a valid UUID, use it
  if (user && isValidUUID(user)) {
    return user;
  }
  
  // If user is provided but not a UUID, try to extract UUID from it
  if (user && typeof user === 'string') {
    const uuidMatch = user.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      return uuidMatch[0];
    }
  }
  
  // FIXED: Generate a valid UUID for anonymous users instead of returning null
  // This ensures Dify API always receives a valid user parameter
  const anonymousUserId = generateUUID();
  console.log('🔧 Generated anonymous user ID:', anonymousUserId);
  return anonymousUserId;
}

// Timeout configurations - Optimized for complex workflows
const DEFAULT_TIMEOUT = parseInt(process.env.VITE_DIFY_TIMEOUT_MS) || 120000; // 2 minutes (increased from 30s)
const WORKFLOW_TIMEOUT = parseInt(process.env.VITE_DIFY_WORKFLOW_TIMEOUT_MS) || 300000; // 5 minutes (increased from 2min)
const STREAMING_TIMEOUT = parseInt(process.env.VITE_DIFY_STREAMING_TIMEOUT_MS) || 240000; // 4 minutes for streaming responses
const MAX_RETRIES = parseInt(process.env.VITE_DIFY_MAX_RETRIES) || 3;

// Database health check function
async function checkDatabaseHealth(supabase) {
  if (!supabase) {
    console.log('⚠️ Database health check skipped (Supabase not configured)');
    return false;
  }

  try {
    // Check if required tables exist by attempting to query them
    const tables = ['conversations', 'messages'];
    const results = {};

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        if (error) {
          results[table] = { exists: false, error: error.message };
        } else {
          results[table] = { exists: true, error: null };
        }
      } catch (err) {
        results[table] = { exists: false, error: err.message };
      }
    }

    const allTablesExist = Object.values(results).every(result => result.exists);
    
    if (allTablesExist) {
      console.log('✅ Database health check passed - all required tables exist');
      return true;
    } else {
      console.error('❌ Database health check failed - missing tables:');
      Object.entries(results).forEach(([table, result]) => {
        if (!result.exists) {
          console.error(`  - ${table}: ${result.error}`);
        }
      });
      console.error('Please run database migrations to create missing tables');
      return false;
    }
  } catch (error) {
    console.error('❌ Database health check failed with error:', error.message);
    return false;
  }
}

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

// Utility function to ensure conversation exists before saving messages
async function ensureConversationExists(supabase, conversationId, difyConversationId = null, userId = null) {
  if (!supabase) {
    console.log('📝 Skipping conversation check (Supabase not configured)');
    return;
  }

  try {
    // First check if conversation already exists
    const { data: existingConversation, error: checkError } = await supabase
      .from('conversations')
      .select('id, dify_conversation_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing conversation:', checkError);
      return;
    }

    if (existingConversation) {
      // Update dify_conversation_id if it's missing
      if (!existingConversation.dify_conversation_id && difyConversationId) {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ 
            dify_conversation_id: difyConversationId,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId);

        if (updateError) {
          console.error('Error updating conversation mapping:', updateError);
        } else {
          console.log('✅ Updated conversation mapping with Dify ID');
        }
      }
      return;
    }

    // Create new conversation record with proper user_id handling
    const insertData = {
      id: conversationId,
      dify_conversation_id: difyConversationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Only add user_id if it's a valid UUID
    if (userId && isValidUUID(userId)) {
      insertData.user_id = userId;
    }
    // If userId is null or invalid, user_id will be null (allowed by schema)

    const { error: insertError } = await supabase
      .from('conversations')
      .insert(insertData);

    if (insertError) {
      console.error('Error creating conversation record:', insertError);
    } else {
      console.log('✅ Created new conversation record');
    }
  } catch (error) {
    console.error('Error in ensureConversationExists:', error);
  }
}

// Utility function to save messages (now expects conversation to already exist)
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




// Configuration debug endpoint
app.get('/api/config/status', async (req, res) => {
  // Initialize Supabase for health check
  let supabase = null;
  let databaseHealthy = false;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    databaseHealthy = await checkDatabaseHealth(supabase);
  }

  res.json({
    environment_configured: {
      dify_api_url: !!(DIFY_API_URL),
      dify_api_key: !!(DIFY_API_KEY),
      supabase_url: !!(SUPABASE_URL),
      supabase_service_key: !!(SUPABASE_SERVICE_ROLE_KEY)
    },
    database_health: {
      configured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      healthy: databaseHealthy,
      required_tables: ['conversations', 'messages']
    },
    api_endpoints: {
      chat: '/api/dify',
      workflow: '/api/dify/workflow',
      streaming_chat: '/api/dify/:conversationId/stream',
      blocking_chat: '/api/dify/:conversationId'
    },
    timeouts: {
      default_timeout_ms: DEFAULT_TIMEOUT,
      workflow_timeout_ms: WORKFLOW_TIMEOUT,
      streaming_timeout_ms: STREAMING_TIMEOUT,
      max_retries: MAX_RETRIES
    }
  });
});

// Dify chat proxy API (generic endpoint without conversationId - for backward compatibility)
app.post('/api/dify', async (req, res) => {
  try {
    const { message, query, user, conversation_id, inputs = {} } = req.body;
    const actualMessage = message || query; // Support both message and query fields
    
    if (!actualMessage) {
      return res.status(400).json({ error: 'Message or query is required' });
    }

    // Require API configuration
    if (!DIFY_API_URL || !DIFY_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing Dify API configuration' });
    }
    
    // Initialize Supabase only if fully configured
    let supabase = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    // Use conversation_id from request body, or generate a new UUID if invalid
    let difyConversationId = conversation_id || null;
    let conversationId = conversation_id && isValidUUID(conversation_id) ? conversation_id : generateUUID();
    
    // Log UUID generation for debugging
    if (conversation_id && !isValidUUID(conversation_id)) {
      console.log(`🔧 Generated new UUID for invalid conversation ID: ${conversation_id} -> ${conversationId}`);
    } else if (!conversation_id) {
      console.log(`🆕 Generated new conversation UUID: ${conversationId}`);
    }

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
      user: getValidUserId(user)
    };

    // Only add conversation_id if it exists and is valid
    if (difyConversationId && supabase) {
      requestBody.conversation_id = difyConversationId;
    }

    // Send message to Dify API
    let response;
    let data;
    
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
      console.error('⚠️ Dify API request failed:', error.message);
      return res.status(503).json({ 
        error: 'Dify API unavailable', 
        message: 'Unable to connect to Dify API. Please check your configuration and network connectivity.',
        details: error.message 
      });
    }

    // Ensure conversation exists BEFORE saving messages
    if (supabase) {
      // First ensure conversation record exists
      await ensureConversationExists(supabase, conversationId, data.conversation_id, getValidUserId(user));
      
      // Then save messages
      await saveMessages(supabase, conversationId, actualMessage, data);
    }

    const responseData = {
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      metadata: {
        ...data.metadata,
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

    // Use conversation_id from request body, or generate a new UUID if invalid
    let difyConversationId = conversation_id || null;
    let conversationId = conversation_id && isValidUUID(conversation_id) ? conversation_id : generateUUID();
    
    // Log UUID generation for debugging
    if (conversation_id && !isValidUUID(conversation_id)) {
      console.log(`🔧 Generated new UUID for invalid conversation ID: ${conversation_id} -> ${conversationId}`);
    } else if (!conversation_id) {
      console.log(`🆕 Generated new conversation UUID: ${conversationId}`);
    }

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
      user: getValidUserId(user)
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
            STREAMING_TIMEOUT, // Use extended streaming timeout for complex workflows
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
                      // Ensure conversation exists first
                      await ensureConversationExists(supabase, conversationId, finalData.conversation_id, getValidUserId(user));
                      
                      // Then save messages
                      await saveMessages(supabase, conversationId, actualMessage, finalData);
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
          console.error('[Workflow API] External API failed:', apiError.message);
          res.write(`data: ${JSON.stringify({ 
            error: 'Dify Workflow API unavailable', 
            message: 'Unable to connect to Dify Workflow API. Please check your configuration and network connectivity.',
            details: apiError.message 
          })}\n\n`);
          res.end();
          return;
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
          console.error('[Workflow API] External API failed:', apiError.message);
          return res.status(503).json({ 
            error: 'Dify Workflow API unavailable', 
            message: 'Unable to connect to Dify Workflow API. Please check your configuration and network connectivity.',
            details: apiError.message 
          });
        }

        // Ensure conversation exists and save messages
        if (supabase) {
          // First ensure conversation record exists
          await ensureConversationExists(supabase, conversationId, data.conversation_id, getValidUserId(user));
          
          // Then save messages
          await saveMessages(supabase, conversationId, actualMessage, data);
        }

        res.json({
          answer: data.answer || data.data?.outputs?.answer || 'Workflow completed',
          conversation_id: data.conversation_id,
          message_id: data.message_id,
          metadata: {
            ...data.metadata,
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
    const { conversationId: rawConversationId } = req.params;
    
    // Validate and fix conversation ID - generate new UUID if invalid
    const conversationId = isValidUUID(rawConversationId) ? rawConversationId : generateUUID();
    if (conversationId !== rawConversationId) {
      console.log(`🔧 Generated new UUID for invalid conversation ID: ${rawConversationId} -> ${conversationId}`);
    }
    
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
      user: getValidUserId(req.body.user) // FIXED: Pass user from request body
    };

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId && supabase) {
      requestBody.conversation_id = difyConversationId;
    }

    // 发送消息到 Dify with enhanced timeout and retry
    const response = await fetchWithTimeoutAndRetry(
      `${DIFY_API_URL}/chat-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      STREAMING_TIMEOUT // Use streaming timeout for chat streams
    );

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
                // Ensure conversation exists first
                await ensureConversationExists(supabase, conversationId, finalData.conversation_id, getValidUserId(req.body.user));
                
                // Then save messages
                await saveMessages(supabase, conversationId, message, finalData);
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
    const { conversationId: rawConversationId } = req.params;
    
    // Validate and fix conversation ID - generate new UUID if invalid
    const conversationId = isValidUUID(rawConversationId) ? rawConversationId : generateUUID();
    if (conversationId !== rawConversationId) {
      console.log(`🔧 Generated new UUID for invalid conversation ID: ${rawConversationId} -> ${conversationId}`);
    }
    
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
      user: getValidUserId(req.body.user) // FIXED: Pass user from request body
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

    // 发送消息到 Dify with enhanced timeout and retry
    let response = await fetchWithTimeoutAndRetry(
      `${DIFY_API_URL}/chat-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      DEFAULT_TIMEOUT // Use default timeout for blocking chat
    );

    // 如果是对话不存在的错误，尝试去掉 conversation_id 再试一次
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);

      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('Retrying without conversation_id');
        delete requestBody.conversation_id;

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

    // Ensure conversation exists and save messages
    if (supabase) {
      // First ensure conversation record exists
      await ensureConversationExists(supabase, conversationId, data.conversation_id, getValidUserId(req.body.user));
      
      // Then save messages  
      await saveMessages(supabase, conversationId, message, data);
    }

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
app.use(express.static(path.join(dirname, 'dist')));

// SPA 路由
app.get('*', (req, res) => {
 res.sendFile(path.join(dirname, 'dist', 'index.html'));
});

app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  
  // Perform database health check on startup
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    console.log('🔍 Performing database health check...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const isHealthy = await checkDatabaseHealth(supabase);
    
    if (!isHealthy) {
      console.error('⚠️ WARNING: Database is not healthy. Workflows may fail.');
      console.error('Please ensure database migrations have been run.');
    }
  } else {
    console.log('⚠️ Supabase not configured - database features disabled');
  }
});
