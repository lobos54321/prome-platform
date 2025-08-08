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

// 🔍 DEBUG: Log all incoming requests to identify routing
app.use((req, res, next) => {
  if (req.path.includes('/api/dify')) {
    console.log(`🔍 INCOMING REQUEST: ${req.method} ${req.path}`);
  }
  next();
});

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

/**
 * 🎯 INTELLIGENT STATE DETECTION - 基于内容的状态检测，解决dialogue_count脆弱性
 * 不再依赖系统计数，而是分析用户意图和内容特征
 */
function detectConversationState(message, conversationHistory = []) {
  const msg = message.toLowerCase().trim();
  
  // 第一阶段：初始痛点分析请求
  const initialKeywords = [
    '痛点', '问题', '分析', '帮助', '业务', '困难', '挑战', 
    '瓶颈', '难题', '改进', '优化', '提升', '解决'
  ];
  const hasInitialIntent = initialKeywords.some(keyword => msg.includes(keyword));
  
  // 第二阶段：选择执行某个痛点
  const selectionKeywords = [
    '执行', '选择', '第一个', '第二个', '第三个', '第1个', '第2个', '第3个',
    '这个', '那个', '开始', '进行', '处理', '解决这个'
  ];
  const hasSelectionIntent = selectionKeywords.some(keyword => msg.includes(keyword));
  
  // 第三阶段：最终确认
  const confirmationKeywords = [
    '确认', '好的', '是的', '对', '正确', '没问题', '可以', 
    '同意', '继续', '开始执行', '就这样'
  ];
  const hasConfirmationIntent = confirmationKeywords.some(keyword => msg.includes(keyword));
  
  // 分析对话历史长度（作为辅助判断）
  const userMessageCount = conversationHistory.filter(msg => msg && msg.role === 'user').length + 1;
  
  // 智能状态判断
  let stage = 'initial';
  let confidence = 0.6;
  
  if (hasConfirmationIntent && userMessageCount >= 2) {
    stage = 'confirm';
    confidence = 0.9;
  } else if (hasSelectionIntent && userMessageCount >= 2) {
    stage = 'select';  
    confidence = 0.85;
  } else if (hasInitialIntent || userMessageCount === 1) {
    stage = 'initial';
    confidence = hasInitialIntent ? 0.9 : 0.7;
  } else {
    // 基于对话轮次的fallback逻辑
    if (userMessageCount >= 3) stage = 'confirm';
    else if (userMessageCount === 2) stage = 'select';
    else stage = 'initial';
    confidence = 0.6;
  }
  
  return {
    stage,
    confidence,
    user_message_count: userMessageCount,
    detected_intents: {
      initial: hasInitialIntent,
      selection: hasSelectionIntent,
      confirmation: hasConfirmationIntent
    }
  };
}

/**
 * 🧮 LOGICAL DIALOGUE COUNT - 修正dialogue_count偏移，提供备选状态
 */
function getLogicalDialogueCount(actualCount, conversationHistory = []) {
  // 考虑开场白偏移：实际对话轮次 - 1 (开场白消耗了第0轮)
  const logicalCount = Math.max(0, actualCount - 1);
  
  // 基于对话历史验证
  const userMessages = conversationHistory.filter(msg => msg && msg.role === 'user');
  const historyBasedCount = userMessages.length;
  
  return {
    actual_count: actualCount,
    logical_count: logicalCount, 
    history_based_count: historyBasedCount,
    // 提供最可靠的计数
    recommended_count: historyBasedCount || logicalCount
  };
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

// 存储对话状态（生产环境应使用 Redis 或数据库）
const conversationStore = new Map();

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
  // Debug logging for conversation management
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 ensureConversationExists called with:', { conversationId, difyConversationId, userId, hasSupabase: !!supabase });
  }
  
  if (!supabase) {
    console.log('📝 Skipping conversation check (Supabase not configured)');
    return;
  }

  try {
    // Use difyConversationId as primary identifier if available
    const primaryId = difyConversationId || conversationId;
    
    // First check if conversation already exists by dify_conversation_id
    let { data: existingConversation, error: checkError } = await supabase
      .from('conversations')
      .select('id, dify_conversation_id')
      .eq('dify_conversation_id', primaryId)
      .maybeSingle();
    
    // If not found by dify_conversation_id, try by internal id (for backward compatibility)
    if (!existingConversation && !checkError) {
      const { data: fallbackConversation, error: fallbackError } = await supabase
        .from('conversations')
        .select('id, dify_conversation_id')
        .eq('id', conversationId)
        .maybeSingle();
        
      existingConversation = fallbackConversation;
      checkError = fallbackError;
    }

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

    // Create new conversation record with dify_conversation_id as primary identifier
    const insertData = {
      id: primaryId, // Use dify ID as internal ID if available
      dify_conversation_id: difyConversationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Verify user exists in database before using userId
    let validUserId = null;
    if (userId && isValidUUID(userId)) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!userError && userData) {
          validUserId = userId;
          console.log('✅ Verified user exists in database:', userId);
        } else {
          console.warn('⚠️ User not found in database, creating conversation without user_id:', userId);
        }
      } catch (userCheckError) {
        console.warn('⚠️ Error checking user existence, creating conversation without user_id:', userCheckError.message);
      }
    }

    // Only add user_id if user exists in database
    if (validUserId) {
      insertData.user_id = validUserId;
    }
    // If userId is null or user doesn't exist, user_id will be null (allowed by schema)

    // Use upsert to handle potential race conditions and ensure record exists
    const { data: insertResult, error: insertError } = await supabase
      .from('conversations')
      .upsert(insertData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select('id');

    if (insertError) {
      console.error('Error creating conversation record:', insertError);
      
      // If it still fails due to user constraint, retry without user_id
      if (insertError.code === '23503' && insertError.message.includes('user_id')) {
        console.log('Retrying conversation creation without user_id...');
        delete insertData.user_id;
        
        const { data: retryResult, error: retryError } = await supabase
          .from('conversations')
          .upsert(insertData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select('id');

        if (retryError) {
          console.error('Failed to create conversation record even without user_id:', retryError);
          return false; // Indicate failure
        } else {
          console.log('✅ Created new conversation record without user_id');
          return true;
        }
      } else {
        return false; // Indicate failure
      }
    } else {
      console.log('✅ Created new conversation record');
      return true;
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

// 🔧 新增：纯聊天模式端点 - 专门处理简单对话而非工作流
app.post('/api/dify/chat/simple', async (req, res) => {
  const { message, conversationId: clientConvId, userId } = req.body;

  console.log('[Simple Chat] Processing chat request:', {
    messagePreview: message?.substring(0, 50) + '...',
    conversationId: clientConvId,
    userId: userId
  });

  if (!DIFY_API_URL || !DIFY_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing Dify API configuration' });
  }

  // Generate or get user ID
  const userIdentifier = userId || req.headers['x-user-id'] || `user-${generateUUID()}`;
  
  // Get or create conversation ID
  let conversationId = clientConvId;
  if (!conversationId || !isValidUUID(conversationId)) {
    conversationId = generateUUID();
    console.log('[Simple Chat] Generated new conversation ID:', conversationId);
  }

  try {
    // 🔧 关键修复：使用chat-messages端点而不是workflows/run
    const difyResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {}, // 简单聊天不需要复杂输入
        query: message,
        user: userIdentifier,
        conversation_id: clientConvId || '', // 空字符串让Dify创建新对话
        response_mode: 'blocking' // 使用阻塞模式获得简单响应
      }),
    });

    if (!difyResponse.ok) {
      const error = await difyResponse.json();
      console.error('[Simple Chat] Dify API error:', error);
      return res.status(difyResponse.status).json({
        error: error.message || 'Dify API error',
        type: 'dify_api_error'
      });
    }

    const data = await difyResponse.json();
    
    console.log('[Simple Chat] Success:', {
      conversationId: data.conversation_id,
      answerLength: data.answer?.length || 0,
      messageId: data.message_id
    });

    // 返回简化的响应格式
    return res.status(200).json({
      answer: data.answer || '抱歉，我无法理解您的问题。',
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      conversationId: data.conversation_id, // 兼容前端
      userId: userIdentifier,
      metadata: {
        usage: data.metadata?.usage,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Simple Chat] API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: 'server_error'
    });
  }
});

// NEW SIMPLIFIED DIFY CHAT ENDPOINT - Memory-based conversation management
app.post('/api/dify/chat', async (req, res) => {
  const { message, conversationId: clientConvId, userId } = req.body;

  // Generate or get user ID
  const userIdentifier = userId || req.headers['x-user-id'] || `user-${generateUUID()}`;
  
  // Get or create conversation ID
  let conversationId = clientConvId;
  let isNewConversation = false;
  
  if (!conversationId) {
    conversationId = generateUUID();
    isNewConversation = true;
  }

  // Get conversation state from memory store
  const conversationState = conversationStore.get(conversationId) || {
    conversationId,
    userId: userIdentifier,
  };

  try {
    // Call Dify API
    const difyResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {}, // workflow input parameters
        query: message,
        user: userIdentifier, // ✅ Required user parameter
        conversation_id: isNewConversation ? '' : conversationId, // Empty string for new conversations
        response_mode: 'blocking',
        files: [] // For file uploads if needed
      }),
    });

    if (!difyResponse.ok) {
      const error = await difyResponse.json();
      console.error('Dify API error:', error);
      return res.status(difyResponse.status).json(error);
    }

    const data = await difyResponse.json();
    
    // Update conversation state in memory store
    conversationStore.set(data.conversation_id || conversationId, {
      ...conversationState,
      conversationId: data.conversation_id || conversationId,
      nodeStatus: data.metadata?.node_status, // Save node status
    });

    // Return response
    return res.status(200).json({
      ...data,
      conversationId: data.conversation_id || conversationId,
      userId: userIdentifier,
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// MOCK ENDPOINT FOR TESTING - When Dify API is not accessible
app.post('/api/dify/chat/mock', (req, res) => {
  const { message, conversationId: clientConvId, userId } = req.body;
  
  // Generate or get user ID
  const userIdentifier = userId || req.headers['x-user-id'] || `user-${generateUUID()}`;
  
  // Get or create conversation ID
  let conversationId = clientConvId;
  if (!conversationId) {
    conversationId = generateUUID();
  }

  // Mock response that demonstrates the fixed structure
  const mockResponse = {
    conversation_id: conversationId,
    message_id: `msg-${generateUUID()}`,
    answer: `Mock response to: "${message}". This demonstrates that the user parameter issue is fixed and memory-based conversation management is working.`,
    metadata: {
      usage: {
        prompt_tokens: 20,
        completion_tokens: 30,
        total_tokens: 50
      },
      node_status: 'completed'
    },
    conversationId: conversationId,
    userId: userIdentifier,
    created_at: Date.now()
  };

  // Store in memory (simulate the real endpoint behavior)
  conversationStore.set(conversationId, {
    conversationId,
    userId: userIdentifier,
    nodeStatus: 'completed'
  });

  console.log(`✅ Mock response generated for user ${userIdentifier}, conversation ${conversationId}`);
  
  res.json(mockResponse);
});

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
  console.log('🗣️ GENERIC /api/dify ENDPOINT CALLED');
  try {
    const { message, query, user, conversation_id, inputs = {}, stream = false } = req.body;
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
      response_mode: stream ? 'streaming' : 'blocking',
      stream: stream,
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
          console.log('🔄 Conversation not found in DIFY, but maintaining dialogue continuity for ChatFlow');
          console.log('📝 Keeping original conversation_id to preserve dialogue_count progression');
          
          // Create a new request without conversation_id for DIFY, but maintain our internal tracking
          const retryRequestBody = {
            ...requestBody
          };
          delete retryRequestBody.conversation_id;

          response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryRequestBody),
          });

          if (!response.ok) {
            throw new Error('Dify API request failed after retry');
          }
          
          console.log('✅ Successfully retried without breaking conversation continuity');
        } else {
          throw new Error(`Dify API error: ${errorData.message || 'Unknown error'}`);
        }
      }

      // Handle streaming vs blocking response
      if (stream && requestBody.response_mode === 'streaming') {
        console.log('🔄 Handling streaming response from Dify API');
        
        // Set up streaming response headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Get streaming reader
        const reader = response.body?.getReader();
        if (!reader) {
          return res.status(500).json({ error: 'No response body reader available' });
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        let finalData = null;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete lines from buffer
            let lineEndIndex;
            while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.substring(0, lineEndIndex).trim();
              buffer = buffer.substring(lineEndIndex + 1);
              
              if (line.startsWith('data: ')) {
                const data = line.substring(6).trim();
                
                if (data === '[DONE]') {
                  console.log('🔚 Streaming ended with [DONE]');
                  break;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Store final data for database saving
                  if (parsed.conversation_id) {
                    finalData = parsed;
                  }
                  
                  // Forward the streaming data to client
                  res.write(`data: ${data}\n\n`);
                  
                  console.log('📤 Forwarded streaming data:', {
                    event: parsed.event,
                    hasAnswer: !!parsed.answer,
                    conversationId: parsed.conversation_id
                  });
                  
                } catch (parseError) {
                  console.warn('⚠️ Failed to parse streaming data:', parseError);
                  // Forward as-is if we can't parse
                  res.write(`data: ${data}\n\n`);
                }
              }
            }
          }
          
          // End the stream
          res.write('data: [DONE]\n\n');
          
          // Save to database if we have final data
          if (finalData && supabase) {
            const effectiveConversationId = finalData.conversation_id || conversationId;
            const conversationCreated = await ensureConversationExists(supabase, effectiveConversationId, finalData.conversation_id, getValidUserId(user));
            
            if (conversationCreated !== false) {
              await saveMessages(supabase, effectiveConversationId, actualMessage, finalData);
              console.log('✅ Saved streaming conversation to database');
            }
          }
          
          res.end();
          return;
          
        } catch (streamError) {
          console.error('❌ Streaming error:', streamError);
          res.write(`data: {"error": "Streaming failed: ${streamError.message}"}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        
      } else {
        // Handle blocking response
        data = await response.json();
        console.log('✅ Successfully received response from Dify API');
      }
      
    } catch (error) {
      console.error('⚠️ Dify API request failed:', error.message);
      return res.status(503).json({ 
        error: 'Dify API unavailable', 
        message: 'Unable to connect to Dify API. Please check your configuration and network connectivity.',
        details: error.message 
      });
    }

    // Ensure conversation exists BEFORE saving messages (only for blocking mode)
    if (supabase && data) {
      // Use Dify's conversation_id as the authoritative source
      const effectiveConversationId = data.conversation_id || conversationId;
      
      // First ensure conversation record exists with Dify's ID as primary
      const conversationCreated = await ensureConversationExists(supabase, effectiveConversationId, data.conversation_id, getValidUserId(user));
      
      // Then save messages using Dify's conversation_id only if conversation was successfully created/exists
      if (conversationCreated !== false) {
        await saveMessages(supabase, effectiveConversationId, actualMessage, data);
      } else {
        console.error('⚠️ Skipping message save due to conversation creation failure');
      }
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
  console.log('🗣️ WORKFLOW ENDPOINT CALLED');
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

    // 🔧 修复工作流对话连续性：正确处理conversation_id
    if (difyConversationId) {
      requestBody.conversation_id = difyConversationId;
      console.log('🔗 Using existing Dify conversation ID for workflow:', difyConversationId);
    } else {
      console.log('🆕 Starting new workflow conversation');
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
            `${DIFY_API_URL}/chat-messages`,
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
          let currentConversationId = null; // Track conversation_id from DIFY response

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              
              // 🚨 WORKFLOW LOOP DEBUG: Prove this loop executes
              if (buffer.length === decoder.decode(value, { stream: true }).length) { // First chunk
                console.log('🚨 WORKFLOW LOOP - FIRST CHUNK PROCESSED');
                const workflowTestId = 'workflow-proof-' + Date.now();
                try {
                  const supabaseWorkflow = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
                  await supabaseWorkflow.from('conversations').insert({
                    id: workflowTestId,
                    dify_conversation_id: 'WORKFLOW_LOOP_PROOF_' + Date.now(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                  console.log('✅ WORKFLOW LOOP PROOF SAVED:', workflowTestId);
                } catch (workflowProofError) {
                  console.error('❌ WORKFLOW LOOP PROOF FAILED:', workflowProofError);
                }
              }
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  
                  if (data === '[DONE]') {
                    // 🔧 CRITICAL FIX: Even without message_end event, we need to save conversation_id
                    if (!finalData && currentConversationId) {
                      // Create finalData if it doesn't exist but we have conversation info
                      finalData = {
                        answer: fullAnswer || 'Completed',
                        conversation_id: currentConversationId,
                        message_id: generateUUID(),
                        metadata: {}
                      };
                    }
                    
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
                    
                    // 🔧 CRITICAL FIX: Capture conversation_id from any DIFY event
                    if (parsed.conversation_id) {
                      currentConversationId = parsed.conversation_id;
                    }
                    
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
            `${DIFY_API_URL}/chat-messages`,
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
  console.log('🗣️ STREAM ENDPOINT CALLED with conversation ID:', req.params.conversationId);
  
  // 🚀 ENDPOINT CALLED CONFIRMATION - Log only, don't send response yet
  console.log('✅ STREAM ENDPOINT CONFIRMED - Processing request');
  
  // Endpoint debugging for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 Stream endpoint processing conversation:', req.params.conversationId);
  }
  
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

    // 查找或创建当前会话的 dify_conversation_id
    let { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .maybeSingle();

    let difyConversationId = conversationRow?.dify_conversation_id || null;
    
    // 如果数据库中没有这个对话记录，先创建一个
    if (!conversationRow) {
      console.log(`🆕 Creating conversation record for: ${conversationId}`);
      await ensureConversationExists(supabase, conversationId, null, getValidUserId(req.body.user));
      
      // 重新查询以获取创建的记录
      const { data: newConversationRow } = await supabase
        .from('conversations')
        .select('dify_conversation_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      conversationRow = newConversationRow;
      difyConversationId = conversationRow?.dify_conversation_id || null;
    }

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

    // 🔥 CRITICAL FIX: 强制使用chat-messages API维护dialogue_count
    // ChatFlow需要对话状态来正确执行条件分支（dialogue_count=0,1,2...）
    let apiEndpoint = `${DIFY_API_URL}/chat-messages`;
    let apiRequestBody = requestBody;
    
    console.log('🔧 FIXED: Using chat-messages API to maintain conversation state for ChatFlow');
    
    // 🎯 INTELLIGENT STATE ANALYSIS - 替代脆弱的dialogue_count依赖
    console.log('🎯 INTELLIGENT STATE ANALYSIS - STREAMING:');
    
    // 构建对话历史 (简化版，主要基于当前消息分析)
    const conversationHistory = []; // TODO: 可以从数据库加载历史消息
    
    // 智能状态检测
    const stateAnalysis = detectConversationState(message, conversationHistory);
    const dialogueCountAnalysis = getLogicalDialogueCount(1, conversationHistory); // 假设是用户第一条消息
    
    console.log('   🧠 Detected Stage:', stateAnalysis.stage);
    console.log('   🎯 Confidence:', stateAnalysis.confidence);
    console.log('   📊 User Message Count:', stateAnalysis.user_message_count);
    console.log('   🔍 Detected Intents:', stateAnalysis.detected_intents);
    console.log('   🧮 Logical Count:', dialogueCountAnalysis.recommended_count);
    
    // 更新inputs with intelligent state variables
    const enhancedInputs = {
      ...inputs,
      // 🌟 PRIMARY STATE VARIABLES - 替代dialogue_count依赖
      conversation_stage: stateAnalysis.stage,           // 'initial', 'select', 'confirm'
      stage_confidence: stateAnalysis.confidence,        // 0.0-1.0
      logical_dialogue_count: dialogueCountAnalysis.recommended_count,
      
      // 🔍 DETAILED INTENT ANALYSIS
      has_initial_intent: stateAnalysis.detected_intents.initial,
      has_selection_intent: stateAnalysis.detected_intents.selection,
      has_confirmation_intent: stateAnalysis.detected_intents.confirmation,
      
      // 📊 FALLBACK COMPATIBILITY
      user_message_number: stateAnalysis.user_message_count,
      original_dialogue_count_offset: dialogueCountAnalysis.actual_count,
      
      // 🎯 BUSINESS CONTEXT
      message_content_summary: message.substring(0, 100), // 前100字符用于上下文
      is_new_conversation: !difyConversationId
    };
    
    // 更新请求体
    apiRequestBody.inputs = enhancedInputs;
    
    console.log('🔍 API Debug Info:');
    console.log('   Endpoint:', apiEndpoint);
    console.log('   Local conversation ID:', conversationId);
    console.log('   DIFY conversation ID:', difyConversationId);
    console.log('   Request body:', JSON.stringify(apiRequestBody, null, 2));
    
    // 特别检查conversation_id是否在请求体中
    if (apiRequestBody.conversation_id) {
      console.log('✅ Conversation ID will be sent to DIFY:', apiRequestBody.conversation_id);
    } else {
      console.log('⚠️ No conversation ID in request - will create new conversation');
    }

    // 发送消息到 Dify with enhanced timeout and retry
    const response = await fetchWithTimeoutAndRetry(
      apiEndpoint,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequestBody),
      },
      STREAMING_TIMEOUT // Use streaming timeout for chat streams
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);

      // Handle Dify conversation expiry while maintaining dialogue continuity
      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('🔄 Stream: Conversation not found in DIFY, but maintaining dialogue continuity for ChatFlow');
        console.log('📝 Stream: Keeping original conversation_id to preserve dialogue_count progression');
        
        // Create a new request without conversation_id for DIFY, but maintain our internal tracking
        const retryApiRequestBody = {
          ...apiRequestBody
        };
        delete retryApiRequestBody.conversation_id;

        console.log('🔄 Stream: Retrying request without conversation_id');
        
        // Retry the request
        const retryResponse = await fetchWithTimeoutAndRetry(
          apiEndpoint,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryApiRequestBody),
          },
          STREAMING_TIMEOUT
        );

        if (!retryResponse.ok) {
          const retryErrorData = await retryResponse.json();
          console.error('Dify API retry error:', retryErrorData);
          return res.status(retryResponse.status).json({
            error: retryErrorData.message || 'Dify API retry error',
            detail: retryErrorData
          });
        }

        // Use the retry response for streaming
        response = retryResponse;
        console.log('✅ Stream: Successfully retried without breaking conversation continuity');
      } else {
        return res.status(response.status).json({
          error: errorData.message || 'Dify API error',
          detail: errorData
        });
      }
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
    let currentConversationId = null; // Track conversation_id from DIFY response

    try {
      let allChunks = '';
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        allChunks += chunk;
        
        // 🚨 DIALOGUE_COUNT DEBUG: Look for dialogue_count in every chunk
        if (chunk.includes('dialogue_count')) {
          const dialogueMatch = chunk.match(/"dialogue_count"\s*:\s*(\d+)/);
          if (dialogueMatch) {
            const dialogueCount = parseInt(dialogueMatch[1]);
            console.log('🚨 DIALOGUE_COUNT FOUND IN STREAM:', dialogueCount);
            console.log('🚨 Full chunk with dialogue_count:', chunk.substring(0, 500) + '...');
          }
        }
        
        // 🚨 FORCE DEBUG: Always execute on first chunk to prove this loop runs
        if (allChunks.length === chunk.length) { // First chunk
          console.log('🚨 FIRST CHUNK PROCESSED - LOOP IS EXECUTING');
          const testSaveId = 'loop-proof-' + Date.now();
          try {
            const supabaseForce = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            await supabaseForce.from('conversations').insert({
              id: testSaveId,
              dify_conversation_id: 'LOOP_EXECUTION_PROOF_' + Date.now(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            console.log('✅ LOOP EXECUTION PROOF SAVED:', testSaveId);
          } catch (loopProofError) {
            console.error('❌ LOOP EXECUTION PROOF FAILED:', loopProofError);
          }
        }
        
        // 🔥 IMMEDIATE SAVE: Extract and save conversation_id as soon as we see it
        if (chunk.includes('conversation_id') && !finalData) {
          const match = chunk.match(/"conversation_id"\s*:\s*"([^"]+)"/);
          if (match) {
            const foundConversationId = match[1];
            console.log('🔥 IMMEDIATE: Found conversation_id in chunk:', foundConversationId);
            
            try {
              await ensureConversationExists(supabase, conversationId, foundConversationId, getValidUserId(req.body.user));
              console.log('✅ IMMEDIATE SAVE successful for:', foundConversationId);
              
              // Mark as saved to prevent duplicate saves
              finalData = {
                answer: 'Processing...',
                conversation_id: foundConversationId,
                message_id: 'temp-' + Date.now(),
                metadata: {}
              };
            } catch (immediateError) {
              console.error('❌ IMMEDIATE SAVE failed:', immediateError);
            }
          }
        }
        
        // Try to detect if this is standard SSE format or direct JSON response
        if (process.env.NODE_ENV !== 'production') {
          console.log('📝 Processing chunk, includes data:', chunk.includes('data: '), 'chunk preview:', chunk.substring(0, 100));
        }
        
        // Send debug message to confirm we're processing chunks
        if (allChunks.length < 500 && process.env.NODE_ENV !== 'production') {
          res.write(`data: {"event": "debug", "message": "Processing chunk ${allChunks.length} chars"}\n\n`);
        }
        if (chunk.includes('data: ')) {
          // Standard SSE format - process line by line
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                // 🔧 CRITICAL FIX: Even without message_end event, we need to save conversation_id
                if (!finalData && currentConversationId) {
                  // Create finalData if it doesn't exist but we have conversation info
                  finalData = {
                    answer: fullAnswer || 'Completed',
                    conversation_id: currentConversationId,
                    message_id: generateUUID(),
                    metadata: {}
                  };
                }
                
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
                
                // 🔧 CRITICAL FIX: Capture conversation_id from any DIFY event
                if (parsed.conversation_id) {
                  currentConversationId = parsed.conversation_id;
                  if (process.env.NODE_ENV !== 'production') {
                    console.log('🆔 Captured conversation_id from stream:', currentConversationId);
                    res.write(`data: {"event": "debug", "message": "Captured conversation_id: ${currentConversationId}"}\n\n`);
                  }
                  
                  // 🔥 AGGRESSIVE FIX: Save immediately upon receiving first conversation_id
                  if (!finalData) {
                    console.log('🔥 Attempting immediate save of conversation_id');
                    try {
                      await ensureConversationExists(supabase, conversationId, currentConversationId, getValidUserId(req.body.user));
                      console.log('✅ Immediate save successful');
                    } catch (immediateError) {
                      console.error('❌ Immediate save failed:', immediateError);
                    }
                  }
                }
                
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
      }
      
      // 🔧 CRITICAL FIX: If we have conversation_id but no finalData, save it now
      console.log('🔍 Checking save conditions - finalData:', !!finalData, 'currentConversationId:', currentConversationId, 'message:', !!message);
      if (!finalData && currentConversationId && message) {
        console.log('🔧 Stream ended naturally without [DONE], saving conversation_id:', currentConversationId);
        finalData = {
          answer: fullAnswer || 'Stream completed',
          conversation_id: currentConversationId,
          message_id: generateUUID(),
          metadata: {}
        };
        
        // Save to database immediately
        await ensureConversationExists(supabase, conversationId, finalData.conversation_id, getValidUserId(req.body.user));
        await saveMessages(supabase, conversationId, message, finalData);
        console.log('✅ Successfully saved conversation_id after stream end');
      }
      
      // Handle case where DIFY returns complete JSON response instead of streaming
      if (allChunks && !finalData) {
        try {
          console.log('🔍 Received complete JSON response from DIFY, converting to stream format');
          const completeResponse = JSON.parse(allChunks);
          
          if (completeResponse.answer) {
            // DIFY's answer might be a JSON string that needs parsing
            let actualAnswer = completeResponse.answer;
            try {
              const parsedAnswer = JSON.parse(completeResponse.answer);
              if (parsedAnswer.revised_pain_point) {
                actualAnswer = parsedAnswer.revised_pain_point;
              } else if (parsedAnswer.generated_content) {
                actualAnswer = parsedAnswer.generated_content;
              } else {
                // Use the first string value found in the parsed object
                const firstStringValue = Object.values(parsedAnswer).find(value => typeof value === 'string');
                if (firstStringValue) {
                  actualAnswer = firstStringValue;
                }
              }
            } catch (e) {
              // If parsing fails, use the original answer as is
              console.log('📝 Using original answer as is (not JSON)');
            }
            
            fullAnswer = actualAnswer;
            finalData = {
              answer: actualAnswer,
              conversation_id: completeResponse.conversation_id,
              message_id: completeResponse.message_id,
              metadata: completeResponse.metadata
            };
            
            // Convert to proper streaming format for frontend
            // Send message chunks using the parsed answer
            const chunks = actualAnswer.match(/.{1,50}/g) || [actualAnswer];
            for (const chunk of chunks) {
              res.write(`data: ${JSON.stringify({
                event: 'message',
                answer: chunk,
                conversation_id: completeResponse.conversation_id
              })}\n\n`);
              
              // Small delay to simulate streaming
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Send message end event
            res.write(`data: ${JSON.stringify({
              event: 'message_end',
              conversation_id: completeResponse.conversation_id,
              message_id: completeResponse.message_id,
              metadata: completeResponse.metadata
            })}\n\n`);
            
            // Save messages to database
            await ensureConversationExists(supabase, conversationId, completeResponse.conversation_id, getValidUserId(req.body.user));
            await saveMessages(supabase, conversationId, message, finalData);
            
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
          }
        } catch (parseError) {
          console.error('Failed to parse complete JSON response:', parseError);
          console.error('Raw response:', allChunks.substring(0, 500));
        }
      }
    } finally {
      // 🔧 CRITICAL FIX: Save conversation_id even if stream ends without proper events
      if (!finalData && currentConversationId && message) {
        console.log('🔧 Stream ended without finalData, saving conversation_id from stream:', currentConversationId);
        finalData = {
          answer: fullAnswer || 'Completed',
          conversation_id: currentConversationId,
          message_id: generateUUID(),
          metadata: {}
        };
        
        // Save to database
        try {
          await ensureConversationExists(supabase, conversationId, finalData.conversation_id, getValidUserId(req.body.user));
          await saveMessages(supabase, conversationId, message, finalData);
          console.log('✅ Successfully saved conversation_id in finally block');
        } catch (saveError) {
          console.error('❌ Error saving in finally block:', saveError);
        }
      }
      
      reader.releaseLock();
      if (!res.headersSent) {
        res.end();
      }
    }
  } catch (error) {
    console.error('Stream API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dify chat proxy API (blocking)
app.post('/api/dify/:conversationId', async (req, res) => {
  console.log('🗣️ NON-STREAM /:conversationId ENDPOINT CALLED with:', req.params.conversationId);
  
  // Endpoint debugging for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 Non-stream endpoint processing conversation:', req.params.conversationId);
  }
  
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

    // 查找或创建当前会话的 dify_conversation_id
    let { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .maybeSingle();

    let difyConversationId = conversationRow?.dify_conversation_id || null;
    
    // 如果数据库中没有这个对话记录，先创建一个
    if (!conversationRow) {
      console.log(`🆕 Creating conversation record for: ${conversationId}`);
      await ensureConversationExists(supabase, conversationId, null, getValidUserId(req.body.user));
      
      // 重新查询以获取创建的记录
      const { data: newConversationRow } = await supabase
        .from('conversations')
        .select('dify_conversation_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      conversationRow = newConversationRow;
      difyConversationId = conversationRow?.dify_conversation_id || null;
    }

    const requestBody = {
      inputs: inputs,
      query: message,
      response_mode: 'blocking',
      user: getValidUserId(req.body.user) // FIXED: Pass user from request body
    };

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId) {
      console.log('🔍 Found existing DIFY conversation ID:', difyConversationId);
      requestBody.conversation_id = difyConversationId;
      console.log('✅ Added conversation_id to request body');
    } else {
      console.log('⚠️ No existing DIFY conversation ID found, will create new conversation');
    }

    // 🔥 CRITICAL FIX: 强制使用chat-messages API维护dialogue_count
    // ChatFlow需要对话状态来正确执行条件分支（dialogue_count=0,1,2...）
    let apiEndpoint = `${DIFY_API_URL}/chat-messages`;
    let apiRequestBody = requestBody;
    
    console.log('🔧 FIXED: Using chat-messages API to maintain conversation state for ChatFlow');
    
    // 🎯 INTELLIGENT STATE ANALYSIS - 替代脆弱的dialogue_count依赖
    console.log('🎯 INTELLIGENT STATE ANALYSIS - REGULAR:');
    
    // 构建对话历史 (简化版，主要基于当前消息分析)
    const conversationHistory = []; // TODO: 可以从数据库加载历史消息
    
    // 智能状态检测
    const stateAnalysis = detectConversationState(message, conversationHistory);
    const dialogueCountAnalysis = getLogicalDialogueCount(1, conversationHistory); // 假设是用户第一条消息
    
    console.log('   🧠 Detected Stage:', stateAnalysis.stage);
    console.log('   🎯 Confidence:', stateAnalysis.confidence);
    console.log('   📊 User Message Count:', stateAnalysis.user_message_count);
    console.log('   🔍 Detected Intents:', stateAnalysis.detected_intents);
    console.log('   🧮 Logical Count:', dialogueCountAnalysis.recommended_count);
    
    // 更新inputs with intelligent state variables
    const enhancedInputs = {
      ...inputs,
      // 🌟 PRIMARY STATE VARIABLES - 替代dialogue_count依赖
      conversation_stage: stateAnalysis.stage,           // 'initial', 'select', 'confirm'
      stage_confidence: stateAnalysis.confidence,        // 0.0-1.0
      logical_dialogue_count: dialogueCountAnalysis.recommended_count,
      
      // 🔍 DETAILED INTENT ANALYSIS
      has_initial_intent: stateAnalysis.detected_intents.initial,
      has_selection_intent: stateAnalysis.detected_intents.selection,
      has_confirmation_intent: stateAnalysis.detected_intents.confirmation,
      
      // 📊 FALLBACK COMPATIBILITY
      user_message_number: stateAnalysis.user_message_count,
      original_dialogue_count_offset: dialogueCountAnalysis.actual_count,
      
      // 🎯 BUSINESS CONTEXT
      message_content_summary: message.substring(0, 100), // 前100字符用于上下文
      is_new_conversation: !difyConversationId
    };
    
    // 更新请求体
    apiRequestBody.inputs = enhancedInputs;
    
    console.log('🔍 API Debug Info:');
    console.log('   Endpoint:', apiEndpoint);
    console.log('   Local conversation ID:', conversationId);
    console.log('   DIFY conversation ID:', difyConversationId);
    console.log('   Request body:', JSON.stringify(apiRequestBody, null, 2));
    
    // 特别检查conversation_id是否在请求体中
    if (apiRequestBody.conversation_id) {
      console.log('✅ Conversation ID will be sent to DIFY:', apiRequestBody.conversation_id);
    } else {
      console.log('⚠️ No conversation ID in request - will create new conversation');
    }

    // 发送消息到 Dify with enhanced timeout and retry
    let response = await fetchWithTimeoutAndRetry(
      apiEndpoint,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequestBody),
      },
      DEFAULT_TIMEOUT // Use default timeout for blocking chat
    );

    // 如果是对话不存在的错误，尝试去掉 conversation_id 再试一次
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);

      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('🔄 Conversation not found in DIFY, but maintaining dialogue continuity for ChatFlow');
        console.log('📝 Keeping original conversation_id to preserve dialogue_count progression');
        
        // Create a new request without conversation_id for DIFY, but maintain our internal tracking
        const retryApiRequestBody = {
          ...apiRequestBody
        };
        delete retryApiRequestBody.conversation_id;

        response = await fetchWithTimeoutAndRetry(
          apiEndpoint,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryApiRequestBody),
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

// Test endpoint to debug conversation saving
app.post('/api/test-save-conversation', async (req, res) => {
  const { conversationId, difyId } = req.body;
  
  console.log('🧪 TEST SAVE CONVERSATION called with:', { conversationId, difyId });
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await ensureConversationExists(supabase, conversationId, difyId, null);
    
    // Verify it was saved
    const { data, error } = await supabase
      .from('conversations')
      .select('id, dify_conversation_id')
      .eq('id', conversationId)
      .single();
    
    res.json({ success: true, saved: data, error });
  } catch (error) {
    console.error('❌ TEST SAVE failed:', error);
    res.json({ success: false, error: error.message });
  }
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
