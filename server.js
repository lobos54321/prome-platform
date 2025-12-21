import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

// 🔧 启动诊断日志 - 回滚到工作版本
console.log('🚀 [BOOT 1] Starting server initialization...');
console.log('🌍 [BOOT ENV]', {
  NODE_VERSION: process.version,
  VITE_DIFY_API_URL: !!process.env.VITE_DIFY_API_URL,
  VITE_DIFY_API_KEY: !!process.env.VITE_DIFY_API_KEY,
  NEXT_PUBLIC_DIFY_API_URL: !!process.env.NEXT_PUBLIC_DIFY_API_URL,
  NEXT_PUBLIC_DIFY_API_KEY: !!process.env.NEXT_PUBLIC_DIFY_API_KEY,
  VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
  PORT: process.env.PORT
});

// 捕获未处理的错误
process.on('unhandledRejection', (err) => {
  console.error('❌ [BOOT] UNHANDLED REJECTION:', err);
});
process.on('uncaughtException', (err) => {
  console.error('❌ [BOOT] UNCAUGHT EXCEPTION:', err);
});

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const app = express();
const port = process.env.PORT || 8080;

// In-memory storage for digital humans (should be replaced with database in production)
const digitalHumansStorage = {};

// Temporary storage for mapping training IDs to temp file names for cleanup
const tempFileCleanupMap = {};

// 初始化 Stripe，确保 Zeabur 或本地 .env 设置了 STRIPE_SECRET_KEY
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());

// 配置multer处理文件上传
// Image upload configuration
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件！'), false);
    }
  }
});

// Video upload configuration
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传视频文件！'), false);
    }
  }
});

// General upload configuration (for backward compatibility)
const upload = imageUpload;

// 🔍 DEBUG: Log all incoming requests to identify routing
app.use((req, res, next) => {
  if (req.path.includes('/api/dify') || req.path.includes('/api/video-result')) {
    console.log(`🔍 INCOMING REQUEST: ${req.method} ${req.path}`);
  }
  next();
});

// Configuration from environment variables
const DIFY_API_URL = process.env.VITE_DIFY_API_URL || process.env.NEXT_PUBLIC_DIFY_API_URL || process.env.DIFY_API_URL || '';
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY || process.env.NEXT_PUBLIC_DIFY_API_KEY || process.env.DIFY_API_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 仙宫云API配置
const XIANGONG_API_KEY = process.env.VITE_XIANGONG_API_KEY || 'miv4n5hh6313imnijhgqpzqbb0at3xxlm2l24x7r';
// ComfyUI集成了InfiniteTalk和IndexTTS2，运行在8188端口
const XIANGONG_COMFYUI_URL = process.env.VITE_XIANGONG_COMFYUI_URL || 'https://3iaszw98tkh12h9x-8188.container.x-gpu.com';
const XIANGONG_INFINITETALK_URL = XIANGONG_COMFYUI_URL;

// 仙宫云实例使用跟踪
let lastApiCallTime = null;
let autoShutdownTimer = null;
const IDLE_TIMEOUT_MINUTES = 20; // 20分钟闲置自动关机

// 更新最后使用时间的函数
function updateLastUsage() {
  lastApiCallTime = new Date();
  console.log(`📱 更新API使用时间: ${lastApiCallTime.toISOString()}`);

  // 重置自动关机定时器
  resetAutoShutdownTimer();
}

// 重置自动关机定时器
function resetAutoShutdownTimer() {
  // 清除之前的定时器
  if (autoShutdownTimer) {
    clearTimeout(autoShutdownTimer);
  }

  // 设置新的定时器：20分钟后自动关机
  autoShutdownTimer = setTimeout(async () => {
    try {
      console.log(`⏰ ${IDLE_TIMEOUT_MINUTES}分钟无活动，开始自动关机...`);

      // 首先检查实例状态
      const statusResponse = await fetch('http://localhost:8080/api/xiangong/instance/status');
      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();

        if (statusResult.success && statusResult.data.status === 'running') {
          console.log('🔄 实例正在运行，执行自动关机...');

          // 调用关机API
          const shutdownResponse = await fetch('http://localhost:8080/api/xiangong/instance/stop', {
            method: 'POST'
          });

          if (shutdownResponse.ok) {
            const shutdownResult = await shutdownResponse.json();
            console.log('✅ 自动关机成功:', shutdownResult);
          } else {
            console.error('❌ 自动关机失败:', await shutdownResponse.text());
          }
        } else {
          console.log(`ℹ️ 实例状态为 ${statusResult.data.status}，无需关机`);
        }
      } else {
        console.error('❌ 无法获取实例状态，跳过自动关机');
      }
    } catch (error) {
      console.error('❌ 自动关机过程出错:', error);
    }
  }, IDLE_TIMEOUT_MINUTES * 60 * 1000); // 转换为毫秒

  console.log(`⏱️ 自动关机定时器已设置：${IDLE_TIMEOUT_MINUTES}分钟后执行`);
}

// 检查闲置时间的函数
function checkIdleTime() {
  if (!lastApiCallTime) {
    return;
  }

  const now = new Date();
  const idleMinutes = (now - lastApiCallTime) / (1000 * 60);

  console.log(`📊 当前闲置时间: ${idleMinutes.toFixed(1)} 分钟`);

  return idleMinutes;
}
const XIANGONG_INDEXTTS2_URL = XIANGONG_COMFYUI_URL;

// Environment validation
console.log('🚀 Starting Prome Platform server');

// 检查关键配置是否存在
if (!DIFY_API_URL || !DIFY_API_KEY) {
  console.error('❌ [BOOT] Missing Dify configuration:', {
    DIFY_API_URL: !!DIFY_API_URL,
    DIFY_API_KEY: !!DIFY_API_KEY
  });
  console.warn('⚠️ Server will start but Dify features may not work');
} else {
  console.log('✅ [BOOT] Dify configuration found');
}

// UUID utility functions
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Removed complex warmup and state detection functions - now handled by Dify opening statement

// Helper function to get a valid user ID
// Store user ID mappings to maintain consistency across conversation turns
const userIdMappings = new Map();

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

    // Check if we already have a mapping for this user string
    if (userIdMappings.has(user)) {
      console.log('🔄 Using existing user ID mapping for:', user);
      return userIdMappings.get(user);
    }

    // Create new mapping for this user string
    const anonymousUserId = generateUUID();
    userIdMappings.set(user, anonymousUserId);
    console.log('🔧 Created new user ID mapping:', user, '->', anonymousUserId);
    return anonymousUserId;
  }

  // For completely anonymous users, generate a UUID
  const anonymousUserId = generateUUID();
  console.log('🔧 Generated anonymous user ID:', anonymousUserId);
  return anonymousUserId;
}

// Timeout configurations - Optimized for complex workflows
const DEFAULT_TIMEOUT = parseInt(process.env.VITE_DIFY_TIMEOUT_MS) || 120000; // 2 minutes (increased from 30s)
const WORKFLOW_TIMEOUT = parseInt(process.env.VITE_DIFY_WORKFLOW_TIMEOUT_MS) || 300000; // 5 minutes (increased from 2min)
const STREAMING_TIMEOUT = parseInt(process.env.VITE_DIFY_STREAMING_TIMEOUT_MS) || 240000; // 4 minutes for streaming responses
const MAX_RETRIES = parseInt(process.env.VITE_DIFY_MAX_RETRIES) || 3;

// Context length management - Prevent token overflow
const MAX_CONTEXT_TOKENS = parseInt(process.env.VITE_MAX_CONTEXT_TOKENS) || 6000; // 保留安全边界
const TOKEN_ESTIMATION_RATIO = 0.75; // 1个token约等于0.75个字符（中文）

// 估算文本的token数量
function estimateTokens(text) {
  if (!text) return 0;
  // 对于中文，大约1个字符 = 1.3个token
  // 对于英文，大约1个字符 = 0.25个token  
  // 使用混合估算：假设50%中文，50%英文
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.3 + otherChars * 0.25);
}

// 智能截断对话历史，保持上下文连贯性
async function manageConversationContext(conversationId, newMessage) {
  // Initialize Supabase if configured
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️  Context management skipped (Supabase not configured)');
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 获取对话历史（按时间倒序）
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50); // 最多检查最近50条消息

    if (error) {
      console.warn('⚠️  Failed to fetch conversation history for context management:', error);
      return null;
    }

    if (!messages || messages.length === 0) {
      console.log('📊 New conversation, no context management needed');
      return null;
    }

    // 估算当前对话的总token数
    let totalTokens = estimateTokens(newMessage);
    let messagesToKeep = [];
    let truncatedCount = 0;
    let incompleteAnswerFound = false;

    // 从最新消息开始，累加token直到达到限制
    for (const message of messages) {
      const messageTokens = estimateTokens(message.content);

      // 检查是否有未完整的回答（答案突然截断的特征）
      if (message.role === 'assistant' && message.content) {
        const content = message.content.trim();
        // 检查答案是否可能被截断：没有适当的结尾标点、突然中断的句子等
        if (content.length > 100 &&
          !content.match(/[。！？\.\!\?]$/) &&
          !content.includes('完成') &&
          !content.includes('结束')) {
          incompleteAnswerFound = true;
          console.log('🚨 检测到可能未完整的回答，将优先保留');
        }
      }

      if (totalTokens + messageTokens > MAX_CONTEXT_TOKENS) {
        // 如果发现未完整的回答，调整策略
        if (incompleteAnswerFound && messagesToKeep.length > 0) {
          // 优先保留最近的完整对话对（用户问题+AI回答）
          console.log('🔄 调整上下文策略：优先保留未完整的回答');
          // 保留最后3轮对话以确保上下文连贯性
          const recentPairs = Math.min(6, messagesToKeep.length); // 3轮=6条消息
          messagesToKeep = messagesToKeep.slice(0, recentPairs);
          totalTokens = estimateTokens(newMessage) + messagesToKeep.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
        }

        truncatedCount = messages.length - messagesToKeep.length;
        break;
      }

      totalTokens += messageTokens;
      messagesToKeep.unshift(message); // 添加到开头，保持时间顺序
    }

    if (truncatedCount > 0) {
      console.log(`🔄 Context management: keeping ${messagesToKeep.length} messages, truncating ${truncatedCount} older messages`);
      console.log(`📊 Estimated total tokens: ${totalTokens}/${MAX_CONTEXT_TOKENS}`);

      // 根据是否有未完整回答调整提示信息  
      let truncationNote;
      if (incompleteAnswerFound) {
        truncationNote = `[系统提示：检测到之前的回答可能因上下文限制被截断，已优先保留最近的对话。如需获得完整回答，建议开始新对话重新提问]`;
      } else {
        truncationNote = `[系统提示：为避免上下文溢出，已自动整理了前面的 ${truncatedCount} 条历史消息。如需完整对话历史，建议开始新对话]`;
      }

      return {
        truncated: true,
        truncatedCount,
        totalTokens,
        messagesToKeep,
        truncationNote,
        incompleteAnswerDetected: incompleteAnswerFound
      };
    }

    console.log(`📊 Context check: ${totalTokens} tokens, within limit`);
    return {
      truncated: false,
      totalTokens,
      messagesToKeep: messages.reverse(), // 恢复时间顺序
      truncationNote: null,
      incompleteAnswerDetected: incompleteAnswerFound
    };

  } catch (error) {
    console.error('❌ Context management error:', error);
    return null;
  }
}

// 检测并警告上下文溢出风险
async function detectContextOverflowRisk(conversationId, newMessage) {
  // Initialize Supabase if configured
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 获取对话历史总token数
    const { data: messages, error } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !messages) {
      return null;
    }

    // 计算总token数
    let totalTokens = estimateTokens(newMessage);
    messages.forEach(msg => {
      totalTokens += estimateTokens(msg.content || '');
    });

    // 检查是否接近Dify的token限制（通常是8192）
    const DIFY_TOKEN_LIMIT = 8192;
    const riskThreshold = DIFY_TOKEN_LIMIT * 0.8; // 80%阈值

    if (totalTokens > riskThreshold) {
      console.log(`⚠️ Context overflow risk detected: ${totalTokens}/${DIFY_TOKEN_LIMIT} tokens`);

      return {
        isAtRisk: true,
        currentTokens: totalTokens,
        limit: DIFY_TOKEN_LIMIT,
        riskLevel: totalTokens > DIFY_TOKEN_LIMIT * 0.9 ? 'high' : 'medium',
        suggestion: totalTokens > DIFY_TOKEN_LIMIT * 0.9
          ? '建议开始新对话以避免输出被截断'
          : '即将达到上下文限制，复杂回答可能被截断'
      };
    }

    return { isAtRisk: false, currentTokens: totalTokens };

  } catch (error) {
    console.error('❌ Error detecting context overflow risk:', error);
    return null;
  }
}

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
    // 改进空内容处理，防止数据库约束错误
    const assistantContent = difyResponse.answer || '系统处理中，请稍后重试';

    if (!assistantContent.trim()) {
      console.warn('⚠️  Assistant response is empty, using fallback message');
    }

    const { error: assistantError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
        dify_message_id: difyResponse.message_id,
        token_usage: difyResponse.metadata?.usage || null,
        created_at: new Date().toISOString()
      });

    if (assistantError) {
      console.error('Error saving assistant message:', assistantError);
      // 不要return，继续执行
    }

    console.log('✅ Messages saved successfully');
  } catch (error) {
    console.error('Error in saveMessages:', error);
  }
}

// 内存存储视频结果（生产环境建议使用Redis）
const videoResults = new Map();

// 视频结果接收端点 - 供N8n工作流3回调使用
app.post('/api/video-result', (req, res) => {
  console.log('📥 N8n工作流3回调 - 视频结果:', req.body);

  const { sessionId, videoUrl, status, timestamp } = req.body;

  // 验证必填字段
  if (!sessionId || !videoUrl) {
    console.error('❌ 缺少必填字段 sessionId 或 videoUrl');
    return res.status(400).json({
      error: 'Missing required fields: sessionId, videoUrl'
    });
  }

  // 存储结果
  videoResults.set(sessionId, {
    sessionId,
    videoUrl,
    status: status || 'completed',
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  });

  console.log('✅ 视频结果已保存:', sessionId);

  res.json({
    success: true,
    message: 'Video result received successfully',
    sessionId: sessionId
  });
});

// Image upload endpoint
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有收到图片文件'
      });
    }

    // 验证API Key
    if (!process.env.IMGBB_API_KEY) {
      return res.status(500).json({
        success: false,
        error: '图片上传服务未配置'
      });
    }

    console.log('📤 Image upload request:', req.file.originalname, req.file.size, 'bytes');
    console.log('🔑 Using ImgBB API Key:', process.env.IMGBB_API_KEY);

    // 转换为base64
    const base64Image = req.file.buffer.toString('base64');

    // 使用ImgBB API上传
    const formData = new URLSearchParams();
    formData.append('image', base64Image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    const result = await response.json();

    if (result.success && result.data && result.data.url) {
      console.log('✅ ImgBB upload successful:', result.data.url);
      res.json({
        success: true,
        imageUrl: result.data.url,
        message: '图片上传成功！'
      });
    } else {
      throw new Error('ImgBB API返回错误: ' + (result.error?.message || '未知错误'));
    }

  } catch (error) {
    console.error('❌ Image upload failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || '图片上传失败'
    });
  }
});

// Video upload endpoint (temporary storage for A2E training)
app.post('/api/upload/video', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有收到视频文件'
      });
    }


    // Initialize Supabase client with service role key for storage access
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );

    console.log('📹 Video upload request:', req.file.originalname, req.file.size, 'bytes');

    // Generate unique filename with timestamp
    const fileName = `temp-${Date.now()}-${req.file.originalname}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('digital-human-videos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase storage upload error:', error);
      return res.status(500).json({
        success: false,
        error: '视频上传失败: ' + error.message
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('digital-human-videos')
      .getPublicUrl(fileName);

    console.log('✅ Video uploaded to Supabase Storage:', publicUrl);

    // Auto-delete after 30 minutes (cleanup for failed/abandoned training sessions)
    setTimeout(async () => {
      try {
        await supabase.storage.from('digital-human-videos').remove([fileName]);
        console.log(`🗑️ Auto-deleted temp video: ${fileName}`);
      } catch (deleteError) {
        console.error('⚠️ Failed to auto-delete temp video:', deleteError);
      }
    }, 30 * 60 * 1000); // 30 minutes

    res.json({
      success: true,
      videoUrl: publicUrl,
      fileName: fileName,
      message: '视频上传成功！'
    });

  } catch (error) {
    console.error('❌ Video upload failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || '视频上传失败'
    });
  }
});

// Image upload endpoint (temporary storage for A2E training)
app.post('/api/upload/image', imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有收到图片文件'
      });
    }


    // Initialize Supabase client with service role key for storage access
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );

    console.log('🖼️ Image upload request:', req.file.originalname, req.file.size, 'bytes');

    // Generate unique filename with timestamp
    const fileName = `temp-image-${Date.now()}-${req.file.originalname}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('digital-human-videos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase image storage upload error:', error);
      return res.status(500).json({
        success: false,
        error: '图片上传失败: ' + error.message
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('digital-human-videos')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded to Supabase Storage:', publicUrl);

    // Auto-delete after 30 minutes (cleanup for failed/abandoned training sessions)
    setTimeout(async () => {
      try {
        await supabase.storage.from('digital-human-videos').remove([fileName]);
        console.log(`🗑️ Auto-deleted temp image: ${fileName}`);
      } catch (deleteError) {
        console.error('⚠️ Failed to auto-delete temp image:', deleteError);
      }
    }, 30 * 60 * 1000); // 30 minutes

    res.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      message: '图片上传成功！'
    });

  } catch (error) {
    console.error('❌ Image upload failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || '图片上传失败'
    });
  }
});

// Simple in-memory cache for image extraction (5 minute TTL)
const imageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      imageCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Image extraction from web pages endpoint
app.post('/api/extract-images', async (req, res) => {
  const { pageUrl } = req.body;

  console.log('🔍 Image extraction request for:', pageUrl);

  // Temporarily disable cache for debugging
  const cacheKey = pageUrl;
  console.log('🔍 Processing fresh request for:', pageUrl);
  // const cachedResult = imageCache.get(cacheKey);
  // if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
  //   console.log('💾 Returning cached result for:', pageUrl);
  //   return res.json(cachedResult.data);
  // }

  if (!pageUrl || !pageUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL provided'
    });
  }

  try {
    // Platform-specific headers for better success rate
    let headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache'
    };

    // Platform-specific headers for global e-commerce sites
    if (pageUrl.includes('taobao.com') || pageUrl.includes('tmall.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Referer'] = 'https://www.taobao.com/';
    } else if (pageUrl.includes('jd.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Referer'] = 'https://www.jd.com/';
    }

    // US Platforms
    else if (pageUrl.includes('walmart.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-Site'] = 'none';
    } else if (pageUrl.includes('ebay.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
    } else if (pageUrl.includes('target.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
    } else if (pageUrl.includes('bestbuy.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
    } else if (pageUrl.includes('homedepot.com') || pageUrl.includes('lowes.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (pageUrl.includes('macys.com') || pageUrl.includes('nordstrom.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // UK Platforms
    else if (pageUrl.includes('argos.co.uk') || pageUrl.includes('currys.co.uk')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'en-GB,en;q=0.9';
    } else if (pageUrl.includes('johnlewis.com') || pageUrl.includes('marksandspencer.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'en-GB,en;q=0.9';
    } else if (pageUrl.includes('next.co.uk') || pageUrl.includes('very.co.uk')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'en-GB,en;q=0.9';
    }

    // European Platforms
    else if (pageUrl.includes('otto.de') || pageUrl.includes('zalando.')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'de-DE,de;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('bol.com') || pageUrl.includes('coolblue.')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'nl-NL,nl;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('fnac.com') || pageUrl.includes('cdiscount.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'fr-FR,fr;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('mediamarkt.') || pageUrl.includes('saturn.de')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'de-DE,de;q=0.9,en;q=0.8';
    }

    // Third-party marketplace platforms (where SMEs can open stores)
    else if (pageUrl.includes('etsy.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'en-US,en;q=0.9';
    } else if (pageUrl.includes('mercari.com') || pageUrl.includes('poshmark.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    } else if (pageUrl.includes('depop.com') || pageUrl.includes('vinted.')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (pageUrl.includes('reverb.com') || pageUrl.includes('discogs.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // European marketplaces
    else if (pageUrl.includes('allegro.pl') || pageUrl.includes('olx.')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'pl-PL,pl;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('leboncoin.fr') || pageUrl.includes('vinted.fr')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'fr-FR,fr;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('marktplaats.nl') || pageUrl.includes('2dehands.be')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'nl-NL,nl;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('kleinanzeigen.de') || pageUrl.includes('willhaben.at')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'de-DE,de;q=0.9,en;q=0.8';
    } else if (pageUrl.includes('blocket.se') || pageUrl.includes('tori.fi')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'sv-SE,sv;q=0.9,en;q=0.8';
    }

    // Global marketplace platforms
    else if (pageUrl.includes('facebook.com/marketplace') || pageUrl.includes('fb.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
    } else if (pageUrl.includes('gumtree.com') || pageUrl.includes('gumtree.co.uk')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Accept-Language'] = 'en-GB,en;q=0.9';
    } else if (pageUrl.includes('offerup.com') || pageUrl.includes('letgo.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    }

    // Shopify and independent stores
    else if (pageUrl.includes('shopify.com') || pageUrl.includes('myshopify.com')) {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    else {
      // Default for other platforms
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-Site'] = 'none';
    }

    console.log(`🌐 Using platform-specific headers for: ${new URL(pageUrl).hostname}`);

    const response = await fetch(pageUrl, {
      headers,
      timeout: 15000 // Increase to 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const images = [];
    const seenUrls = new Set();

    // Extract images with quality scoring
    const imageData = [];

    // Amazon特殊处理 - 只关注主要产品区域
    if (pageUrl.includes('amazon.')) {
      console.log('🎯 Amazon page detected - using specialized extraction');

      // Amazon主要产品图片选择器 - 按优先级排序
      const amazonSelectors = [
        '#landingImage',
        '.a-dynamic-image',
        '#imgBlkFront img',
        '.imgTagWrapper img',
        '.a-button-thumbnail img',
        '#imageBlock img',
        '.imageBlock img',
        '[data-action="main-image-click"] img'
      ];

      amazonSelectors.forEach(selector => {
        $(selector).each((i, elem) => {
          const src = $(elem).attr('src') || $(elem).attr('data-src');
          const alt = $(elem).attr('alt') || '';
          const className = $(elem).attr('class') || '';
          const width = parseInt($(elem).attr('width')) || 0;
          const height = parseInt($(elem).attr('height')) || 0;

          if (src) {
            try {
              const absoluteUrl = new URL(src, pageUrl).href;
              if (!seenUrls.has(absoluteUrl) && isValidImageUrl(absoluteUrl)) {
                // Amazon产品图片获得超高优先级
                const score = calculateImageScore(absoluteUrl, alt, className, width, height) + 500;
                imageData.push({ url: absoluteUrl, score, alt, className, selector });
                seenUrls.add(absoluteUrl);
                console.log(`🔍 Amazon image found via ${selector}: ${absoluteUrl.substring(0, 80)}... (score: ${score})`);
              }
            } catch (e) {
              // Skip invalid URLs
            }
          }
        });
      });
    } else {
      // 非Amazon网站使用通用提取
      $('img').each((i, elem) => {
        const src = $(elem).attr('src');
        const alt = $(elem).attr('alt') || '';
        const className = $(elem).attr('class') || '';
        const width = parseInt($(elem).attr('width')) || 0;
        const height = parseInt($(elem).attr('height')) || 0;

        if (src) {
          try {
            const absoluteUrl = new URL(src, pageUrl).href;
            if (!seenUrls.has(absoluteUrl) && isValidImageUrl(absoluteUrl)) {
              const score = calculateImageScore(absoluteUrl, alt, className, width, height);
              imageData.push({ url: absoluteUrl, score, alt, className });
              seenUrls.add(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });
    }

    // Extract images from srcset attributes (higher quality versions)
    $('img[srcset]').each((i, elem) => {
      const srcset = $(elem).attr('srcset');
      const alt = $(elem).attr('alt') || '';
      const className = $(elem).attr('class') || '';

      if (srcset) {
        // Parse srcset to get the highest resolution image
        const sources = srcset.split(',').map(src => {
          const parts = src.trim().split(' ');
          const url = parts[0];
          const descriptor = parts[1] || '1x';
          const resolution = descriptor.includes('w')
            ? parseInt(descriptor.replace('w', ''))
            : (descriptor.includes('x') ? parseFloat(descriptor.replace('x', '')) * 100 : 100);
          return { url, resolution };
        });

        // Get the highest resolution source
        const bestSource = sources.sort((a, b) => b.resolution - a.resolution)[0];

        if (bestSource) {
          try {
            const absoluteUrl = new URL(bestSource.url, pageUrl).href;
            if (!seenUrls.has(absoluteUrl) && isValidImageUrl(absoluteUrl)) {
              const score = calculateImageScore(absoluteUrl, alt, className, bestSource.resolution, 0);
              imageData.push({ url: absoluteUrl, score, alt, className });
              seenUrls.add(absoluteUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      }
    });

    // Extract images from CSS background-image properties
    $('[style*="background-image"]').each((i, elem) => {
      const style = $(elem).attr('style');
      const className = $(elem).attr('class') || '';
      const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
      if (match && match[1]) {
        try {
          const absoluteUrl = new URL(match[1], pageUrl).href;
          if (!seenUrls.has(absoluteUrl) && isValidImageUrl(absoluteUrl)) {
            const score = calculateImageScore(absoluteUrl, '', className, 0, 0);
            imageData.push({ url: absoluteUrl, score, alt: '', className });
            seenUrls.add(absoluteUrl);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });

    // 动态调整质量阈值 - 确保至少有一些图片
    let qualityThreshold = 100;
    let topImages = imageData
      .filter(item => item.score > qualityThreshold)
      .sort((a, b) => b.score - a.score);

    // 如果高质量图片太少，逐步降低阈值
    if (topImages.length < 2) {
      qualityThreshold = 50;
      topImages = imageData
        .filter(item => item.score > qualityThreshold)
        .sort((a, b) => b.score - a.score);
    }

    if (topImages.length < 1) {
      qualityThreshold = 0;
      topImages = imageData
        .filter(item => item.score > qualityThreshold)
        .sort((a, b) => b.score - a.score);
    }

    // 只取前4张最高分图片
    topImages = topImages.slice(0, 4);

    console.log(`🎯 Using quality threshold: ${qualityThreshold}, found ${topImages.length} images`);

    // 转换为高清URL，并验证有效性
    const filteredImages = await Promise.all(
      topImages.map(async (item) => {
        const highResUrl = convertToHighResUrl(item.url);

        console.log(`🔄 Converting image: ${item.url.substring(0, 100)}...`);
        console.log(`   ➡️ High-res: ${highResUrl.substring(0, 100)}...`);

        // 对于Amazon图片，验证URL有效性并尝试多个版本
        if (highResUrl.includes('amazon') && highResUrl.includes('/images/I/')) {
          const imageIdMatch = highResUrl.match(/\/images\/I\/([^._\/]+)/);
          if (imageIdMatch) {
            const imageId = imageIdMatch[1];

            // 按优先级测试多个版本
            const testUrls = [
              `https://m.media-amazon.com/images/I/${imageId}.jpg`, // 原始
              `https://images-na.ssl-images-amazon.com/images/I/${imageId}.jpg`, // SSL原始
              `https://m.media-amazon.com/images/I/${imageId}._SL1600_.jpg`, // 1600px
              `https://m.media-amazon.com/images/I/${imageId}._SL1500_.jpg`, // 1500px
              `https://m.media-amazon.com/images/I/${imageId}._SX679_.jpg`, // 679px宽
              item.url // 原始缩略图作为最后备选
            ];

            console.log(`🧪 正在测试Amazon图片ID ${imageId} 的多个版本...`);

            for (let i = 0; i < testUrls.length; i++) {
              try {
                const testResponse = await fetch(testUrls[i], {
                  method: 'HEAD',
                  timeout: 2000,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  }
                });

                if (testResponse.ok) {
                  console.log(`✅ Amazon图片版本 ${i + 1} 可用: ${testUrls[i].substring(0, 80)}...`);
                  return testUrls[i];
                }
              } catch (error) {
                console.log(`❌ Amazon图片版本 ${i + 1} 不可用: ${testUrls[i].substring(0, 80)}...`);
                continue;
              }
            }

            console.log(`⚠️ 所有Amazon版本都不可用，使用原始URL`);
            return item.url;
          }
        }

        // Quick validation for non-Amazon images
        try {
          const testResponse = await fetch(highResUrl, {
            method: 'HEAD',
            timeout: 3000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });

          if (testResponse.ok) {
            console.log(`✅ Image validated: ${highResUrl.substring(0, 80)}...`);
            return highResUrl;
          } else {
            console.log(`⚠️ Image failed validation, using original: ${item.url.substring(0, 80)}...`);
            return item.url;
          }
        } catch (error) {
          console.log(`⚠️ Image validation error, using original: ${item.url.substring(0, 80)}...`);
          return item.url;
        }
      })
    );

    // Debug: 显示所有图片的详细信息
    console.log(`🔍 Found ${imageData.length} total images for URL: ${pageUrl}`);
    console.log('📊 All images with scores (top 10):');
    imageData
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .forEach((item, index) => {
        console.log(`  ${index + 1}. Score: ${item.score}`);
        console.log(`     URL: ${item.url}`);
        console.log(`     Alt: "${item.alt}"`);
        console.log(`     Class: "${item.className}"`);
        console.log('');
      });

    console.log(`✅ Extracted ${filteredImages.length} high-quality images from ${pageUrl}`);
    console.log(`📊 Quality filter: ${imageData.length} total -> ${filteredImages.length} high-quality (score > 100)`);

    const responseData = {
      success: true,
      images: filteredImages,
      count: filteredImages.length
    };

    // Temporarily disable caching for debugging
    // imageCache.set(cacheKey, {
    //   data: responseData,
    //   timestamp: Date.now()
    // });

    res.json(responseData);

  } catch (error) {
    console.error('❌ Image extraction failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract images from page'
    });
  }
});

// Helper function to convert thumbnail URLs to high-resolution versions
function convertToHighResUrl(url) {
  if (!url) return url;

  try {
    // Amazon images URL optimization
    if (url.includes('amazon.com') || url.includes('ssl-images-amazon.com') || url.includes('m.media-amazon.com')) {
      // Amazon图片URL破解策略：
      // 1. 删除所有尺寸和压缩标识符，获取原始图片
      // 2. 尝试多种最高清格式

      let originalUrl = url;

      // 方法1：完全清除所有Amazon压缩标识符，获取原始图片
      let cleanUrl = url
        // 移除所有已知的Amazon压缩标识符
        .replace(/\._AC_[^.]*_/g, '.')  // 移除_AC_xxx_格式
        .replace(/\._SR\d+,\d+_/g, '.') // 移除_SR123,456_格式  
        .replace(/\._SL\d+_/g, '.')     // 移除_SL1500_格式
        .replace(/\._SS\d+_/g, '.')     // 移除_SS123_格式
        .replace(/\._SX\d+_/g, '.')     // 移除_SX123_格式
        .replace(/\._SY\d+_/g, '.')     // 移除_SY123_格式
        .replace(/\._CB\d+_/g, '.')     // 移除_CB缓存标识符
        .replace(/\.\./g, '.');         // 清理可能的双点

      // 方法2：如果清理后的URL无效，使用超高清格式
      let ultraHighResUrl = url
        .replace(/\._AC_[^.]*_/g, '._SL3000_')
        .replace(/\._SR\d+,\d+_/g, '._SL3000_')
        .replace(/\._SL\d+_/g, '._SL3000_')
        .replace(/\._SS\d+_/g, '._SL3000_')
        .replace(/\._SX\d+_/g, '._SL3000_')
        .replace(/\._SY\d+_/g, '._SL3000_');

      // 如果没有任何标识符，添加超高清标识
      if (ultraHighResUrl === url) {
        ultraHighResUrl = url.replace(/(\.(jpg|jpeg|png|webp))$/i, '._SL3000_$1');
      }

      // 亚马逊图片ID提取策略 - 模拟放大功能
      const imageIdMatch = url.match(/\/images\/I\/([^._]+)/);
      if (imageIdMatch) {
        const imageId = imageIdMatch[1];
        // 构造亚马逊的多种最高分辨率格式
        const possibleUrls = [
          `https://m.media-amazon.com/images/I/${imageId}.jpg`, // 原始无压缩
          `https://images-na.ssl-images-amazon.com/images/I/${imageId}.jpg`, // SSL原始
          `https://m.media-amazon.com/images/I/${imageId}._SL1600_.jpg`, // 1600px
          `https://m.media-amazon.com/images/I/${imageId}._SX679_.jpg`, // 679px宽
          `https://m.media-amazon.com/images/I/${imageId}._AC_SX679_.jpg`, // AC 679px
          ultraHighResUrl, // 3000px版本
          cleanUrl, // 清理版本
        ];

        console.log(`🎯 Amazon图片ID: ${imageId}`);
        console.log(`📊 尝试多个URL版本:`);
        possibleUrls.forEach((url, index) => {
          console.log(`   ${index + 1}. ${url}`);
        });

        // 返回第一个可能的最高质量版本 (原始无压缩)
        return possibleUrls[0];
      }

      // 如果无法提取图片ID，使用原有策略
      const finalUrl = cleanUrl !== url ? cleanUrl : ultraHighResUrl;

      console.log(`🔄 Amazon URL optimization (fallback):`);
      console.log(`   原始: ${originalUrl}`);
      console.log(`   清理: ${cleanUrl}`);
      console.log(`   3K版: ${ultraHighResUrl}`);
      console.log(`   最终: ${finalUrl}`);

      return finalUrl;
    }

    // Shopify images
    if (url.includes('shopify.com') || url.includes('cdn.shopify.com')) {
      // Replace size parameters with large version
      let highResUrl = url
        .replace(/_\d+x\d+\./g, '_2048x2048.')
        .replace(/_\d+x\./g, '_2048x.')
        .replace(/_x\d+\./g, '_x2048.')
        .replace(/_small\./g, '_2048x2048.')
        .replace(/_medium\./g, '_2048x2048.')
        .replace(/_large\./g, '_2048x2048.')
        .replace(/_thumb\./g, '_2048x2048.');

      if (highResUrl !== url) {
        console.log(`🔄 Shopify URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // Alibaba/AliExpress images
    if (url.includes('alicdn.com') || url.includes('alibaba.com')) {
      let highResUrl = url
        .replace(/_\d+x\d+\.jpg/g, '_2048x2048.jpg')
        .replace(/_\d+x\d+\.png/g, '_2048x2048.png')
        .replace(/\.summ\./g, '.2048x2048.')
        .replace(/\.jpg_50x50\.jpg/g, '.jpg')
        .replace(/\.png_50x50\.png/g, '.png');

      if (highResUrl !== url) {
        console.log(`🔄 Alibaba URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // 淘宝/天猫 images
    if (url.includes('taobao.com') || url.includes('tmall.com') || url.includes('aliimg.com')) {
      let highResUrl = url
        .replace(/_\d+x\d+\.jpg/g, '_2000x2000.jpg')
        .replace(/_\d+x\d+\.png/g, '_2000x2000.png')
        .replace(/\.sum_/g, '.2000x2000_sum_')
        .replace(/\.jpg_\.webp/g, '.jpg')
        .replace(/\.png_\.webp/g, '.png')
        // 淘宝特有的缩略图格式
        .replace(/!!\d+x\d+\.jpg/g, '!!2000x2000.jpg')
        .replace(/!!\d+x\d+\.png/g, '!!2000x2000.png');

      if (highResUrl !== url) {
        console.log(`🔄 Taobao/Tmall URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // 京东 images
    if (url.includes('jd.com') || url.includes('360buyimg.com')) {
      let highResUrl = url
        .replace(/!\/n\d+/g, '!/n2000')
        .replace(/!\/\d+x\d+/g, '!/2000x2000')
        .replace(/\.jpg\.webp/g, '.jpg')
        .replace(/\.png\.webp/g, '.png')
        .replace(/_\d+x\d+\.jpg/g, '_2000x2000.jpg')
        .replace(/_s\.jpg/g, '.jpg')
        .replace(/_m\.jpg/g, '.jpg');

      if (highResUrl !== url) {
        console.log(`🔄 JD.com URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // Walmart images
    if (url.includes('walmart.com') || url.includes('walmartimages.com')) {
      let highResUrl = url
        .replace(/\?odnHeight=\d+&odnWidth=\d+/g, '?odnHeight=2000&odnWidth=2000')
        .replace(/resize=\d+:\d+/g, 'resize=2000:2000')
        .replace(/_\d+x\d+\./g, '_2000x2000.');

      if (highResUrl !== url) {
        console.log(`🔄 Walmart URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // eBay images
    if (url.includes('ebay.com') || url.includes('ebayimg.com')) {
      let highResUrl = url
        .replace(/s-l\d+\./g, 's-l2000.')
        .replace(/s-m\d+\./g, 's-l2000.')
        .replace(/\$_\d+\.JPG/g, '$_2000.JPG')
        .replace(/\$_\d+\.jpg/g, '$_2000.jpg');

      if (highResUrl !== url) {
        console.log(`🔄 eBay URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // Target images
    if (url.includes('target.com') || url.includes('scene7.com')) {
      let highResUrl = url
        .replace(/wid=\d+&hei=\d+/g, 'wid=2000&hei=2000')
        .replace(/\?fmt=webp&wid=\d+/g, '?fmt=webp&wid=2000')
        .replace(/_\d+x\d+\./g, '_2000x2000.');

      if (highResUrl !== url) {
        console.log(`🔄 Target URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // Best Buy images
    if (url.includes('bestbuy.com') || url.includes('bbystatic.com')) {
      let highResUrl = url
        .replace(/;maxHeight=\d+;maxWidth=\d+/g, ';maxHeight=2000;maxWidth=2000')
        .replace(/\?w=\d+&h=\d+/g, '?w=2000&h=2000')
        .replace(/_\d+x\d+\./g, '_2000x2000.');

      if (highResUrl !== url) {
        console.log(`🔄 Best Buy URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // Costco images
    if (url.includes('costco.com') || url.includes('costcocdn.com')) {
      let highResUrl = url
        .replace(/wid_\d+,hei_\d+/g, 'wid_2000,hei_2000')
        .replace(/\?wid=\d+&hei=\d+/g, '?wid=2000&hei=2000');

      if (highResUrl !== url) {
        console.log(`🔄 Costco URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // 独立站智能优化 - 优先处理
    // 1. 通用独立站缩略图模式检测和转换
    const thumbnailPatterns = [
      // 通用缩略图模式
      /_thumb\.|_small\.|_mini\.|_xs\.|_s\./gi,
      /_\d+x\d+\./gi,
      /thumb\/|small\/|mini\/|xs\/|s\//gi,
      /\/\d+x\d+\//gi,
      // WordPress/WooCommerce
      /-\d+x\d+\./gi,
      /-thumbnail\.|_thumbnail\./gi,
      // Shopify
      /_compact\.|_small\.|_medium\./gi,
      // 通用参数
      /\?w=\d+|\?width=\d+|\?size=\d+/gi,
      /&w=\d+|&width=\d+|&size=\d+/gi
    ];

    let independentSiteUrl = url;
    let wasOptimized = false;

    // 应用所有缩略图转换规则
    thumbnailPatterns.forEach(pattern => {
      const before = independentSiteUrl;
      if (pattern.toString().includes('gi')) {
        // 正则表达式替换
        independentSiteUrl = independentSiteUrl
          .replace(/_thumb\./gi, '_large.')
          .replace(/_small\./gi, '_large.')
          .replace(/_mini\./gi, '_large.')
          .replace(/_xs\./gi, '_xl.')
          .replace(/_s\./gi, '_xl.')
          .replace(/_\d+x\d+\./gi, '_2000x2000.')
          .replace(/thumb\//gi, 'large/')
          .replace(/small\//gi, 'large/')
          .replace(/mini\//gi, 'large/')
          .replace(/xs\//gi, 'xl/')
          .replace(/s\//gi, 'xl/')
          .replace(/\/\d+x\d+\//gi, '/2000x2000/')
          .replace(/-\d+x\d+\./gi, '-2000x2000.')
          .replace(/-thumbnail\./gi, '-large.')
          .replace(/_thumbnail\./gi, '_large.')
          .replace(/_compact\./gi, '_large.')
          .replace(/_medium\./gi, '_large.')
          .replace(/\?w=\d+/gi, '?w=2000')
          .replace(/\?width=\d+/gi, '?width=2000')
          .replace(/\?size=\d+/gi, '?size=2000')
          .replace(/&w=\d+/gi, '&w=2000')
          .replace(/&width=\d+/gi, '&width=2000')
          .replace(/&size=\d+/gi, '&size=2000');
      }
      if (before !== independentSiteUrl) {
        wasOptimized = true;
      }
    });

    if (wasOptimized) {
      console.log(`🔄 Independent site URL optimized: ${url.substring(0, 80)}...`);
      console.log(`   ➡️ Optimized: ${independentSiteUrl.substring(0, 80)}...`);
      return independentSiteUrl;
    }

    // 2. 检测常见的CDN和图片服务
    if (url.includes('cloudinary.com')) {
      // Cloudinary图片优化
      let highResUrl = url
        .replace(/\/w_\d+,h_\d+\//g, '/w_2000,h_2000/')
        .replace(/\/c_thumb\//g, '/c_scale/')
        .replace(/\/w_\d+\//g, '/w_2000/')
        .replace(/\/h_\d+\//g, '/h_2000/')
        .replace(/\/c_fill,w_\d+,h_\d+\//g, '/c_scale,w_2000/')
        .replace(/\/q_auto:\w+\//g, '/q_auto:best/');

      if (highResUrl !== url) {
        console.log(`🔄 Cloudinary URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('imgix.net') || url.includes('imgix.com')) {
      // Imgix图片优化
      let highResUrl = url
        .replace(/[?&]w=\d+/g, '?w=2000')
        .replace(/[?&]h=\d+/g, '&h=2000')
        .replace(/[?&]fit=\w+/g, '&fit=scale')
        .replace(/[?&]q=\d+/g, '&q=90');

      if (highResUrl !== url) {
        console.log(`🔄 Imgix URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // UK Retail platforms
    if (url.includes('argos.co.uk') || url.includes('argos-assets.co.uk')) {
      let highResUrl = url
        .replace(/\/wid=\d+&hei=\d+/g, '/wid=2000&hei=2000')
        .replace(/_\d+x\d+\./g, '_2000x2000.')
        .replace(/\/small\//g, '/large/')
        .replace(/\/thumb\//g, '/large/');

      if (highResUrl !== url) {
        console.log(`🔄 Argos UK URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('johnlewis.com') || url.includes('jlp.') || url.includes('johnlewis-')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?w=\d+&h=\d+/g, '?w=2000&h=2000')
        .replace(/\?width=\d+/g, '?width=2000');

      if (highResUrl !== url) {
        console.log(`🔄 John Lewis URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('next.co.uk') || url.includes('nextassets.')) {
      let highResUrl = url
        .replace(/\/sz_\d+\//g, '/sz_2000/')
        .replace(/\?hei=\d+&wid=\d+/g, '?hei=2000&wid=2000')
        .replace(/\/thumb\//g, '/zoom/');

      if (highResUrl !== url) {
        console.log(`🔄 Next UK URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // German platforms  
    if (url.includes('otto.de') || url.includes('otto-image')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?w=\d+&h=\d+/g, '?w=2000&h=2000')
        .replace(/\_\d+x\d+\./g, '_2000x2000.');

      if (highResUrl !== url) {
        console.log(`🔄 Otto.de URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('zalando.') || url.includes('zalando-')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?size=\d+x\d+/g, '?size=2000x2000')
        .replace(/\/thumb\//g, '/large/');

      if (highResUrl !== url) {
        console.log(`🔄 Zalando URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('mediamarkt.') || url.includes('saturn.de')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?width=\d+&height=\d+/g, '?width=2000&height=2000')
        .replace(/\_thumb\./g, '_large.');

      if (highResUrl !== url) {
        console.log(`🔄 MediaMarkt/Saturn URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // Dutch platforms
    if (url.includes('bol.com') || url.includes('bol-image')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?width=\d+&height=\d+/g, '?width=2000&height=2000')
        .replace(/\/(s|m|l)\//g, '/xl/');

      if (highResUrl !== url) {
        console.log(`🔄 Bol.com URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('coolblue.')) {
      let highResUrl = url
        .replace(/\/fit_\d+x\d+\//g, '/fit_2000x2000/')
        .replace(/\?width=\d+/g, '?width=2000')
        .replace(/\/thumb\//g, '/zoom/');

      if (highResUrl !== url) {
        console.log(`🔄 Coolblue URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // French platforms
    if (url.includes('fnac.com') || url.includes('fnac-static')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?width=\d+&height=\d+/g, '?width=2000&height=2000')
        .replace(/\_m\./g, '_xl.');

      if (highResUrl !== url) {
        console.log(`🔄 Fnac URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('cdiscount.com') || url.includes('cdiscount-')) {
      let highResUrl = url
        .replace(/\/\d+x\d+\//g, '/2000x2000/')
        .replace(/\?f=\d+x\d+/g, '?f=2000x2000')
        .replace(/\/m\//g, '/l/');

      if (highResUrl !== url) {
        console.log(`🔄 Cdiscount URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    if (url.includes('imagekit.io')) {
      // ImageKit图片优化
      let highResUrl = url
        .replace(/tr:w-\d+,h-\d+/g, 'tr:w-2000,h-2000')
        .replace(/tr:w-\d+/g, 'tr:w-2000')
        .replace(/tr:h-\d+/g, 'tr:h-2000');

      if (highResUrl !== url) {
        console.log(`🔄 ImageKit URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // 2. WooCommerce和WordPress独立站
    if (url.includes('wp-content/uploads') || url.includes('woocommerce')) {
      let highResUrl = url
        // WordPress缩略图格式：image-150x150.jpg → image.jpg
        .replace(/-\d+x\d+\.(jpg|jpeg|png|webp)/gi, '.$1')
        // WooCommerce产品图片：product-300x300.jpg → product.jpg  
        .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp))/gi, '')
        // 移除WordPress的尺寸后缀
        .replace(/-scaled\./g, '.')
        .replace(/-medium\./g, '.')
        .replace(/-large\./g, '.')
        .replace(/-thumbnail\./g, '.');

      if (highResUrl !== url) {
        console.log(`🔄 WordPress/WooCommerce URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
      }
      return highResUrl;
    }

    // 3. 通用独立站模式检测
    let highResUrl = url;
    let hasConversion = false;

    // 通用尺寸参数检测和转换
    const genericPatterns = [
      // URL参数格式：?width=300&height=300 → ?width=2000&height=2000
      { pattern: /([?&])width=\d+/gi, replacement: '$1width=2000' },
      { pattern: /([?&])height=\d+/gi, replacement: '$1height=2000' },
      { pattern: /([?&])w=\d+/gi, replacement: '$1w=2000' },
      { pattern: /([?&])h=\d+/gi, replacement: '$1h=2000' },
      { pattern: /([?&])size=\d+/gi, replacement: '$1size=2000' },

      // 文件名中的尺寸：image_300x300.jpg → image_2000x2000.jpg
      { pattern: /_\d+x\d+\./gi, replacement: '_2000x2000.' },
      { pattern: /-\d+x\d+\./gi, replacement: '-2000x2000.' },

      // 常见缩略图标识符
      { pattern: /[_-]thumb[_-]?/gi, replacement: '_large_' },
      { pattern: /[_-]small[_-]?/gi, replacement: '_large_' },
      { pattern: /[_-]medium[_-]?/gi, replacement: '_large_' },
      { pattern: /[_-]mini[_-]?/gi, replacement: '_large_' },

      // 尺寸相关的路径片段：/thumbs/ → /images/
      { pattern: /\/thumbs?\//gi, replacement: '/images/' },
      { pattern: /\/thumb_/gi, replacement: '/full_' },
      { pattern: /\/small\//gi, replacement: '/large/' },
      { pattern: /\/medium\//gi, replacement: '/large/' },

      // 数字尺寸标识：image50.jpg → image.jpg, image_200.jpg → image.jpg
      { pattern: /(\w+)_?\d{2,4}(\.(jpg|jpeg|png|webp))/gi, replacement: '$1$2' },
    ];

    // 应用通用转换规则
    genericPatterns.forEach(({ pattern, replacement }) => {
      const newUrl = highResUrl.replace(pattern, replacement);
      if (newUrl !== highResUrl) {
        hasConversion = true;
        highResUrl = newUrl;
      }
    });

    // 4. 尝试构造可能的高清版本URL
    if (!hasConversion) {
      // 如果没有明显的尺寸标识，尝试添加高清参数
      if (highResUrl.includes('?')) {
        // 已有参数，添加尺寸参数
        if (!highResUrl.includes('width=') && !highResUrl.includes('w=')) {
          highResUrl += '&width=2000&height=2000';
          hasConversion = true;
        }
      } else {
        // 没有参数，尝试添加质量参数
        const ext = highResUrl.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          highResUrl += '?quality=95&width=2000';
          hasConversion = true;
        }
      }
    }

    if (highResUrl !== url) {
      console.log(`🔄 Generic URL converted: ${url.substring(0, 60)}... → ${highResUrl.substring(0, 60)}...`);
    }

    return highResUrl;
  } catch (error) {
    console.error('❌ URL conversion failed:', error);
    return url; // Return original URL if conversion fails
  }
}

// Helper function to calculate image quality score
function calculateImageScore(url, alt, className, width, height) {
  let score = 50; // Lower base score to be more inclusive

  const lowercaseUrl = url.toLowerCase();
  const lowercaseAlt = alt.toLowerCase();
  const lowercaseClass = className.toLowerCase();

  // Platform-specific high-priority patterns - 平衡严格性和覆盖率
  const highPriorityPatterns = [
    // Amazon specific - 最高优先级
    'landingImage', 'a-dynamic-image', 'a-size-large', 'imgBlkFront',
    'a-image-wrapper', 'a-button-thumbnail', 'imgTagWrapper',

    // Universal high-value patterns
    'product', 'main', 'hero', 'primary', 'featured', 'detail', 'large',
    'gallery', 'zoom', 'fullsize', 'original', 'image', 'img', 'pic', 'photo'
  ];

  highPriorityPatterns.forEach(pattern => {
    if (lowercaseUrl.includes(pattern) || lowercaseAlt.includes(pattern) || lowercaseClass.includes(pattern)) {
      score += 200; // Much higher bonus for product images
    }
  });

  // Medium-priority indicators
  const mediumPriorityPatterns = [
    'banner', 'showcase', 'cover', 'thumb', 'preview', 'image', 'pic', 'photo'
  ];

  mediumPriorityPatterns.forEach(pattern => {
    if (lowercaseUrl.includes(pattern) || lowercaseAlt.includes(pattern) || lowercaseClass.includes(pattern)) {
      score += 30;
    }
  });

  // 超严格过滤 - 彻底清除非产品图片
  const strongNegativePatterns = [
    // 广告和推荐 - 超严厉惩罚
    'ad', 'ads', 'advertisement', 'sponsored', 'sponsor', 'promo', 'banner',
    'recommended', 'suggest', 'related', 'similar', 'also-bought', 'cross-sell',
    'upsell', 'recommendation', 'carousel', 'slider', 'widget', 'module',

    // Amazon specific 广告和推荐
    'sp-atf', 'adplacements', 'amazontrustsignals', 'acs-', 'desktop-ad',
    'mobile-ad', 'ad-feedback', 'ad-display', 'sponsored-products',
    'aplus-', 'a-plus', 'enhanced-content', 'comparison', 'feature-',
    'brand-', 'storefront', 'variation', 'swatch', 'color-',

    // 页面导航和界面
    'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
    'logo', 'icon', 'badge', 'button', 'arrow', 'bullet', 'dot', '1x1',
    'pixel', 'tracker', 'analytics', 'loading', 'spinner', 'placeholder',
    'blank', 'spacer', 'separator', 'divider', 'background',

    // 社交和分享
    'facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'pinterest',
    'social', 'share', 'follow', 'wishlist', 'favorite', 'bookmark',

    // 小图和缩略图
    'thumb', 'mini', 'tiny', 'small', 'xs', 'icon-', 'thumbnail',
    'preview', 'sample', 'swatch', 'chip',

    // Amazon推荐系统
    'customers-', 'bought-together', 'frequently-', 'compare',
    'alternatives', 'substitutes', 'bundle', 'deal', 'promotion',
    'bestseller', 'choice', 'pick', 'selection',

    // 评价和评分
    'review', 'rating', 'star', 'feedback', 'comment', 'testimonial',

    // 其他品牌和商品
    'other-', 'more-', 'additional-', 'extra-', 'bonus-'
  ];

  strongNegativePatterns.forEach(pattern => {
    if (lowercaseUrl.includes(pattern) || lowercaseAlt.includes(pattern) || lowercaseClass.includes(pattern)) {
      score -= 150; // Strong penalty for clearly non-product images
    }
  });

  // Light penalty for some patterns (but don't completely exclude)
  const lightNegativePatterns = [
    'nav', 'menu', 'header', 'footer', 'sidebar', 'widget',
    'avatar', 'profile', 'user', 'comment', 'rating', 'star'
  ];

  lightNegativePatterns.forEach(pattern => {
    if (lowercaseUrl.includes(pattern) || lowercaseAlt.includes(pattern) || lowercaseClass.includes(pattern)) {
      score -= 20; // Light penalty only
    }
  });

  // Balanced quality requirements - practical for most product images
  if (width && height) {
    const area = width * height;
    // 更实用的尺寸要求
    if (area > 2000000) score += 200; // Ultra high-res (2M+ pixels)
    else if (area > 1000000) score += 150; // Very large images (1M+ pixels)
    else if (area > 500000) score += 100; // Large images (500k+ pixels)
    else if (area > 200000) score += 80; // Medium images (200k+ pixels)
    else if (area > 100000) score += 50; // Small-medium images (100k+ pixels)
    else if (area < 50000) score -= 100; // 只对很小的图片减分

    // 最小尺寸要求更宽松
    if (width < 100 || height < 100) {
      score -= 50; // 只对很小的图片适度减分
    }

    // Aspect ratio bonus for product images
    const aspectRatio = width / height;
    if (aspectRatio >= 0.75 && aspectRatio <= 1.5) {
      score += 30; // Good product image aspect ratio
    }
  } else {
    // 没有尺寸信息的图片适度减分
    score -= 30;
  }

  // Resolution indicators in URL - 扩展高清标识符
  const highResIndicators = [
    '_large', '_xl', '_big', '_full', '_original', '_hd', '_high',
    '1200', '1920', '2048', '1500', '1600', '1800', '2400', '3000',
    'large', 'orig', 'master', 'max', 'full-size', 'high-res'
  ];

  const hasHighResIndicator = highResIndicators.some(indicator =>
    lowercaseUrl.includes(indicator)
  );

  if (hasHighResIndicator) {
    score += 100; // 增加高清图片奖励分数
  }

  if (lowercaseUrl.includes('_small') || lowercaseUrl.includes('_thumb') ||
    lowercaseUrl.includes('_mini') || lowercaseUrl.includes('50x50') ||
    lowercaseUrl.includes('100x100') || lowercaseUrl.includes('64x64')) {
    score -= 50;
  }

  // Format preferences
  if (lowercaseUrl.includes('.webp')) score += 25; // Modern format
  if (lowercaseUrl.includes('.jpg') || lowercaseUrl.includes('.jpeg')) score += 15;
  if (lowercaseUrl.includes('.png')) score += 10;

  // CDN and quality indicators
  if (lowercaseUrl.includes('cdn') || lowercaseUrl.includes('cloudinary') ||
    lowercaseUrl.includes('imgix') || lowercaseUrl.includes('amazonaws')) {
    score += 30;
  }

  return Math.max(0, score); // Ensure non-negative score
}

// Helper function to validate image URLs
function isValidImageUrl(url) {
  try {
    const parsedUrl = new URL(url);
    // Check if it's a valid image extension
    const path = parsedUrl.pathname.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];

    // Also accept URLs that might have image content types or query parameters
    return validExtensions.some(ext => path.endsWith(ext)) ||
      path.includes('/image') ||
      parsedUrl.search.includes('format=') ||
      parsedUrl.hostname.includes('cdn') ||
      parsedUrl.hostname.includes('img');
  } catch {
    return false;
  }
}

// 调试端点 - 查看所有存储的视频结果
app.get('/api/video-result/debug', (req, res) => {
  console.log('🔍 调试：当前存储的视频结果:', videoResults);
  const allResults = Array.from(videoResults.entries()).map(([key, value]) => ({
    sessionId: key,
    ...value
  }));
  res.json({
    success: true,
    count: videoResults.size,
    results: allResults
  });
});

// 前端轮询检查端点
app.get('/api/video-result/check/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  console.log('🔍 轮询检查 sessionId:', sessionId);
  console.log('🗄️ 当前存储的所有 sessionId:', Array.from(videoResults.keys()));

  const result = videoResults.get(sessionId);

  if (result) {
    console.log('🎉 找到视频结果:', sessionId);
    // 返回结果后清理存储
    videoResults.delete(sessionId);
    res.json({
      success: true,
      result: result
    });
  } else {
    console.log('❌ 未找到视频结果:', sessionId);
    res.json({
      success: false,
      message: 'No result found yet'
    });
  }
});
// 🔧 全局billing监控
if (!global.billingTracker) {
  global.billingTracker = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    emergencyFallbacks: 0,
    callHistory: []
  };
}

// 🔧 UNIFIED BILLING: 统一的积分扣除函数
async function handleTokenBilling(responseData, user, endpoint = 'unknown', options = {}) {
  const { emergencyFallback = false } = options;

  // 🔧 全局tracking：记录每次billing调用
  global.billingTracker.totalCalls++;
  if (emergencyFallback) {
    global.billingTracker.emergencyFallbacks++;
  }

  const callId = `${endpoint}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  console.log(`🎯 [BILLING-TRACKER] Call #${global.billingTracker.totalCalls}: ${callId}`);
  console.log(`🔍 [BILLING-${endpoint}] Checking responseData structure:`, {
    hasResponseData: !!responseData,
    hasMetadata: !!(responseData?.metadata),
    hasUsage: !!(responseData?.metadata?.usage),
    hasTotalTokens: !!(responseData?.metadata?.usage?.total_tokens),
    hasUsageField: !!(responseData?.usage), // 检查直接在responseData下的usage字段
    responseDataKeys: responseData ? Object.keys(responseData) : [],
    metadataKeys: responseData?.metadata ? Object.keys(responseData.metadata) : [],
    usageKeys: responseData?.metadata?.usage ? Object.keys(responseData.metadata.usage) : []
  });

  // 🔧 增强条件检查：支持多种数据结构
  let totalTokens = null;
  let actualCost = null;
  let usage = null;

  // 检查 metadata.usage (标准位置)
  if (responseData?.metadata?.usage?.total_tokens) {
    usage = responseData.metadata.usage;
    totalTokens = usage.total_tokens;
    actualCost = Number(usage.total_price || (totalTokens * 0.000002175));
    console.log(`✅ [BILLING-${endpoint}] Found usage in metadata.usage`);
  }
  // 检查直接在responseData下的usage字段
  else if (responseData?.usage?.total_tokens) {
    usage = responseData.usage;
    totalTokens = usage.total_tokens;
    actualCost = Number(usage.total_price || (totalTokens * 0.000002175));
    console.log(`✅ [BILLING-${endpoint}] Found usage in responseData.usage`);
  }
  // 最后的fallback：如果没有usage但有其他token相关字段
  else if (responseData && (responseData.token_usage || responseData.tokens)) {
    const tokens = responseData.token_usage?.total_tokens || responseData.tokens || 100; // fallback默认值
    totalTokens = tokens;
    actualCost = tokens * 0.000002175; // 使用默认价格
    console.log(`⚠️ [BILLING-${endpoint}] Using fallback token calculation: ${tokens} tokens`);
  }

  if (totalTokens && totalTokens > 0) {
    const pointsToDeduct = Math.ceil(actualCost * 10000); // 🔧 CORRECT FORMULA: 美金成本 × 10000 = 积分

    // 🔧 Emergency fallback特殊标记
    if (emergencyFallback) {
      console.log(`🚨 [BILLING-${endpoint}] EMERGENCY FALLBACK billing: ${totalTokens} tokens`);
      console.log(`⚠️ [BILLING-${endpoint}] This billing was triggered by context management failure`);
    } else {
      console.log(`💰 [BILLING-${endpoint}] Multi-node LLM: ${totalTokens} tokens`);
    }
    console.log(`💰 [COST-${endpoint}] Actual cost: $${actualCost.toFixed(6)} = ${pointsToDeduct} points`);

    const userId = getValidUserId(user);

    // 🔧 IMPLEMENT ACTUAL POINTS DEDUCTION
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (supabaseClient && userId) {
      try {
        // First check current balance
        const { data: userBalance, error: balanceError } = await supabaseClient
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single();

        if (balanceError) {
          console.log(`⚠️  [BILLING-${endpoint}] User not found in database: ${userId}`);

          // 🔧 新策略：为临时用户创建游客记录，或跳过计费但记录使用
          console.log(`💡 [BILLING-${endpoint}] Creating guest user session for: ${userId}`);

          // 临时方案：不扣除积分，但记录使用情况
          console.log(`⚠️  [BILLING-${endpoint}] Guest user - no points deducted, usage recorded only`);

          // 在内存中记录guest用户余额
          if (!global.guestBalances) {
            global.guestBalances = new Map();
          }

          const currentGuestBalance = global.guestBalances.get(userId) || 10000;
          const newGuestBalance = Math.max(0, currentGuestBalance - pointsToDeduct);
          global.guestBalances.set(userId, newGuestBalance);

          console.log(`📝 [BILLING-${endpoint}] Guest balance updated: ${currentGuestBalance} → ${newGuestBalance} (memory only)`);

          // 🔧 更新全局统计
          global.billingTracker.successfulCalls++;
          global.billingTracker.callHistory.push({
            callId,
            endpoint,
            tokens: totalTokens,
            points: pointsToDeduct,
            success: true,
            isGuest: true,
            emergencyFallback,
            timestamp: new Date().toISOString()
          });

          console.log(`✅ [BILLING-TRACKER] Success #${global.billingTracker.successfulCalls}: ${callId}`);

          return {
            tokens: totalTokens,
            points: pointsToDeduct,
            cost: actualCost.toFixed(6),
            newBalance: newGuestBalance,
            success: true,
            isGuest: true,
            emergencyFallback
          };
        } else {
          const currentBalance = userBalance.balance || 0;
          const newBalance = Math.max(0, currentBalance - pointsToDeduct);

          // Update user balance
          const { error: updateError } = await supabaseClient
            .from('users')
            .update({
              balance: newBalance
            })
            .eq('id', userId);

          if (updateError) {
            console.error(`❌ [BILLING-${endpoint}] Failed to deduct points: ${updateError.message}`);

            // 🔧 更新失败统计
            global.billingTracker.failedCalls++;
            global.billingTracker.callHistory.push({
              callId,
              endpoint,
              tokens: totalTokens,
              points: pointsToDeduct,
              success: false,
              error: 'DATABASE_UPDATE_ERROR',
              emergencyFallback,
              timestamp: new Date().toISOString()
            });

            console.log(`❌ [BILLING-TRACKER] Failed #${global.billingTracker.failedCalls}: ${callId} - DATABASE_UPDATE_ERROR`);

            return {
              tokens: totalTokens,
              points: pointsToDeduct,
              cost: actualCost.toFixed(6),
              newBalance: currentBalance, // 失败时返回原余额
              success: false,
              emergencyFallback
            };
          } else {
            console.log(`✅ [BILLING-${endpoint}] Deducted ${pointsToDeduct} points. Balance: ${currentBalance} → ${newBalance}`);

            // 🔧 更新全局统计
            global.billingTracker.successfulCalls++;
            global.billingTracker.callHistory.push({
              callId,
              endpoint,
              tokens: totalTokens,
              points: pointsToDeduct,
              success: true,
              isGuest: false,
              emergencyFallback,
              balanceChange: `${currentBalance} → ${newBalance}`,
              timestamp: new Date().toISOString()
            });

            console.log(`✅ [BILLING-TRACKER] Success #${global.billingTracker.successfulCalls}: ${callId}`);

            return {
              tokens: totalTokens,
              points: pointsToDeduct,
              cost: actualCost.toFixed(6),
              newBalance: newBalance, // 🔧 关键修复：返回更新后的余额
              success: true,
              emergencyFallback
            };
          }
        }
      } catch (dbError) {
        console.error(`❌ [BILLING-${endpoint}] Database error: ${dbError.message}`);

        // 🔧 更新失败统计
        global.billingTracker.failedCalls++;
        global.billingTracker.callHistory.push({
          callId,
          endpoint,
          tokens: totalTokens,
          points: pointsToDeduct,
          success: false,
          error: 'DATABASE_CONNECTION_ERROR',
          emergencyFallback,
          timestamp: new Date().toISOString()
        });

        console.log(`❌ [BILLING-TRACKER] Failed #${global.billingTracker.failedCalls}: ${callId} - DATABASE_CONNECTION_ERROR`);

        return {
          tokens: totalTokens,
          points: pointsToDeduct,
          cost: actualCost.toFixed(6),
          newBalance: null, // 数据库错误时无法获取余额
          success: false,
          emergencyFallback
        };
      }
    } else {
      console.log(`⚠️  [BILLING-${endpoint}] Cannot deduct points - missing database or userId`);

      // 🔧 更新失败统计
      global.billingTracker.failedCalls++;
      global.billingTracker.callHistory.push({
        callId,
        endpoint,
        tokens: totalTokens,
        points: pointsToDeduct,
        success: false,
        error: 'MISSING_DATABASE_OR_USER',
        emergencyFallback,
        timestamp: new Date().toISOString()
      });

      console.log(`❌ [BILLING-TRACKER] Failed #${global.billingTracker.failedCalls}: ${callId} - MISSING_DATABASE_OR_USER`);

      return {
        tokens: totalTokens,
        points: pointsToDeduct,
        cost: actualCost.toFixed(6),
        newBalance: null, // 无法访问数据库
        success: false,
        emergencyFallback
      };
    }
  } else {
    // 🚨 没有找到任何token使用信息 - 这可能导致计费遗漏！
    console.error(`🚨 [BILLING-${endpoint}] NO TOKEN USAGE DATA FOUND! This interaction will not be billed!`);
    console.error(`🚨 [BILLING-${endpoint}] responseData structure:`, JSON.stringify(responseData, null, 2));

    // 记录这次遗漏，用于调试和审计
    console.error(`🚨 [BILLING-${endpoint}] POTENTIAL BILLING LOSS - endpoint: ${endpoint}, user: ${getValidUserId(user)}, timestamp: ${new Date().toISOString()}`);

    // 🔧 更新失败统计
    global.billingTracker.failedCalls++;
    global.billingTracker.callHistory.push({
      callId,
      endpoint,
      tokens: 0,
      points: 0,
      success: false,
      error: 'NO_TOKEN_DATA',
      emergencyFallback,
      timestamp: new Date().toISOString()
    });

    console.log(`❌ [BILLING-TRACKER] Failed #${global.billingTracker.failedCalls}: ${callId} - NO_TOKEN_DATA`);

    return {
      tokens: 0,
      points: 0,
      cost: '0',
      newBalance: null,
      success: false,
      error: 'NO_TOKEN_DATA',
      endpoint: endpoint,
      emergencyFallback
    };
  }

  return null;
}

// 🔧 BILLING监控API端点
app.get('/api/billing/stats', (req, res) => {
  if (!global.billingTracker) {
    return res.json({
      error: 'Billing tracker not initialized',
      stats: null
    });
  }

  const tracker = global.billingTracker;
  const successRate = tracker.totalCalls > 0 ?
    ((tracker.successfulCalls / tracker.totalCalls) * 100).toFixed(2) : '0.00';

  const stats = {
    totalCalls: tracker.totalCalls,
    successfulCalls: tracker.successfulCalls,
    failedCalls: tracker.failedCalls,
    emergencyFallbacks: tracker.emergencyFallbacks,
    successRate: `${successRate}%`,
    recentHistory: tracker.callHistory.slice(-10), // 最近10次记录
    summary: {
      status: tracker.failedCalls === 0 ? 'HEALTHY' : tracker.failedCalls > tracker.successfulCalls ? 'CRITICAL' : 'WARNING',
      lastCall: tracker.callHistory.length > 0 ? tracker.callHistory[tracker.callHistory.length - 1].timestamp : null,
      uptime: new Date().toISOString()
    }
  };

  console.log(`📊 [BILLING-STATS] Stats requested:`, {
    totalCalls: stats.totalCalls,
    successRate: stats.successRate,
    status: stats.summary.status
  });

  res.json(stats);
});

// 🔧 全局billing监控
if (!global.billingTracker) {
  global.billingTracker = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    emergencyFallbacks: 0,
    callHistory: []
  };
}

// 🔧 新增：素材分析端点 - 转发至 claude-agent-service 的 Gemini 多模态分析
app.post('/api/dify/analyze-materials', async (req, res) => {
  const { supabaseUuid, images, documents } = req.body;

  console.log('[Material Analysis] Forwarding to claude-agent-service:', {
    supabaseUuid,
    imageCount: images?.length || 0,
    documentCount: documents?.length || 0
  });

  // claude-agent-service URL
  const CLAUDE_AGENT_URL = process.env.XHS_BACKEND_URL || 'https://xiaohongshu-automation-ai.zeabur.app';

  try {
    // 转发请求到 claude-agent-service 的 Gemini 多模态端点
    const agentResponse = await fetchWithTimeoutAndRetry(`${CLAUDE_AGENT_URL}/api/materials/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseUuid,
        images,
        documents,
        // 可以携带更多上下文信息
        productName: req.body.productName,
        targetAudience: req.body.targetAudience
      })
    }, 120000, 2); // 120秒超时，多模态分析需要更长时间

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('[Material Analysis] claude-agent-service error:', errorText);
      // 失败时回退到 Dify
      return handleDifyMaterialAnalysis(req, res);
    }

    const result = await agentResponse.json();
    console.log('[Material Analysis] Analysis completed via claude-agent-service, provider:', result.provider);

    res.json(result);

  } catch (error) {
    console.error('[Material Analysis] Error calling claude-agent-service:', error);
    // 失败时回退到 Dify
    return handleDifyMaterialAnalysis(req, res);
  }
});

// Dify 素材分析回退函数
async function handleDifyMaterialAnalysis(req, res) {
  const { supabaseUuid, images, documents } = req.body;

  if (!DIFY_API_URL || !DIFY_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: Missing AI API configuration'
    });
  }

  try {
    let analysisPrompt = '请分析以下产品素材链接，提取产品特点、卖点、适合的目标人群和营销角度：\n\n';

    if (images && images.length > 0) {
      analysisPrompt += `产品图片 (${images.length}张):\n`;
      images.forEach((url, i) => {
        analysisPrompt += `- 图片${i + 1}: ${url}\n`;
      });
      analysisPrompt += '\n';
    }

    if (documents && documents.length > 0) {
      analysisPrompt += `产品资料 (${documents.length}个文档):\n`;
      documents.forEach((url, i) => {
        analysisPrompt += `- 文档${i + 1}: ${url}\n`;
      });
    }

    analysisPrompt += `\n请提供：产品特点、核心卖点、目标人群、营销角度、内容创作建议`;

    const difyResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: analysisPrompt,
        user: supabaseUuid || 'material-analysis-user',
        response_mode: 'blocking'
      })
    }, 60000, 2);

    if (!difyResponse.ok) {
      throw new Error('Dify API error');
    }

    const difyData = await difyResponse.json();
    res.json({
      success: true,
      analysis: difyData.answer || difyData.text || '分析完成',
      provider: 'dify'
    });

  } catch (error) {
    console.error('[Material Analysis] Dify Error:', error);
    res.status(500).json({
      success: false,
      error: '素材分析失败，请稍后重试'
    });
  }
}

// 🔧 新增：单素材分析端点 - 上传时自动分析每个图片/文档
app.post('/api/material/analyze-single', async (req, res) => {
  const { supabaseUuid, fileUrl, fileType, fileName } = req.body;

  console.log('[Single Material Analysis] Request:', {
    supabaseUuid,
    fileUrl: fileUrl?.substring(0, 50) + '...',
    fileType,
    fileName
  });

  if (!fileUrl) {
    return res.status(400).json({
      success: false,
      error: 'fileUrl is required'
    });
  }

  const CLAUDE_AGENT_URL = process.env.XHS_BACKEND_URL || 'https://xiaohongshu-automation-ai.zeabur.app';

  try {
    // 调用 claude-agent-service 的单素材分析端点
    const agentResponse = await fetchWithTimeoutAndRetry(`${CLAUDE_AGENT_URL}/api/material/analyze-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseUuid,
        fileUrl,
        fileType,
        fileName
      })
    }, 60000, 2); // 60秒超时

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('[Single Material Analysis] Agent error:', errorText);

      // 回退：使用简单描述
      return res.json({
        success: true,
        analysis: {
          ai_description: `${fileType === 'image' ? '产品图片' : '产品文档'}: ${fileName || '未命名'}`,
          ai_tags: [fileType === 'image' ? '图片' : '文档'],
          ai_category: fileType === 'image' ? 'product_photo' : 'document'
        },
        provider: 'fallback'
      });
    }

    const result = await agentResponse.json();
    console.log('[Single Material Analysis] Success:', result.provider);
    res.json(result);

  } catch (error) {
    console.error('[Single Material Analysis] Error:', error);
    // 回退：返回基础分析结果
    res.json({
      success: true,
      analysis: {
        ai_description: `${fileType === 'image' ? '产品图片' : '产品文档'}: ${fileName || '未命名'}`,
        ai_tags: [fileType === 'image' ? '图片' : '文档'],
        ai_category: fileType === 'image' ? 'product_photo' : 'document'
      },
      provider: 'fallback'
    });
  }
});

// 🔧 新增：矩阵策略生成端点 - AI生成账号人设和任务分配
app.post('/api/dify/matrix/generate-strategy', async (req, res) => {
  const { supabase_uuid, product_name, target_audience, marketing_goal, material_analysis, accounts } = req.body;

  console.log('[Matrix Strategy] Generating strategy for:', {
    supabase_uuid,
    product_name,
    accountCount: accounts?.length || 0
  });

  if (!DIFY_API_URL || !DIFY_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: Missing Dify API configuration'
    });
  }

  if (!accounts || accounts.length === 0) {
    return res.status(400).json({
      success: false,
      error: '请先添加小红书账号'
    });
  }

  try {
    const prompt = `你是一个小红书矩阵运营专家。请为以下产品和账号矩阵制定运营策略：

## 产品信息
- 产品名称：${product_name}
- 目标受众：${target_audience || '通用'}
- 营销目标：${marketing_goal || '品牌曝光'}
${material_analysis ? `- 产品分析：${material_analysis}` : ''}

## 账号列表
${accounts.map((a, i) => `${i + 1}. ${a.nickname || '账号' + (i + 1)} (ID: ${a.id})`).join('\n')}

## 请为每个账号分配：
1. 人设定位（种草达人/专业测评/品牌官方/生活分享/教程分享）
2. 内容风格（温暖亲切/专业权威/幽默风趣/简约清新）
3. 细分受众
4. 每周发布数（1-7篇）

请以JSON格式返回：
{"account_personas":[{"xhs_account_id":"ID","persona":"人设","content_style":"风格","target_audience":"受众","weekly_post_count":3}]}`;

    const difyResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: prompt,
        user: supabase_uuid || 'matrix-strategy-user',
        response_mode: 'blocking'
      })
    }, 90000, 2);

    if (!difyResponse.ok) {
      throw new Error(`Dify API error: ${await difyResponse.text()}`);
    }

    const difyData = await difyResponse.json();
    const answer = difyData.answer || '';

    let parsedResult;
    try {
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseErr) {
      parsedResult = {
        account_personas: accounts.map((a, i) => ({
          xhs_account_id: a.id,
          persona: i === 0 ? '种草达人' : '专业测评',
          content_style: '温暖亲切',
          target_audience: target_audience || '通用受众',
          weekly_post_count: 3
        }))
      };
    }

    if (parsedResult.account_personas) {
      parsedResult.account_personas = parsedResult.account_personas.map(p => ({
        ...p,
        supabase_uuid,
        id: `persona-${p.xhs_account_id}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
    }

    res.json({ success: true, ...parsedResult });

  } catch (error) {
    console.error('[Matrix Strategy] Error:', error);
    res.status(500).json({ success: false, error: error.message || '策略生成失败' });
  }
});

// 🔧 新增：内容创作生成端点 - 统一文案和视频/图文生成
app.post('/api/content/generate', async (req, res) => {
  const {
    supabase_uuid,
    productName,
    productDescription,
    targetAudience,
    productImages,
    materialAnalysis,
    marketingGoal,
    wordCount,
    platform,
    contentFormat,
    videoType,
    videoConfig,
    accountId,
    accountPersona,
  } = req.body;

  console.log('[Content Generation] Starting:', {
    supabase_uuid,
    productName,
    marketingGoal,
    contentFormat,
    videoType,
    wordCount
  });

  if (!DIFY_API_URL || !DIFY_API_KEY) {
    return res.status(500).json({
      success: false,
      error: '服务器配置错误：缺少 Dify API 配置'
    });
  }

  if (!productName || !productDescription) {
    return res.status(400).json({
      success: false,
      error: '请提供产品名称和描述'
    });
  }

  try {
    // 构建 Dify 文案生成 prompt
    const marketingGoalMap = {
      'awareness': '提高用户认知',
      'consideration': '解决用户疑惑、说服购买',
      'conversion': '直接促进销售转化'
    };

    const platformToneMap = {
      'xiaohongshu': '小红书风格：种草、真实、生活化、使用emoji',
      'douyin': '抖音风格：快节奏、娱乐、hook强',
      'x': 'X/Twitter风格：简洁、犀利、话题性',
      'tiktok': 'TikTok风格：国际化、娱乐、挑战'
    };

    const prompt = `你是一位顶级小红书营销文案专家。请根据以下信息创作一篇爆款营销文案：

## 产品信息
- 产品名称：${productName}
- 产品描述：${productDescription}
- 目标受众：${targetAudience || '通用'}
${materialAnalysis ? `- 产品分析：${materialAnalysis}` : ''}
${accountPersona ? `- 账号人设：${accountPersona}` : ''}

## 创作要求
- 营销目标：${marketingGoalMap[marketingGoal] || '提高认知'}
- 平台调性：${platformToneMap[platform] || '小红书风格'}
- 目标字数：${wordCount || 500}字

## 输出要求
请以JSON格式返回：
{
  "title": "爆款标题（使用认知缺口/恐惧/挑战常识等心理武器）",
  "titleVariants": ["备选标题1", "备选标题2"],
  "hook": "开头钩子（第一句话）",
  "painPoints": ["痛点1", "痛点2", "痛点3"],
  "solution": "解决方案描述",
  "callToAction": "行动号召",
  "fullContent": "完整文案正文（包含emoji和分段）",
  "hashtags": ["标签1", "标签2", "标签3"],
  "psychologyWeapons": ["使用的心理武器"]
}`;

    const difyResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: prompt,
        user: supabase_uuid || 'content-generator',
        response_mode: 'blocking'
      })
    }, 120000, 2);

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      throw new Error(`Dify API 错误: ${errorText}`);
    }

    const difyData = await difyResponse.json();
    const answer = difyData.answer || '';

    // 解析 JSON 结果
    let copywriteResult;
    try {
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        copywriteResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到 JSON');
      }
    } catch (parseErr) {
      // 如果解析失败，构造基础结果
      copywriteResult = {
        title: productName + ' 使用心得分享',
        titleVariants: [],
        hook: productDescription.substring(0, 50) + '...',
        painPoints: [],
        solution: productDescription,
        callToAction: '快来试试吧！',
        fullContent: answer,
        hashtags: [productName, '种草', '分享'],
        psychologyWeapons: ['默认']
      };
    }

    // 添加字数统计
    copywriteResult.wordCount = copywriteResult.fullContent?.length || 0;

    // 如果是视频内容，调用 n8n UGC 工作流
    let videoResult = null;
    if (contentFormat === 'video' && videoType === 'ugc_n8n' && videoConfig) {
      console.log('[Content Generation] Starting n8n UGC video workflow...');

      // n8n UGC webhook URL
      const n8nWebhookUrl = process.env.VITE_N8N_WEBHOOK_URL ||
        'https://n8n-worker-k4m9.zeabur.app/webhook/9d5986f5-fcba-42bf-b3d7-5fd94660943a/chat';

      const sessionId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      // 构建视频请求参数
      const videoFormData = {
        duration: String(videoConfig.duration),
        productDescription: `${productName}: ${productDescription}`,
        imageUrl: productImages && productImages.length > 0 ? productImages[0] : '',
        characterGender: videoConfig.gender === 'male' ? '男性' : '女性',
        language: videoConfig.language === 'zh-CN' ? '中文' : videoConfig.language === 'en-US' ? '英文' : '日语'
      };

      // 构建 Chat Trigger 格式消息
      const chatInput = `视频创作需求表单：

| 字段 | 值 |
|------|-----|
| 🎬 视频时长 | ${videoFormData.duration}秒 |
| 📝 产品描述 | ${videoFormData.productDescription} |
| 🖼️ 图片链接 | ${videoFormData.imageUrl} |
| 👤 人物性别 | ${videoFormData.characterGender} |
| 🌍 视频语言 | ${videoFormData.language} |
| 📄 文案内容 | ${copywriteResult.fullContent?.substring(0, 200)}... |

请根据以上表单信息创建视频内容。`;

      try {
        console.log('[Content Generation] Sending to n8n webhook:', n8nWebhookUrl);

        const n8nResponse = await fetchWithTimeoutAndRetry(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'sendMessage',
            sessionId: sessionId,
            chatInput: chatInput,
            callbackUrl: `${process.env.VITE_CALLBACK_DOMAIN || 'https://www.prome.live'}/api/video/webhook/complete`,
            metadata: {
              ...videoFormData,
              copywrite: copywriteResult.title,
              supabase_uuid: supabase_uuid,
              source: 'content_creation_form'
            }
          })
        }, 30000, 2);

        if (n8nResponse.ok) {
          const n8nData = await n8nResponse.json().catch(() => ({}));
          console.log('[Content Generation] n8n response:', n8nData);

          videoResult = {
            status: 'processing',
            sessionId: sessionId,
            message: 'UGC 视频生成已启动，完成后将通知您',
            estimatedTime: `${videoConfig.duration * 2}秒`,
            webhookSent: true
          };
        } else {
          console.error('[Content Generation] n8n error:', n8nResponse.status);
          videoResult = {
            status: 'error',
            message: '视频生成启动失败，请稍后重试',
            webhookSent: false
          };
        }
      } catch (n8nError) {
        console.error('[Content Generation] n8n call failed:', n8nError);
        videoResult = {
          status: 'error',
          message: 'n8n 工作流连接失败: ' + n8nError.message,
          webhookSent: false
        };
      }
    }

    res.json({
      success: true,
      copywrite: copywriteResult,
      video: videoResult,
      contentFormat,
      videoType: contentFormat === 'video' ? videoType : null
    });

  } catch (error) {
    console.error('[Content Generation] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '内容生成失败'
    });
  }
});

// 🔧 新增：BettaFish 舆情分析 API - 热点趋势分析
app.post('/api/sentiment/analyze', async (req, res) => {
  const { query, productName, industry, competitors, platforms, timeRange, supabase_uuid, region } = req.body;

  console.log('[BettaFish] Starting trend analysis:', {
    query: query?.substring(0, 50),
    productName,
    industry,
    region,
    supabase_uuid
  });

  // BettaFish 部署地址
  const BETTAFISH_URL = process.env.BETTAFISH_URL || 'https://weibo-sentiment-app.zeabur.app';

  if (!query && !productName) {
    return res.status(400).json({
      success: false,
      error: '请提供分析需求或产品名称'
    });
  }

  // 🔧 Phase 3: 获取完整上下文 (用户配置 + 历史数据 + AI分析)
  let historyContext = '';
  let strategyContext = '';
  let userProfile = null;

  if (supabase_uuid && supabaseClient) {
    try {
      // 获取用户配置 (包含产品信息和策略)
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('supabase_uuid', supabase_uuid)
        .single();

      if (profile) {
        userProfile = profile;
        strategyContext = `
- 营销目标: ${profile.marketing_goal}
- 发布频率: ${profile.post_frequency}
- 品牌风格: ${profile.brand_style}
- 目标受众: ${profile.target_audience || '未设置'}
- 素材分析: ${profile.material_analysis ? profile.material_analysis.substring(0, 200) + '...' : '无'}`;
      }

      // 获取历史内容任务和表现 (最近7天)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: tasks } = await supabaseClient
        .from('daily_tasks')
        .select('title, theme, status, created_at')
        .eq('supabase_uuid', supabase_uuid)
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tasks && tasks.length > 0) {
        const publishedCount = tasks.filter(t => t.status === 'published').length;
        const themes = [...new Set(tasks.map(t => t.theme).filter(Boolean))];
        historyContext = `
- 过去7天发布内容: ${publishedCount}篇
- 任务总数: ${tasks.length}
- 主要主题: ${themes.slice(0, 3).join('、') || '无'}
- 最近标题: ${tasks[0]?.title || '无'}`;
      } else {
        historyContext = '\n- 历史数据: 暂无发布记录';
      }

      console.log('[BettaFish] Context loaded:', {
        hasProfile: !!userProfile,
        historyItems: tasks?.length || 0
      });

    } catch (dbErr) {
      console.log('[BettaFish] Context fetch error (non-critical):', dbErr.message);
    }
  }

  try {
    // 构建完整的分析查询 (包含地区、AI上下文、爆款拆解)
    const analysisQuery = query || `请分析"${productName}"在${region || '目标市场'}${industry ? '的' + industry + '行业' : ''}的舆情趋势。

【产品信息】
- 产品: ${productName}
- 行业: ${industry || '未指定'}
- 地区: ${region || '全球'}
${strategyContext ? `
【当前策略】${strategyContext}` : ''}
${historyContext ? `
【历史表现】${historyContext}` : ''}

【分析需求】
1. 找出3-5个相关热点话题
2. 🔥 拆解1-2个爆款案例:
   - 标题结构 (如何吸引点击)
   - 开头钩子 (前3秒/首段)
   - 内容框架 (叙事结构)
   - 互动设计 (引导点赞/评论)
   - 可复用模板
3. 分析竞品动态
4. 给出内容创作建议`;

    console.log('[BettaFish] Analysis query:', analysisQuery);
    console.log('[BettaFish] Base URL:', BETTAFISH_URL);
    console.log('[BettaFish] Region:', region);

    // 尝试调用 BettaFish (如果它有 API 端点)
    let bettafishResult = null;
    try {
      const bettafishResponse = await fetchWithTimeoutAndRetry(`${BETTAFISH_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: analysisQuery,
          platforms: platforms || ['xiaohongshu', 'weibo', 'douyin'],
          timeRange: timeRange || 'week',
          region: region
        })
      }, 60000, 1);

      if (bettafishResponse.ok) {
        bettafishResult = await bettafishResponse.json();
        console.log('[BettaFish] API response received');
      }
    } catch (apiErr) {
      console.log('[BettaFish] Direct API not available, using Gradio interface or mock data');
    }

    // 如果 BettaFish API 可用，使用其结果；否则返回引导信息
    if (bettafishResult) {
      res.json({
        success: true,
        source: 'bettafish_api',
        data: bettafishResult
      });
    } else {
      // 返回 BettaFish Gradio UI 链接和使用建议
      res.json({
        success: true,
        source: 'manual',
        message: '请访问 BettaFish 舆情分析系统进行深度分析',
        bettafishUrl: BETTAFISH_URL,
        suggestedQuery: analysisQuery,
        region: region,
        instructions: [
          `1. 访问 ${BETTAFISH_URL}`,
          '2. 在对话框输入查询 (包含爆款拆解需求)',
          '3. 等待多 Agent 分析完成',
          '4. 下载 HTML 报告或 PDF'
        ],
        // 提供基础的趋势模拟数据
        mockTrendData: {
          hotTopics: [
            {
              topic: productName || '相关话题',
              heat: 75,
              trend: 'rising',
              sentiment: 'positive',
              platforms: ['xiaohongshu', 'weibo'],
              region: region || '全球'
            }
          ],
          overallSentiment: {
            positive: 0.6,
            neutral: 0.3,
            negative: 0.1
          },
          // 爆款拆解模板 (待 BettaFish 返回实际数据)
          viralBreakdown: {
            available: false,
            message: '请通过 BettaFish 获取实际爆款案例拆解',
            template: {
              titleStructure: '【痛点】+【解决方案】+【数字/时间】',
              hookDesign: '前3秒抛出问题或惊人事实',
              contentFramework: '问题 → 原因 → 方案 → 效果 → 行动',
              interactionDesign: '结尾提问引导评论'
            }
          },
          contentOpportunities: [
            {
              type: 'trending_topic',
              title: '热点话题机会',
              description: `与${productName || '产品'}相关的讨论正在上升`,
              urgency: 'medium',
              estimatedImpact: 70
            }
          ]
        }
      });
    }

  } catch (error) {
    console.error('[BettaFish] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '舆情分析失败',
      bettafishUrl: process.env.BETTAFISH_URL || 'https://weibo-sentiment-app.zeabur.app'
    });
  }
});

// 🔧 新增：内容效果分析 API - 分析发布内容的表现
app.post('/api/analytics/content-performance', async (req, res) => {
  const { contentIds, supabase_uuid, platform, dateRange } = req.body;

  console.log('[Analytics] Content performance analysis:', {
    contentCount: contentIds?.length || 0,
    platform,
    dateRange
  });

  try {
    // TODO: 从数据库获取内容表现数据
    // 目前返回模拟结构，后续集成 Chrome 插件数据采集

    const mockPerformance = {
      summary: {
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        avgEngagementRate: 0,
        topPerformingContent: [],
        underperformingContent: []
      },
      insights: [
        '暂无足够数据进行分析',
        '请先发布内容并等待数据积累'
      ],
      suggestions: [
        '建议发布更多内容以获得数据洞察',
        '可以使用 BettaFish 分析竞品表现'
      ]
    };

    res.json({
      success: true,
      performance: mockPerformance,
      dataAvailable: false,
      message: '内容效果分析功能已就绪，等待数据积累'
    });

  } catch (error) {
    console.error('[Analytics] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '效果分析失败'
    });
  }
});

// 🔧 新增：策略进化 API - 自动迭代优化策略
app.post('/api/strategy/evolve', async (req, res) => {
  const { supabase_uuid, cycleNumber, forceEvolution } = req.body;

  console.log('[Strategy Evolution] Starting cycle:', {
    supabase_uuid,
    cycleNumber,
    forceEvolution
  });

  try {
    // TODO: 实现策略进化逻辑
    // 1. 收集过去一周的内容表现数据
    // 2. 调用 AI 分析效果
    // 3. 根据分析结果调整账号人设和内容策略
    // 4. 记录进化历史

    const evolutionResult = {
      cycleNumber: cycleNumber || 1,
      status: 'pending',
      message: '策略进化功能已就绪，需要更多数据支持',
      requiredData: [
        '至少 7 天的发布数据',
        '至少 10 篇内容的表现数据',
        '用户互动反馈数据'
      ],
      nextEvolutionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      automationStatus: {
        personaAdjustment: 'pending',
        contentStrategyUpdate: 'pending',
        publishingScheduleOptimization: 'pending'
      }
    };

    res.json({
      success: true,
      evolution: evolutionResult,
      message: '策略进化系统已初始化'
    });

  } catch (error) {
    console.error('[Strategy Evolution] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '策略进化失败'
    });
  }
});

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
        inputs: {}, // 🔧 DIFY需要inputs参数
        query: message,
        user: userIdentifier,
        conversation_id: clientConvId || '', // 空字符串让Dify创建新对话
        response_mode: 'blocking', // 使用阻塞模式获得简单响应
        auto_generate_name: false, // 🔧 可能影响usage统计
        files: [] // 🔧 某些应用可能需要files参数
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

    // 🔍 CRITICAL DEBUG: 详细分析Dify API响应
    console.log('🔍 [DIFY API DEBUG] ===== DETAILED RESPONSE ANALYSIS =====');
    console.log('🔍 [DIFY API DEBUG] Response Status:', difyResponse.status);
    console.log('🔍 [DIFY API DEBUG] Response Headers:', Object.fromEntries(difyResponse.headers.entries()));
    console.log('🔍 [DIFY API DEBUG] Full Response Body:', JSON.stringify(data, null, 2));

    // 分析usage数据结构
    console.log('🔍 [USAGE DEBUG] Usage Analysis:', {
      hasData: !!data,
      hasMetadata: !!data?.metadata,
      hasUsage: !!data?.metadata?.usage,
      hasDirectUsage: !!data?.usage,
      responseKeys: data ? Object.keys(data) : [],
      metadataKeys: data?.metadata ? Object.keys(data.metadata) : [],
      usageKeys: data?.metadata?.usage ? Object.keys(data.metadata.usage) : [],
      usageData: data?.metadata?.usage || data?.usage || 'NO_USAGE_FOUND'
    });

    // 检查token数据的具体值
    if (data?.metadata?.usage) {
      const usage = data.metadata.usage;
      console.log('🔍 [TOKEN DEBUG] Token Analysis:', {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        prompt_price: usage.prompt_price,
        completion_price: usage.completion_price,
        total_price: usage.total_price,
        currency: usage.currency,
        allUsageFields: Object.keys(usage)
      });

      // 检查是否所有值都是0
      const allZero = (
        (!usage.prompt_tokens || usage.prompt_tokens === 0) &&
        (!usage.completion_tokens || usage.completion_tokens === 0) &&
        (!usage.total_tokens || usage.total_tokens === 0) &&
        (!usage.total_price || parseFloat(usage.total_price) === 0)
      );

      if (allZero) {
        console.error('🚨 [CRITICAL] All usage values are ZERO - This is the core problem!');
        console.error('🚨 [DIAGNOSIS] Possible causes:');
        console.error('   1. Dify app configuration: LLM nodes not configured correctly');
        console.error('   2. Dify account: No billing/usage tracking enabled');
        console.error('   3. API permissions: API key lacks usage access');
        console.error('   4. App type: Wrong app type (Agent vs Chatflow vs Workflow)');
        console.error('   5. Cached responses: Dify returning cached results');
      }
    }
    console.log('🔍 [DIFY API DEBUG] ===== END ANALYSIS =====');

    console.log('[Simple Chat] Success:', {
      conversationId: data.conversation_id,
      answerLength: data.answer?.length || 0,
      messageId: data.message_id
    });

    // 🔧 BILLING: 处理积分扣除
    let billingInfo = await handleTokenBilling(data, userId, 'SIMPLE');

    // 🚨 CRITICAL FIX: 如果SIMPLE billing失败，强制执行fallback billing
    if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
      console.error(`🚨 [CRITICAL] Primary billing failed for SIMPLE, executing emergency billing!`);

      // 创建强制billing数据
      const emergencyTokens = Math.max(150, Math.ceil((message?.length || 0) / 3));
      const emergencyData = {
        answer: 'Emergency billing data',
        conversation_id: 'emergency-simple-' + Date.now(),
        message_id: generateUUID(),
        metadata: {
          usage: {
            total_tokens: emergencyTokens,
            prompt_tokens: Math.ceil(emergencyTokens * 0.4),
            completion_tokens: Math.ceil(emergencyTokens * 0.6),
            total_price: emergencyTokens * 0.000002175
          }
        },
        billing_source: 'EMERGENCY_FORCED_BILLING'
      };

      billingInfo = await handleTokenBilling(emergencyData, userId, 'EMERGENCY_SIMPLE', {
        emergencyFallback: true
      });

      console.log(`🔧 [EMERGENCY] Forced SIMPLE billing result:`, billingInfo);
    }

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
    // Call Dify API with enhanced payload to trigger LLM nodes
    const difyPayload = {
      inputs: {}, // 🔧 DIFY需要inputs参数
      query: message,
      user: userIdentifier, // ✅ Required user parameter
      conversation_id: isNewConversation ? '' : conversationId, // Empty string for new conversations
      response_mode: 'blocking',
      auto_generate_name: true, // 🔧 修改为true以可能触发usage统计
      files: [] // 🔧 某些应用可能需要files参数
    };

    console.log(`[Dify API] Calling with payload:`, {
      ...difyPayload,
      query_preview: message?.substring(0, 50) + '...'
    });

    const difyResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyPayload),
    });

    if (!difyResponse.ok) {
      const error = await difyResponse.json();
      console.error('Dify API error:', error);
      return res.status(difyResponse.status).json(error);
    }

    const data = await difyResponse.json();

    // 🔍 Enhanced logging for token analysis
    console.log(`[Token Analysis] Response analysis:`, {
      conversation_id: data.conversation_id,
      has_usage: !!data.metadata?.usage,
      usage_tokens: data.metadata?.usage?.total_tokens || 0,
      usage_price: data.metadata?.usage?.total_price || 0,
      answer_preview: data.answer?.substring(0, 100) + '...',
      response_contains_completeness: data.answer?.includes('COMPLETENESS'),
      node_status: data.metadata?.node_status
    });

    // 🚀 Workflow Enhancement: Auto-trigger LLM nodes if needed
    let finalData = data;

    // Check if we need to trigger LLM processing for workflow completion
    if (data.metadata?.usage?.total_tokens === 0 && data.answer?.includes('COMPLETENESS: 4')) {
      console.log(`[Workflow] Detected completion trigger, attempting to auto-trigger LLM node...`);

      try {
        const llmTriggerPayload = {
          ...difyPayload,
          query: '开始生成痛点', // Trigger phrase for LLM processing
          conversation_id: data.conversation_id || conversationId
        };

        console.log(`[LLM Trigger] Sending trigger request...`);

        const llmResponse = await fetchWithTimeoutAndRetry(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(llmTriggerPayload),
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          console.log(`[LLM Trigger] Success! Tokens: ${llmData.metadata?.usage?.total_tokens || 0}`);

          // Use LLM response if it has actual token usage
          if (llmData.metadata?.usage?.total_tokens > 0) {
            finalData = llmData;
            console.log(`🎉 [LLM Trigger] Successfully triggered LLM processing with ${llmData.metadata.usage.total_tokens} tokens!`);
          }
        }
      } catch (llmError) {
        console.warn(`[LLM Trigger] Failed to auto-trigger:`, llmError.message);
      }
    }

    // 🔧 BILLING: 处理积分扣除
    let billingInfo = await handleTokenBilling(finalData, userIdentifier, 'CHAT');

    // 🚨 CRITICAL FIX: 如果CHAT billing失败，强制执行fallback billing
    if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
      console.error(`🚨 [CRITICAL] Primary billing failed for CHAT, executing emergency billing!`);

      // 创建强制billing数据
      const emergencyTokens = Math.max(160, Math.ceil((message?.length || 0) / 3));
      const emergencyData = {
        answer: 'Emergency billing data',
        conversation_id: 'emergency-chat-' + Date.now(),
        message_id: generateUUID(),
        metadata: {
          usage: {
            total_tokens: emergencyTokens,
            prompt_tokens: Math.ceil(emergencyTokens * 0.4),
            completion_tokens: Math.ceil(emergencyTokens * 0.6),
            total_price: emergencyTokens * 0.000002175
          }
        },
        billing_source: 'EMERGENCY_FORCED_BILLING'
      };

      billingInfo = await handleTokenBilling(emergencyData, userIdentifier, 'EMERGENCY_CHAT', {
        emergencyFallback: true
      });

      console.log(`🔧 [EMERGENCY] Forced CHAT billing result:`, billingInfo);
    }

    // Update conversation state in memory store
    conversationStore.set(finalData.conversation_id || conversationId, {
      ...conversationState,
      conversationId: finalData.conversation_id || conversationId,
      nodeStatus: finalData.metadata?.node_status, // Save node status
    });

    // Return enhanced response
    return res.status(200).json({
      ...finalData,
      conversationId: finalData.conversation_id || conversationId,
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
app.post('/api/dify/chat/mock', async (req, res) => {
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

  // 🔧 BILLING: 处理积分扣除 (Mock endpoint)
  let billingInfo = await handleTokenBilling(mockResponse, userIdentifier, 'MOCK');

  // 🚨 CRITICAL FIX: 如果MOCK billing失败，强制执行fallback billing
  if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
    console.error(`🚨 [CRITICAL] Primary billing failed for MOCK, executing emergency billing!`);

    // 创建强制billing数据
    const emergencyTokens = Math.max(100, Math.ceil((message?.length || 0) / 4));
    const emergencyMockResponse = {
      answer: 'Emergency billing data',
      conversation_id: 'emergency-mock-' + Date.now(),
      message_id: generateUUID(),
      metadata: {
        usage: {
          total_tokens: emergencyTokens,
          prompt_tokens: Math.ceil(emergencyTokens * 0.3),
          completion_tokens: Math.ceil(emergencyTokens * 0.7),
          total_price: emergencyTokens * 0.000002175
        }
      },
      billing_source: 'EMERGENCY_FORCED_BILLING'
    };

    billingInfo = await handleTokenBilling(emergencyMockResponse, userIdentifier, 'EMERGENCY_MOCK', {
      emergencyFallback: true
    });

    console.log(`🔧 [EMERGENCY] Forced MOCK billing result:`, billingInfo);
  }

  // Store in memory (simulate the real endpoint behavior)
  conversationStore.set(conversationId, {
    conversationId,
    userId: userIdentifier,
    nodeStatus: 'completed'
  });

  console.log(`✅ Mock response generated for user ${userIdentifier}, conversation ${conversationId}`);

  res.json(mockResponse);
});

// Context status endpoint - 让前端可以检查对话的token状态
app.get('/api/dify/:conversationId/context-status', async (req, res) => {
  const { conversationId } = req.params;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.json({
        error: 'Database not configured',
        hasContext: false
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 获取对话历史
    const { data: messages, error } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch conversation history' });
    }

    if (!messages || messages.length === 0) {
      return res.json({
        hasContext: false,
        totalTokens: 0,
        messageCount: 0,
        riskLevel: 'none'
      });
    }

    // 计算总token数
    let totalTokens = 0;
    messages.forEach(msg => {
      totalTokens += estimateTokens(msg.content || '');
    });

    const DIFY_TOKEN_LIMIT = 8192;
    const riskLevel = totalTokens > DIFY_TOKEN_LIMIT * 0.9 ? 'high' :
      totalTokens > DIFY_TOKEN_LIMIT * 0.7 ? 'medium' : 'low';

    let suggestion = null;
    if (riskLevel === 'high') {
      suggestion = '建议开始新对话以避免输出被截断';
    } else if (riskLevel === 'medium') {
      suggestion = '即将达到上下文限制，复杂回答可能被截断';
    }

    res.json({
      hasContext: true,
      totalTokens,
      messageCount: messages.length,
      riskLevel,
      suggestion,
      tokenLimit: DIFY_TOKEN_LIMIT,
      utilizationPercent: Math.round((totalTokens / DIFY_TOKEN_LIMIT) * 100)
    });

  } catch (error) {
    console.error('Context status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    // 🔥 FIX: Check both req.body.stream and req.query.stream for streaming mode
    const bodyStream = req.body.stream;
    const queryStream = req.query.stream === 'true';
    const shouldStream = bodyStream || queryStream;

    const { message, query, user, conversation_id } = req.body;
    const actualMessage = message || query; // Support both message and query fields

    console.log(`📊 Streaming mode: body=${bodyStream}, query=${queryStream}, final=${shouldStream}`);
    console.log('🔍 Full request body:', JSON.stringify(req.body, null, 2));

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

    // 🔥 关键修复：当前端明确传递null时，表示要开始全新对话，不要查找数据库
    let conversationId = null;
    let difyConversationId = null;
    let isExplicitNewConversation = conversation_id === null;

    if (isExplicitNewConversation) {
      // 前端明确要求新对话，生成新的内部conversation ID但不查找数据库
      conversationId = generateUUID();
      console.log(`🆕 前端要求新对话 - 生成全新conversation ID: ${conversationId}，不查找数据库`);
    } else if (conversation_id && isValidUUID(conversation_id)) {
      // 前端传递了有效的conversation_id，使用它并查找对应的difyConversationId
      conversationId = conversation_id;
      console.log(`🔄 继续现有对话: ${conversationId}`);
    } else {
      // 前端传递了无效的conversation_id，生成新的
      conversationId = generateUUID();
      console.log(`🔧 无效conversation_id，生成新的: ${conversationId}`);
    }

    // 只有在不是明确新对话时才查找数据库
    if (!isExplicitNewConversation && conversationId && supabase) {
      console.log(`🔍 Looking up conversation in database: ${conversationId}`);
      try {
        const { data: conversationRow, error } = await supabase
          .from('conversations')
          .select('dify_conversation_id')
          .eq('id', conversationId)
          .maybeSingle(); // Use maybeSingle to avoid errors when not found

        if (error) {
          console.log(`⚠️ Database lookup error: ${error.message}`);
        } else if (conversationRow?.dify_conversation_id) {
          difyConversationId = conversationRow.dify_conversation_id;
          console.log(`✅ Found existing DIFY conversation: ${difyConversationId}`);
        } else {
          console.log(`📝 No existing conversation found for: ${conversationId}`);
        }
      } catch (dbError) {
        console.error(`❌ Database lookup failed: ${dbError.message}`);
      }
    }

    // 🔧 DIFY API 正确用法：为新对话确保conversation variables正确初始化
    // 检查是否为新对话，如果是则初始化conversation variables
    const isNewConversation = isExplicitNewConversation || !difyConversationId;

    // ✅ 完全信任DIFY ChatFlow的自然流程管理
    // 移除人为计算conversation_info_completeness，让Dify根据工作流配置自然管理状态

    let requestBody = {
      inputs: {}, // ✅ 完全信任DIFY ChatFlow的自然流程管理，不干预工作流变量
      query: actualMessage, // 🔧 用户输入使用query参数
      response_mode: shouldStream ? 'streaming' : 'blocking',
      user: getValidUserId(user)
    };

    // 🔧 关键修复：对于新对话，确保conversation_id为空字符串让DIFY创建新对话
    // 对于已有对话，传递正确的conversation_id以保持对话连续性
    if (isNewConversation) {
      // 新对话：不传conversation_id，让DIFY自动创建并初始化所有conversation variables
      console.log('🆕 Starting new conversation - letting DIFY initialize conversation variables');
    } else {
      // 已有对话：传递conversation_id以保持对话状态
      requestBody.conversation_id = difyConversationId;
      console.log('🔄 Continuing existing conversation:', difyConversationId);
    }

    // 🔧 调试：记录发送给DIFY的完整请求
    console.log('📤 [DIFY API] Sending request to chat-messages:', {
      query: actualMessage.substring(0, 100) + '...',
      inputs: requestBody.inputs, // 🔧 显示inputs内容
      response_mode: requestBody.response_mode,
      user: requestBody.user,
      conversation_id: difyConversationId || 'NEW_CONVERSATION',
      // 移除人为计算的completeness，完全信任Dify工作流
      timestamp: new Date().toISOString()
    });

    // ✅ 完全信任DIFY ChatFlow的自然流程管理

    // Detect context overflow risk before processing
    let overflowRisk = await detectContextOverflowRisk(conversationId, actualMessage);
    if (overflowRisk && overflowRisk.isAtRisk) {
      console.log(`⚠️ ${overflowRisk.suggestion} (${overflowRisk.currentTokens}/${overflowRisk.limit} tokens)`);
    }

    // Context length management - Check and manage conversation history before API call
    let contextManagementResult = null;
    if (supabase && actualMessage) {
      contextManagementResult = await manageConversationContext(conversationId, actualMessage);

      if (contextManagementResult && contextManagementResult.truncated) {
        console.log(`📊 Context management applied: ${contextManagementResult.truncatedCount} older messages truncated`);
      }
    }

    // 🚨 EMERGENCY FALLBACK: If context management failed and we're at high risk, force new conversation
    if (!contextManagementResult && overflowRisk && overflowRisk.isAtRisk && overflowRisk.currentTokens > 8000) {
      console.log(`🚨 EMERGENCY: Context management failed and tokens (${overflowRisk.currentTokens}) exceed safe limit`);
      console.log('🔄 Forcing new conversation to prevent API failure');
      console.log(`⚠️ [BILLING-WARNING] Emergency fallback triggered - ensuring billing tracking continues`);

      // Clear the conversation_id to force a new conversation
      delete requestBody.conversation_id;
      difyConversationId = null;

      // Generate a new conversation ID for our records
      conversationId = generateUUID();
      console.log(`🆕 Emergency new conversation ID: ${conversationId}`);

      // 🔧 标记这是emergency fallback，用于billing追踪
      requestBody.emergency_fallback = true;
    }

    // 🔧 关键修复：确保新对话正确启动chatflow，让DIFY处理opening_statement
    // 不要在服务器端预先判断和返回开场白，而是让DIFY按照chatflow自然流程处理
    console.log('📋 Preparing request for DIFY chatflow processing...');

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
          console.log('❌ Conversation not found in DIFY - attempting recovery');
          console.log('🔄 Creating new conversation to replace expired one');

          // Remove conversation_id and retry as new conversation
          delete requestBody.conversation_id;
          console.log('🆕 Retrying without conversation_id to create fresh conversation');

          // Retry the request without conversation_id
          const retryResponse = await fetchWithTimeoutAndRetry(
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

          if (!retryResponse.ok) {
            const retryError = await retryResponse.json();
            console.error('❌ Retry also failed:', retryError);
            throw new Error(`Dify API failed even after retry: ${retryError.message}`);
          }

          response = retryResponse; // Use the retry response
          console.log('✅ Successfully recovered with new conversation');
        } else {
          throw new Error(`Dify API error: ${errorData.message || 'Unknown error'}`);
        }
      }

      // 🎯 关键改进：从响应头中提取元数据和token统计（通用端点）
      const extractMetadataFromHeaders = (response) => {
        try {
          // 获取所有响应头（用于调试）
          const allHeaders = {};
          response.headers.forEach((value, key) => {
            allHeaders[key.toLowerCase()] = value;
          });

          console.log('[Server Generic] 🔍 Dify API 响应头:', allHeaders);

          // 提取响应头中的元数据
          const inputTokensHeader = response.headers.get('x-usage-input-tokens');
          const outputTokensHeader = response.headers.get('x-usage-output-tokens');
          const modelHeader = response.headers.get('x-dify-model');
          const requestIdHeader = response.headers.get('x-dify-request-id');

          console.log('[Server Generic] 响应头元数据检查:', {
            'x-usage-input-tokens': inputTokensHeader,
            'x-usage-output-tokens': outputTokensHeader,
            'x-dify-model': modelHeader,
            'x-dify-request-id': requestIdHeader,
            hasTokenStats: !!(inputTokensHeader && outputTokensHeader),
            hasModelInfo: !!modelHeader
          });

          const metadata = {
            headers: allHeaders,
            extractedFromHeaders: true,
            timestamp: new Date().toISOString()
          };

          // 只有在响应头存在token信息时才添加
          if (inputTokensHeader && outputTokensHeader) {
            metadata.headerTokenStats = {
              prompt_tokens: parseInt(inputTokensHeader, 10),
              completion_tokens: parseInt(outputTokensHeader, 10),
              total_tokens: parseInt(inputTokensHeader, 10) + parseInt(outputTokensHeader, 10),
              source: 'response_headers'
            };
            console.log('[Server Generic] ✅ 从响应头提取到token统计:', metadata.headerTokenStats);
          }

          if (modelHeader) {
            metadata.modelFromHeader = modelHeader;
            console.log('[Server Generic] ✅ 从响应头提取到模型信息:', modelHeader);
          }

          if (requestIdHeader) {
            metadata.requestId = requestIdHeader;
          }

          return metadata;
        } catch (error) {
          console.error('[Server Generic] ❌ 提取响应头元数据时出错:', error);
          return null;
        }
      };

      // 提取响应头元数据
      const headerMetadata = extractMetadataFromHeaders(response);

      // Handle streaming vs blocking response
      if (shouldStream && requestBody.response_mode === 'streaming') {
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
        let bodyUsageData = null; // 存储响应体中的usage信息
        let streamEnded = false;

        // 🔧 修复：在流处理作用域中引用响应头元数据
        const responseHeaderMetadata = headerMetadata;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('[Server] 📡 Stream读取完成 - checking for pending usage data');
              break;
            }

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
                  streamEnded = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);

                  // Store final data for database saving
                  if (parsed.conversation_id) {
                    finalData = parsed;
                  }

                  // 🎯 提取响应体中的usage信息（包含价格）
                  if (parsed.event === 'message_end' && parsed.metadata?.usage) {
                    bodyUsageData = parsed.metadata.usage;
                    console.log('[Server] 📊 从响应体提取usage信息 (含价格): token统计和价格数据已获取');
                  }

                  // Forward the streaming data to client
                  res.write(`data: ${data}\n\n`);

                  console.log('📤 Forwarded streaming data:', {
                    event: parsed.event,
                    hasAnswer: !!parsed.answer,
                    conversationId: parsed.conversation_id,
                    hasUsage: !!parsed.metadata?.usage
                  });

                } catch (parseError) {
                  console.warn('⚠️ Failed to parse streaming data:', parseError);
                  // Forward as-is if we can't parse
                  res.write(`data: ${data}\n\n`);
                }
              }
            }

            if (streamEnded) break;
          }

          // 🎯 结合响应头token统计和响应体价格信息发送混合数据
          // 修复：无论是否收到[DONE]标记，只要有usage数据就发送增强信息
          if ((streamEnded || bodyUsageData) && (responseHeaderMetadata?.headerTokenStats || bodyUsageData)) {
            console.log('[Server] 📊 结合响应头和响应体数据准备发送混合token使用信息');

            // 创建混合的usage数据
            let combinedUsage = null;

            if (responseHeaderMetadata?.headerTokenStats && bodyUsageData) {
              // 最佳情况：同时有响应头的准确token统计和响应体的价格信息
              combinedUsage = {
                // 使用响应头的精确token数量
                prompt_tokens: responseHeaderMetadata.headerTokenStats.prompt_tokens,
                completion_tokens: responseHeaderMetadata.headerTokenStats.completion_tokens,
                total_tokens: responseHeaderMetadata.headerTokenStats.total_tokens,
                // 使用响应体的价格信息
                prompt_price: bodyUsageData.prompt_price,
                completion_price: bodyUsageData.completion_price,
                total_price: bodyUsageData.total_price,
                currency: bodyUsageData.currency,
                // 标记数据来源
                dataSource: 'combined_headers_and_body',
                headerTokens: responseHeaderMetadata.headerTokenStats,
                bodyPricing: bodyUsageData,
                model: responseHeaderMetadata?.modelFromHeader || bodyUsageData.model,
                requestId: responseHeaderMetadata?.requestId
              };
              console.log('[Server] ✅ 创建混合usage数据 (响应头token + 响应体价格)');
            } else if (responseHeaderMetadata?.headerTokenStats) {
              // 只有响应头数据的情况
              combinedUsage = {
                ...responseHeaderMetadata.headerTokenStats,
                dataSource: 'headers_only',
                model: responseHeaderMetadata?.modelFromHeader,
                requestId: responseHeaderMetadata?.requestId,
                note: '仅有响应头token统计，无价格信息'
              };
              console.log('[Server] ⚠️ 仅使用响应头token统计 (无价格信息)');
            } else if (bodyUsageData) {
              // 只有响应体数据的情况
              combinedUsage = {
                ...bodyUsageData,
                dataSource: 'body_only',
                note: '仅有响应体usage信息'
              };
              console.log('[Server] ⚠️ 仅使用响应体usage信息');
            }

            if (combinedUsage) {
              // 创建一个特殊的事件来传递混合的token使用信息
              const enhancedTokenUsageEvent = {
                event: 'enhanced_token_usage',
                data: {
                  usage: combinedUsage,
                  source: 'dify_headers_and_body_combined',
                  note: '结合了响应头准确token统计和响应体价格信息的混合数据'
                },
                conversation_id: finalData?.conversation_id,
                timestamp: new Date().toISOString()
              };

              res.write(`data: ${JSON.stringify(enhancedTokenUsageEvent)}\n\n`);
              console.log('[Server] ✅ 混合token使用信息已发送到前端');
            } else {
              console.log('[Server] ⚠️ 没有可用的token使用数据发送到前端:', {
                hasHeaderStats: !!responseHeaderMetadata?.headerTokenStats,
                hasBodyUsage: !!bodyUsageData,
                streamEnded,
                responseHeaderMetadata: responseHeaderMetadata ? 'present' : 'missing',
                bodyUsageKeys: bodyUsageData ? Object.keys(bodyUsageData) : 'none'
              });
            }
          }

          // 🚨 CRITICAL FIX: 强制billing检查 - 确保每个交互都被计费 (移到[DONE]之前)
          if (!finalData) {
            console.error(`🚨 [BILLING-CRITICAL] No finalData found for streaming request! This would skip billing!`);
            console.error(`🚨 [BILLING-CRITICAL] Request info:`, {
              user: getValidUserId(user),
              endpoint: 'WORKFLOW_STREAM',
              hasBodyUsageData: !!bodyUsageData,
              streamEnded,
              timestamp: new Date().toISOString()
            });

            // 创建强制的fallback finalData以确保billing
            const estimatedTokens = Math.max(50, Math.ceil((actualMessage?.length || 0) / 4));
            finalData = {
              answer: 'Stream completed without proper finalData',
              conversation_id: 'fallback-' + Date.now(),
              message_id: generateUUID(),
              metadata: {
                usage: bodyUsageData || {
                  total_tokens: estimatedTokens,
                  prompt_tokens: Math.ceil(estimatedTokens * 0.3),
                  completion_tokens: Math.ceil(estimatedTokens * 0.7),
                  total_price: estimatedTokens * 0.000002175
                }
              },
              billing_source: 'EMERGENCY_FALLBACK'
            };
            console.log(`🔧 [EMERGENCY-BILLING] Created fallback finalData with ${estimatedTokens} tokens`);
          }

          // Save to database if we have final data
          if (finalData && supabase) {
            // 🔧 BILLING: 处理积分扣除
            console.log('🔍 [DEBUG] finalData structure for billing:', {
              hasFinalData: !!finalData,
              hasMetadata: !!(finalData?.metadata),
              hasUsage: !!(finalData?.metadata?.usage),
              hasTokens: !!(finalData?.metadata?.usage?.total_tokens),
              tokensValue: finalData?.metadata?.usage?.total_tokens,
              billingSource: finalData?.billing_source || 'NORMAL'
            });
            let billingInfo = await handleTokenBilling(finalData, user, 'WORKFLOW_STREAM', {
              emergencyFallback: requestBody?.emergency_fallback || false
            });

            // 🚨 CRITICAL FIX: 如果billing失败，强制执行fallback billing
            if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
              console.error(`🚨 [CRITICAL] Primary billing failed for WORKFLOW_STREAM, executing emergency billing!`);
              console.error(`🚨 [CRITICAL] Request context:`, {
                isNewConversation: requestBody?.conversation_id ? false : true,
                hasConversationId: !!requestBody?.conversation_id,
                emergencyFallback: requestBody?.emergency_fallback || false,
                endpoint: 'WORKFLOW_STREAM'
              });

              // 创建强制billing数据
              const emergencyTokens = Math.max(200, Math.ceil((actualMessage?.length || 0) / 3)); // 保守估算
              const emergencyFinalData = {
                answer: 'Emergency billing data',
                conversation_id: 'emergency-' + Date.now(),
                message_id: generateUUID(),
                metadata: {
                  usage: {
                    total_tokens: emergencyTokens,
                    prompt_tokens: Math.ceil(emergencyTokens * 0.4),
                    completion_tokens: Math.ceil(emergencyTokens * 0.6),
                    total_price: emergencyTokens * 0.000002175
                  }
                },
                billing_source: 'EMERGENCY_FORCED_BILLING'
              };

              billingInfo = await handleTokenBilling(emergencyFinalData, user, 'EMERGENCY_STREAM', {
                emergencyFallback: true
              });

              console.log(`🔧 [EMERGENCY] Forced billing result:`, billingInfo);
            }

            // 🔧 关键修复：发送余额更新信息给前端
            if (billingInfo && billingInfo.newBalance !== null && billingInfo.success) {
              console.log(`🔥 [STREAM] Sending balance update to frontend: ${billingInfo.newBalance}`);
              res.write(`data: ${JSON.stringify({
                event: 'balance_updated',
                data: {
                  newBalance: billingInfo.newBalance,
                  pointsDeducted: billingInfo.points,
                  tokens: billingInfo.tokens,
                  cost: billingInfo.cost
                }
              })}\n\n`);
            }

            const effectiveConversationId = finalData.conversation_id || conversationId;
            try {
              const conversationCreated = await ensureConversationExists(supabase, effectiveConversationId, finalData.conversation_id, getValidUserId(user));

              if (conversationCreated !== false) {
                await saveMessages(supabase, effectiveConversationId, actualMessage, finalData);
                console.log('✅ Saved streaming conversation to database');
              }
            } catch (dbError) {
              console.error('⚠️ Database operation failed in streaming response:', dbError);
              // Don't let database errors break the stream
            }
          }

          // End the stream with [DONE] signal (移到正确位置)
          res.write('data: [DONE]\n\n');
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

        // 🔧 调试：记录DIFY的完整响应
        console.log('📥 [DIFY API] Received blocking response:', {
          conversation_id: data.conversation_id,
          message_id: data.message_id,
          answer_preview: data.answer?.substring(0, 200) + '...',
          mode: data.mode,
          hasMetadata: !!data.metadata,
          hasUsage: !!data.metadata?.usage,
          timestamp: new Date().toISOString()
        });

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
      try {
        // Use Dify's conversation_id as the authoritative source
        const effectiveConversationId = data.conversation_id || conversationId;

        // First ensure conversation record exists with Dify's ID as primary
        const conversationCreated = await ensureConversationExists(supabase, effectiveConversationId, data.conversation_id, getValidUserId(user));

        // Then save messages using Dify's conversation_id only if conversation was successfully created/exists
        if (conversationCreated !== false) {
          // Add context truncation note if context was managed
          if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
            data.answer = contextManagementResult.truncationNote + '\n\n' + (data.answer || '');
          }

          await saveMessages(supabase, effectiveConversationId, actualMessage, data);
        } else {
          console.error('⚠️ Skipping message save due to conversation creation failure');
        }
      } catch (dbError) {
        console.error('⚠️ Database operation failed after successful Dify API response:', dbError);
        // Don't let database errors break the successful Dify response
        // Just log the error and continue
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

    // 🔧 调试：记录发送给前端的完整响应数据
    console.log('📤 [SERVER → FRONTEND] Sending response to frontend:', {
      hasAnswer: !!responseData.answer,
      answerLength: responseData.answer?.length || 0,
      conversation_id: responseData.conversation_id,
      message_id: responseData.message_id,
      hasMetadata: !!responseData.metadata,
      hasUsage: !!responseData.metadata?.usage,
      usageDetails: responseData.metadata?.usage ? {
        prompt_tokens: responseData.metadata.usage.prompt_tokens,
        completion_tokens: responseData.metadata.usage.completion_tokens,
        total_tokens: responseData.metadata.usage.total_tokens,
        total_price: responseData.metadata.usage.total_price,
        currency: responseData.metadata.usage.currency
      } : 'NO_USAGE_DATA',
      metadataKeys: Object.keys(responseData.metadata || {}),
      timestamp: new Date().toISOString()
    });

    // 🔧 BILLING: 处理积分扣除 (使用统一计费函数)
    console.log('🔍 [DEBUG] responseData structure for billing:', {
      hasResponseData: !!responseData,
      hasMetadata: !!(responseData?.metadata),
      hasUsage: !!(responseData?.metadata?.usage),
      hasTokens: !!(responseData?.metadata?.usage?.total_tokens),
      tokensValue: responseData?.metadata?.usage?.total_tokens
    });
    let billingInfo = await handleTokenBilling(responseData, user, 'DIFY_GENERIC');

    // 🚨 CRITICAL FIX: 如果blocking模式billing失败，强制执行fallback billing
    if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
      console.error(`🚨 [CRITICAL] Primary billing failed for DIFY_GENERIC (blocking), executing emergency billing!`);
      console.error(`🚨 [CRITICAL] Request context:`, {
        isNewConversation: requestBody?.conversation_id ? false : true,
        hasConversationId: !!requestBody?.conversation_id,
        emergencyFallback: requestBody?.emergency_fallback || false,
        endpoint: 'DIFY_GENERIC_BLOCKING'
      });

      // 创建强制billing数据
      const emergencyTokens = Math.max(200, Math.ceil((actualMessage?.length || 0) / 3)); // 保守估算
      const emergencyResponseData = {
        answer: 'Emergency billing data',
        conversation_id: 'emergency-' + Date.now(),
        message_id: generateUUID(),
        metadata: {
          usage: {
            total_tokens: emergencyTokens,
            prompt_tokens: Math.ceil(emergencyTokens * 0.4),
            completion_tokens: Math.ceil(emergencyTokens * 0.6),
            total_price: emergencyTokens * 0.000002175
          }
        },
        billing_source: 'EMERGENCY_FORCED_BILLING'
      };

      billingInfo = await handleTokenBilling(emergencyResponseData, user, 'EMERGENCY_BLOCKING', {
        emergencyFallback: true
      });

      console.log(`🔧 [EMERGENCY] Forced blocking billing result:`, billingInfo);
    }

    // 🔧 关键修复：blocking模式也需要在响应中包含余额更新信息
    if (billingInfo && billingInfo.newBalance !== null && billingInfo.success) {
      console.log(`🔥 [BLOCKING] Adding balance update to response: ${billingInfo.newBalance}`);
      responseData.billing_info = {
        newBalance: billingInfo.newBalance,
        pointsDeducted: billingInfo.points,
        tokens: billingInfo.tokens,
        cost: billingInfo.cost
      };
    }

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
    const { message, query, user, conversation_id, stream = true } = req.body;
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

    // 🔧 CRITICAL FIX: Separate internal conversation_id from DIFY conversation_id
    let conversationId = conversation_id && isValidUUID(conversation_id) ? conversation_id : generateUUID();
    let difyConversationId = null; // Will be retrieved from database

    // Log UUID generation for debugging
    if (conversation_id && !isValidUUID(conversation_id)) {
      console.log(`🔧 Generated new UUID for invalid conversation ID: ${conversation_id} -> ${conversationId}`);
    } else if (!conversation_id) {
      console.log(`🆕 Generated new conversation UUID: ${conversationId}`);
    }

    // If we have a conversation_id, check if it exists in our database  
    if (conversationId && supabase) {
      console.log(`🔍 Looking up conversation in database: ${conversationId}`);
      try {
        const { data: conversationRow, error } = await supabase
          .from('conversations')
          .select('dify_conversation_id')
          .eq('id', conversationId)
          .maybeSingle(); // Use maybeSingle to avoid errors when not found

        if (error) {
          console.log(`⚠️ Database lookup error: ${error.message}`);
        } else if (conversationRow?.dify_conversation_id) {
          difyConversationId = conversationRow.dify_conversation_id;
          console.log(`✅ Found existing DIFY conversation: ${difyConversationId}`);
        } else {
          console.log(`📝 No existing conversation found for: ${conversationId}`);
        }
      } catch (dbError) {
        console.error(`❌ Database lookup failed: ${dbError.message}`);
      }
    }

    // 🔧 DIFY API 正确用法：Workflow端点也应使用query参数，不是inputs
    // conversation_variables由DIFY内部管理，不应通过inputs传递

    const requestBody = {
      inputs: {}, // 🔧 根据DIFY API文档：空对象，只包含App定义的变量
      query: actualMessage, // 🔧 用户输入使用query参数
      response_mode: stream ? 'streaming' : 'blocking',
      user: getValidUserId(user)
    };

    // 🔧 调试：记录发送给DIFY workflow的完整请求
    console.log('📤 [DIFY WORKFLOW] Sending request:', {
      query: actualMessage.substring(0, 100) + '...',
      // inputs field removed to match DIFY platform behavior
      response_mode: requestBody.response_mode,
      user: requestBody.user,
      conversation_id: difyConversationId || 'NEW_CONVERSATION',
      timestamp: new Date().toISOString()
    });

    // ✅ 完全信任DIFY ChatFlow的自然流程管理

    // Context length management - Check and manage conversation history before API call
    let contextManagementResult = null;
    if (supabase && actualMessage) {
      contextManagementResult = await manageConversationContext(conversationId, actualMessage);

      if (contextManagementResult && contextManagementResult.truncated) {
        console.log(`📊 Workflow context management applied: ${contextManagementResult.truncatedCount} older messages truncated`);
      }
    }

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
                      try {
                        // Ensure conversation exists first
                        await ensureConversationExists(supabase, conversationId, finalData.conversation_id, getValidUserId(user));

                        // Add context truncation note if context was managed
                        if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
                          finalData.answer = contextManagementResult.truncationNote + '\n\n' + (finalData.answer || '');
                        }

                        // Then save messages
                        await saveMessages(supabase, conversationId, actualMessage, finalData);
                      } catch (dbError) {
                        console.error('⚠️ Database operation failed in stream [DONE] handler:', dbError);
                        // Don't let database errors break the stream
                      }
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
                      console.log(`🔍 [DEBUG] Creating finalData from ${parsed.event} event with metadata:`, {
                        hasMetadata: !!parsed.metadata,
                        hasUsage: !!(parsed.metadata?.usage),
                        metadataKeys: parsed.metadata ? Object.keys(parsed.metadata) : []
                      });
                      finalData = {
                        answer: fullAnswer || parsed.answer || 'Workflow completed',
                        conversation_id: parsed.conversation_id,
                        message_id: parsed.message_id,
                        metadata: parsed.metadata
                      };

                      // 🔥 CRITICAL FIX: Extract usage information from workflow_finished event
                      if (parsed.event === 'workflow_finished' && parsed.data) {
                        console.log('💰 [STREAMING] Processing workflow_finished event for usage data...');
                        console.log('📊 [STREAMING] Raw workflow_finished data:', JSON.stringify(parsed.data));

                        // Try multiple possible locations for usage data
                        let usageData = null;
                        if (parsed.data.metadata && parsed.data.metadata.usage) {
                          usageData = parsed.data.metadata.usage;
                          console.log('💰 [STREAMING] Found usage in data.metadata.usage:', JSON.stringify(usageData));
                        } else if (parsed.data.usage) {
                          usageData = parsed.data.usage;
                          console.log('💰 [STREAMING] Found usage in data.usage:', JSON.stringify(usageData));
                        } else if (parsed.usage) {
                          usageData = parsed.usage;
                          console.log('💰 [STREAMING] Found usage in root level:', JSON.stringify(usageData));
                        }

                        if (usageData) {
                          finalData.metadata = {
                            ...finalData.metadata,
                            usage: usageData,
                            timestamp: new Date().toISOString()
                          };
                        } else {
                          console.log('⚠️ [STREAMING] No usage data found in workflow_finished event');
                        }
                      }

                      // Also check message_end events for usage data
                      if (parsed.event === 'message_end' && parsed.metadata && parsed.metadata.usage) {
                        console.log('💰 [STREAMING] Found usage data in message_end event:', JSON.stringify(parsed.metadata.usage));
                        finalData.metadata = {
                          ...finalData.metadata,
                          usage: parsed.metadata.usage
                        };
                      }
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

          // 🔧 BILLING: 处理积分扣除
          let billingInfo = await handleTokenBilling(data, user, 'WORKFLOW');

          // 🚨 CRITICAL FIX: 如果WORKFLOW billing失败，强制执行fallback billing
          if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
            console.error(`🚨 [CRITICAL] Primary billing failed for WORKFLOW, executing emergency billing!`);

            // 创建强制billing数据
            const emergencyTokens = Math.max(220, Math.ceil((query?.length || 0) / 3));
            const emergencyData = {
              answer: 'Emergency billing data',
              conversation_id: 'emergency-workflow-' + Date.now(),
              message_id: generateUUID(),
              metadata: {
                usage: {
                  total_tokens: emergencyTokens,
                  prompt_tokens: Math.ceil(emergencyTokens * 0.4),
                  completion_tokens: Math.ceil(emergencyTokens * 0.6),
                  total_price: emergencyTokens * 0.000002175
                }
              },
              billing_source: 'EMERGENCY_FORCED_BILLING'
            };

            billingInfo = await handleTokenBilling(emergencyData, user, 'EMERGENCY_WORKFLOW', {
              emergencyFallback: true
            });

            console.log(`🔧 [EMERGENCY] Forced WORKFLOW billing result:`, billingInfo);
          }

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
          try {
            // First ensure conversation record exists
            await ensureConversationExists(supabase, conversationId, data.conversation_id, getValidUserId(user));

            // Add context truncation note if context was managed
            if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
              data.answer = contextManagementResult.truncationNote + '\n\n' + (data.answer || data.data?.outputs?.answer || 'Workflow completed');
            }

            // Then save messages
            await saveMessages(supabase, conversationId, actualMessage, data);
          } catch (dbError) {
            console.error('⚠️ Database operation failed after successful Dify Workflow API response:', dbError);
            // Don't let database errors break the successful Dify response
          }
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

/* 🗑️ REMOVED: Pain point regenerate endpoint - feature disabled
app.post('/api/dify/:conversationId/regenerate-painpoints', async (req, res) => {
  console.log('🔄 [FIXED] PAINPOINT REGENERATE - 保持WorkFlow质量:', req.params.conversationId);
  
  try {
    const { conversationId } = req.params;
    const { productInfo, userId } = req.body;
    
    if (!DIFY_API_URL || !DIFY_API_KEY) {
      return res.status(500).json({ error: 'Dify API not configured' });
    }
    
    // 🎯 终极方案：新conversation保证WorkFlow质量 + 快速信息收集 + 自动痛点生成
    console.log('🎯 [ULTIMATE] Creating clean conversation with fast info collection for WorkFlow quality');
    
    // 从产品信息中提取关键信息，快速模拟信息收集过程
    const productInfoLines = productInfo.split('.');
    const simulatedInfoCollection = productInfoLines.slice(0, 4).join('. ') || productInfo;
    
    // 使用特殊的快速收集信号，直接触发痛点生成阶段
    const fastCollectionSignal = `产品信息：${simulatedInfoCollection}。请直接开始痛点分析。`;
    
    // 🔧 新conversation + 快速信息收集，确保WorkFlow质量和LLM0执行
    const regenerateRequestBody = {
      inputs: {}, // 空inputs让Dify从头开始信息收集
      query: fastCollectionSignal,
      response_mode: 'streaming',
      // 不传conversation_id，创建全新conversation确保干净的WorkFlow执行
      user: `fast-collect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    console.log('📤 [ULTIMATE] Fast info collection for clean WorkFlow execution:', fastCollectionSignal.substring(0, 80) + '...');
    
    // 设置SSE流式响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    const response = await fetchWithTimeoutAndRetry(
      `${DIFY_API_URL}/chat-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(regenerateRequestBody)
      },
      30000,
      1
    );
    
    // 转发流式响应 - 创建新conversation会生成新conversation_id，但不更新主对话ID
    if (response.body) {
      const reader = response.body.getReader();
      let newDifyConversationId = null;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // 检测新conversation_id但不更新主对话（保持workflow路由正确性）
          const chunk = new TextDecoder().decode(value);
          if (chunk.includes('conversation_id') && !newDifyConversationId) {
            const match = chunk.match(/"conversation_id":\s*"([^"]+)"/);
            if (match) {
              newDifyConversationId = match[1];
              console.log('🔄 New regenerate conversation created:', newDifyConversationId);
              console.log('📌 Keeping original conversation ID for main workflow routing');
            }
          }
          
          // 直接转发数据（Dify已经是正确的SSE格式）
          res.write(value);
        }
        
        console.log('✅ Pain point regeneration completed with fresh conversation');
        res.end();
      } catch (streamError) {
        console.error('Stream error:', streamError);
        res.end();
      }
    } else {
      res.end();
    }
    
  } catch (error) {
    console.error('Painpoint regenerate error:', error);
    res.status(500).json({ error: 'Failed to regenerate pain points', details: error.message });
  }
});
*/

// 🎯 开始生成痛点专用endpoint - 确保进入LLM0而非LLM3
app.post('/api/dify/:conversationId/start-painpoints', async (req, res) => {
  console.log('🎯 START PAINPOINTS ENDPOINT CALLED:', req.params.conversationId);

  try {
    const { conversationId } = req.params;
    const { productInfo, userId } = req.body;

    console.log('🔍 [DEBUG] Received productInfo:', productInfo);
    console.log('🔍 [DEBUG] userId:', userId);

    if (!DIFY_API_URL || !DIFY_API_KEY) {
      return res.status(500).json({ error: 'Dify API not configured' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. 清除当前conversation的dify状态，确保干净开始
    const { data: conversationRow } = await supabase
      .from('conversations')
      .select('dify_conversation_id')
      .eq('id', conversationId)
      .maybeSingle();

    const difyConversationId = conversationRow?.dify_conversation_id;

    // 2. 如果存在dify conversation，删除它以确保干净状态
    if (difyConversationId) {
      console.log('🗑️ Deleting contaminated Dify conversation:', difyConversationId);

      try {
        await fetchWithTimeoutAndRetry(
          `${DIFY_API_URL}/conversations/${difyConversationId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          },
          15000,
          2
        );
        console.log('✅ Contaminated conversation deleted');
      } catch (deleteError) {
        console.log('⚠️ Delete conversation failed:', deleteError.message);
      }

      // 清除数据库记录
      await supabase
        .from('conversations')
        .update({ dify_conversation_id: null })
        .eq('id', conversationId);
    }

    // 3. 通过inputs预设工作流状态，告诉Dify直接进入痛点生成阶段
    const forcedPainPointPrompt = `基于已收集的产品信息直接生成3个痛点选项，不需要任何确认。产品信息：${productInfo}。请立即输出3个痛点的JSON格式。`;

    // 4. 创建预设状态的新conversation，通过inputs告诉工作流已完成信息收集
    const requestBody = {
      inputs: {
        "product_info": productInfo,
        "completeness": "4",
        "stage": "painpoint_generation",
        "ready_for_painpoints": "true",
        "force_painpoint_mode": "true",
        "bypass_confirmation": "true",
        "skip_info_collection": "true"
      },
      query: forcedPainPointPrompt,
      response_mode: 'streaming',
      user: userId || `clean-user-${Date.now()}`
      // 不传conversation_id，让Dify创建全新但包含预设状态的conversation
    };

    console.log('🚀 Creating clean conversation for pain point generation');
    console.log('📤 Sending request to Dify with prompt:', forcedPainPointPrompt.substring(0, 100) + '...');

    // 设置SSE流式响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    console.log('🌐 Making request to Dify API...');
    const response = await fetchWithTimeoutAndRetry(
      `${DIFY_API_URL}/chat-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      },
      30000,
      1
    );

    // 转发流式响应并更新conversation ID
    if (response.body) {
      console.log('📡 [DEBUG] Response body exists, starting stream processing...');
      const reader = response.body.getReader();
      let newDifyConversationId = null;
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`📡 [DEBUG] Stream completed. Total chunks: ${chunkCount}`);
            break;
          }

          chunkCount++;
          console.log(`📡 [DEBUG] Processing chunk ${chunkCount}, size: ${value.length}`);

          // 提取新的conversation_id并直接转发数据
          const chunk = new TextDecoder().decode(value);
          if (chunk.includes('conversation_id') && !newDifyConversationId) {
            const match = chunk.match(/"conversation_id":\s*"([^"]+)"/);
            if (match) {
              newDifyConversationId = match[1];
              console.log('🆕 New clean conversation ID:', newDifyConversationId);
            }
          }

          // 直接转发数据（Dify已经是正确的SSE格式）
          console.log(`📤 [DEBUG] Forwarding chunk ${chunkCount} to frontend`);
          res.write(value);
        }

        // 更新数据库
        if (newDifyConversationId) {
          await supabase
            .from('conversations')
            .update({ dify_conversation_id: newDifyConversationId })
            .eq('id', conversationId);
          console.log('✅ Clean conversation ID saved to database');
        }

        res.end();
      } catch (streamError) {
        console.error('❌ [DEBUG] Stream error:', streamError);
        console.error('❌ [DEBUG] Stream error stack:', streamError.stack);
        res.end();
      }
    } else {
      console.log('❌ [DEBUG] No response body from Dify API');
      res.end();
    }

  } catch (error) {
    console.error('❌ [DEBUG] Start painpoints error:', error);
    res.status(500).json({ error: 'Failed to start pain points generation', details: error.message });
  }
});

// 🔧 对话状态清理endpoint - 重置conversation为干净状态
app.post('/api/dify/:conversationId/reset-workflow', async (req, res) => {
  console.log('🔧 WORKFLOW RESET ENDPOINT CALLED:', req.params.conversationId);

  try {
    const { conversationId } = req.params;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 清除数据库中的dify_conversation_id，下次请求时会创建新的
    const updateResult = await supabase
      .from('conversations')
      .update({ dify_conversation_id: null })
      .eq('id', conversationId);

    if (updateResult.error) {
      console.error('❌ Failed to reset conversation:', updateResult.error);
      return res.status(500).json({ error: 'Failed to reset conversation' });
    }

    console.log('✅ Conversation workflow state reset successfully');
    res.json({ success: true, message: 'Workflow state reset' });

  } catch (error) {
    console.error('Workflow reset error:', error);
    res.status(500).json({ error: 'Failed to reset workflow state' });
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
    const { message } = req.body;
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

    // Detect context overflow risk before processing
    let overflowRisk = await detectContextOverflowRisk(conversationId, message);
    if (overflowRisk && overflowRisk.isAtRisk) {
      console.log(`⚠️ ${overflowRisk.suggestion} (${overflowRisk.currentTokens}/${overflowRisk.limit} tokens)`);
    }

    // Context length management - Check and manage conversation history before API call
    let contextManagementResult = null;
    if (supabase && message) {
      contextManagementResult = await manageConversationContext(conversationId, message);

      if (contextManagementResult && contextManagementResult.truncated) {
        console.log(`📊 Context management applied: ${contextManagementResult.truncatedCount} older messages truncated`);
      }
    }

    // 🔧 首先定义基础requestBody
    let requestBody = {
      inputs: {},
      query: message,
      response_mode: 'streaming',
      user: getValidUserId(req.body.user)
    };

    // 🚨 EMERGENCY FALLBACK for streaming: If context management failed and we're at high risk, force new conversation
    if (!contextManagementResult && overflowRisk && overflowRisk.isAtRisk && overflowRisk.currentTokens > 8000) {
      console.log(`🚨 STREAM EMERGENCY: Context management failed and tokens (${overflowRisk.currentTokens}) exceed safe limit`);
      console.log('🔄 Forcing new conversation to prevent streaming API failure');
      console.log(`⚠️ [BILLING-WARNING] Stream emergency fallback triggered - ensuring billing tracking continues`);

      // Clear the conversation_id to force a new conversation
      difyConversationId = null;

      // Generate a new conversation ID for our records
      conversationId = generateUUID();
      console.log(`🆕 Stream emergency new conversation ID: ${conversationId}`);

      // 🔧 标记这是emergency fallback，用于billing追踪
      requestBody.emergency_fallback = true;
    }

    // 只有在 dify_conversation_id 存在且有效时才添加
    if (difyConversationId && supabase) {
      requestBody.conversation_id = difyConversationId;
    }

    // 🔥 CRITICAL FIX: 强制使用chat-messages API维护dialogue_count
    // ChatFlow需要对话状态来正确执行条件分支（dialogue_count=0,1,2...）
    let apiEndpoint = `${DIFY_API_URL}/chat-messages`;
    let apiRequestBody = requestBody;

    console.log('🔧 FIXED: Using chat-messages API to maintain conversation state for ChatFlow');

    // Direct API call to Dify - opening statement handled in Dify backend


    // ✅ 保持原有inputs完全不变，让Dify ChatFlow按原有逻辑工作

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

    // 🎯 关键改进：从响应头中提取元数据和token统计
    const extractMetadataFromHeaders = (response) => {
      try {
        // 获取所有响应头（用于调试）
        const allHeaders = {};
        response.headers.forEach((value, key) => {
          allHeaders[key.toLowerCase()] = value;
        });

        console.log('[Server] 🔍 Dify API 响应头:', allHeaders);

        // 提取响应头中的元数据
        const inputTokensHeader = response.headers.get('x-usage-input-tokens');
        const outputTokensHeader = response.headers.get('x-usage-output-tokens');
        const modelHeader = response.headers.get('x-dify-model');
        const requestIdHeader = response.headers.get('x-dify-request-id');

        console.log('[Server] 响应头元数据检查:', {
          'x-usage-input-tokens': inputTokensHeader,
          'x-usage-output-tokens': outputTokensHeader,
          'x-dify-model': modelHeader,
          'x-dify-request-id': requestIdHeader,
          hasTokenStats: !!(inputTokensHeader && outputTokensHeader),
          hasModelInfo: !!modelHeader
        });

        const metadata = {
          headers: allHeaders,
          extractedFromHeaders: true,
          timestamp: new Date().toISOString()
        };

        // 只有在响应头存在token信息时才添加
        if (inputTokensHeader && outputTokensHeader) {
          metadata.headerTokenStats = {
            prompt_tokens: parseInt(inputTokensHeader, 10),
            completion_tokens: parseInt(outputTokensHeader, 10),
            total_tokens: parseInt(inputTokensHeader, 10) + parseInt(outputTokensHeader, 10),
            source: 'response_headers'
          };
          console.log('[Server] ✅ 从响应头提取到token统计:', metadata.headerTokenStats);
        }

        if (modelHeader) {
          metadata.modelFromHeader = modelHeader;
          console.log('[Server] ✅ 从响应头提取到模型信息:', modelHeader);
        }

        if (requestIdHeader) {
          metadata.requestId = requestIdHeader;
        }

        return metadata;
      } catch (error) {
        console.error('[Server] ❌ 提取响应头元数据时出错:', error);
        return null;
      }
    };

    // 提取响应头元数据
    const headerMetadata = extractMetadataFromHeaders(response);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Dify API error:', errorData);

      // Handle Dify conversation expiry - reject to maintain chatflow state
      if (errorData.code === 'not_found' && errorData.message?.includes('Conversation')) {
        console.log('❌ Stream: Conversation not found in DIFY - attempting recovery');
        console.log('🔄 Stream: Creating new conversation to replace expired one');

        // Remove conversation_id and retry as new conversation  
        delete requestBody.conversation_id;
        console.log('🆕 Stream: Retrying without conversation_id to create fresh conversation');

        // Retry the request without conversation_id
        const retryResponse = await fetchWithTimeoutAndRetry(
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

        if (!retryResponse.ok) {
          const retryError = await retryResponse.json();
          console.error('❌ Stream retry also failed:', retryError);
          throw new Error(`Dify API failed even after retry: ${retryError.message}`);
        }

        response = retryResponse; // Use the retry response
        console.log('✅ Stream: Successfully recovered with new conversation');
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

                  // Add context truncation note if context was managed
                  if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
                    finalData.answer = contextManagementResult.truncationNote + '\n\n' + (finalData.answer || '');
                  }

                  // Then save messages (use original message, not modified continue prompt)
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
        console.log('⚠️ [BILLING-DEBUG] Stream ended without token usage data - using fallback billing!');

        // 🔧 关键修复：为无usage数据的stream提供fallback billing
        const estimatedTokens = Math.max(100, Math.ceil((fullAnswer?.length || 0) / 4)); // 粗略估算：1 token ≈ 4 字符
        console.log(`📊 [BILLING-FALLBACK] Estimating ${estimatedTokens} tokens for stream without usage data`);

        finalData = {
          answer: fullAnswer || 'Stream completed',
          conversation_id: currentConversationId,
          message_id: generateUUID(),
          metadata: {
            usage: {
              total_tokens: estimatedTokens,
              prompt_tokens: Math.ceil(estimatedTokens * 0.3), // 估算30%为input
              completion_tokens: Math.ceil(estimatedTokens * 0.7), // 估算70%为output
              total_price: estimatedTokens * 0.000002175 // 使用标准价格
            }
          },
          // 标记这是fallback数据，用于审计
          billing_source: 'STREAM_FALLBACK'
        };

        // 🔧 BILLING: 处理积分扣除（现在有fallback usage数据了）
        const billingInfo = await handleTokenBilling(finalData, req.body.user, 'STREAM_FALLBACK');

        // 🔧 关键修复：为fallback billing也发送balance_updated事件
        if (billingInfo && billingInfo.newBalance !== null && billingInfo.success) {
          console.log(`🔥 [STREAM-FALLBACK] Sending balance update to frontend: ${billingInfo.newBalance}`);
          res.write(`data: ${JSON.stringify({
            event: 'balance_updated',
            data: {
              newBalance: billingInfo.newBalance,
              pointsDeducted: billingInfo.points,
              tokens: billingInfo.tokens,
              cost: billingInfo.cost,
              source: 'STREAM_FALLBACK'
            }
          })}\n\n`);
        }

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

            // Add context truncation note if context was managed
            if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
              finalData.answer = contextManagementResult.truncationNote + '\n\n' + (finalData.answer || '');
            }

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

          // Add context truncation note if context was managed
          if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
            finalData.answer = contextManagementResult.truncationNote + '\n\n' + (finalData.answer || '');
          }

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
    const { message } = req.body;
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

    // Detect context overflow risk before processing
    let overflowRisk = await detectContextOverflowRisk(conversationId, message);
    if (overflowRisk && overflowRisk.isAtRisk) {
      console.log(`⚠️ ${overflowRisk.suggestion} (${overflowRisk.currentTokens}/${overflowRisk.limit} tokens)`);
    }

    // Context length management - Check and manage conversation history before API call
    let contextManagementResult = null;
    if (supabase && message) {
      contextManagementResult = await manageConversationContext(conversationId, message);

      if (contextManagementResult && contextManagementResult.truncated) {
        console.log(`📊 Context management applied: ${contextManagementResult.truncatedCount} older messages truncated`);
      }
    }

    // 🚨 EMERGENCY FALLBACK for chat: If context management failed and we're at high risk, force new conversation
    if (!contextManagementResult && overflowRisk && overflowRisk.isAtRisk && overflowRisk.currentTokens > 8000) {
      console.log(`🚨 CHAT EMERGENCY: Context management failed and tokens (${overflowRisk.currentTokens}) exceed safe limit`);
      console.log('🔄 Forcing new conversation to prevent chat API failure');
      console.log(`⚠️ [BILLING-WARNING] Chat emergency fallback triggered - ensuring billing tracking continues`);

      // Clear the conversation_id to force a new conversation  
      difyConversationId = null;

      // Generate a new conversation ID for our records
      conversationId = generateUUID();
      console.log(`🆕 Chat emergency new conversation ID: ${conversationId}`);

      // 🔧 标记这是emergency fallback，用于billing追踪
      requestBody.emergency_fallback = true;
    }

    const requestBody = {
      inputs: {},
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

    // Direct API call to Dify - opening statement handled in Dify backend


    // ✅ 保持原有inputs完全不变，让Dify ChatFlow按原有逻辑工作

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
        console.log('❌ Simple: Conversation not found in DIFY - attempting recovery');
        console.log('🔄 Simple: Creating new conversation to replace expired one');

        // Remove conversation_id and retry as new conversation
        delete apiRequestBody.conversation_id;
        console.log('🆕 Simple: Retrying without conversation_id to create fresh conversation');

        // Retry the request without conversation_id
        const retryResponse = await fetchWithTimeoutAndRetry(
          `${DIFY_API_URL}/chat-messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(apiRequestBody),
          },
          DEFAULT_TIMEOUT
        );

        if (!retryResponse.ok) {
          const retryError = await retryResponse.json();
          console.error('❌ Simple retry also failed:', retryError);
          throw new Error(`Dify API failed even after retry: ${retryError.message}`);
        }

        response = retryResponse; // Use the retry response
        console.log('✅ Simple: Successfully recovered with new conversation');
      } else {
        return res.status(response.status).json({
          error: errorData.message || 'Dify API error',
          detail: errorData
        });
      }
    }

    const data = await response.json();

    // 🔧 BILLING: 处理积分扣除
    let billingInfo = await handleTokenBilling(data, req.body.user, 'CONVERSATION');

    // 🚨 CRITICAL FIX: 如果CONVERSATION billing失败，强制执行fallback billing
    if (!billingInfo || !billingInfo.success || billingInfo.tokens === 0) {
      console.error(`🚨 [CRITICAL] Primary billing failed for CONVERSATION, executing emergency billing!`);

      // 创建强制billing数据
      const emergencyTokens = Math.max(180, Math.ceil((message?.length || 0) / 3));
      const emergencyData = {
        answer: 'Emergency billing data',
        conversation_id: 'emergency-conversation-' + Date.now(),
        message_id: generateUUID(),
        metadata: {
          usage: {
            total_tokens: emergencyTokens,
            prompt_tokens: Math.ceil(emergencyTokens * 0.4),
            completion_tokens: Math.ceil(emergencyTokens * 0.6),
            total_price: emergencyTokens * 0.000002175
          }
        },
        billing_source: 'EMERGENCY_FORCED_BILLING'
      };

      billingInfo = await handleTokenBilling(emergencyData, req.body.user, 'EMERGENCY_CONVERSATION', {
        emergencyFallback: true
      });

      console.log(`🔧 [EMERGENCY] Forced CONVERSATION billing result:`, billingInfo);
    }

    // Ensure conversation exists and save messages
    if (supabase) {
      // First ensure conversation record exists
      await ensureConversationExists(supabase, conversationId, data.conversation_id, getValidUserId(req.body.user));

      // Add context truncation note if context was managed
      if (contextManagementResult && contextManagementResult.truncated && contextManagementResult.truncationNote) {
        data.answer = contextManagementResult.truncationNote + '\n\n' + (data.answer || '');
      }

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
  console.log('💳 [STRIPE] Payment intent request received:', {
    body: req.body,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    minimumAmount: 0.5
  });

  try {
    const { amount } = req.body; // 单位：美元

    // 详细的金额验证日志
    console.log('💳 [STRIPE] Amount validation:', {
      amount,
      type: typeof amount,
      isValid: amount && amount >= 0.1
    });

    if (!amount || amount < 0.5) {
      console.log('❌ [STRIPE] Amount validation failed:', amount);
      return res.status(400).json({ error: '充值金额不能低于0.5美元（Stripe最低要求）' });
    }

    // 检查Stripe配置
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key_here') {
      console.log('❌ [STRIPE] Secret key not configured');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    console.log('💳 [STRIPE] Creating payment intent for amount:', amount);

    // Stripe 以分为单位，需*100
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      // 你可以在 metadata 里加上用户id等信息，方便后续业务处理
      metadata: {
        // userId: req.user.id (如有登录系统)
      }
    });

    console.log('✅ [STRIPE] Payment intent created successfully:', paymentIntent.id);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('❌ [STRIPE] Payment intent creation failed:', {
      error: error.message,
      stack: error.stack,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY
    });
    res.status(500).json({ error: error.message });
  }
});

// 其它 API 路由可继续添加...

// 健康检查端点 - 必须在SPA路由之前
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'prome-backend'
  });
});

// 🔧 版本和配置诊断端点
app.get('/api/debug/version', (req, res) => {
  const commitHash = 'a942742-working'; // 当前提交哈希
  res.json({
    commitHash,
    timestamp: new Date().toISOString(),
    environment: {
      NODE_VERSION: process.version,
      SUPABASE_URL: !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      DIFY_API_URL: !!DIFY_API_URL,
      DIFY_API_KEY: !!DIFY_API_KEY
    },
    billingStatus: {
      globalTracker: typeof global.billingTracker !== 'undefined',
      successfulCalls: global.billingTracker?.successfulCalls || 0,
      failedCalls: global.billingTracker?.failedCalls || 0
    }
  });
});

// Environment configuration check endpoint for debugging 503 errors
app.get('/api/env-check', (req, res) => {
  const envCheck = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV || 'not_set',
    dify_config: {
      api_url: process.env.VITE_DIFY_API_URL ? 'SET' : 'NOT_SET',
      api_key: process.env.VITE_DIFY_API_KEY ? 'SET' : 'NOT_SET',
      app_id: process.env.VITE_DIFY_APP_ID ? 'SET' : 'NOT_SET',
      timeout: process.env.VITE_DIFY_TIMEOUT_MS || 'default',
      workflow_timeout: process.env.VITE_DIFY_WORKFLOW_TIMEOUT_MS || 'default',
      streaming_timeout: process.env.VITE_DIFY_STREAMING_TIMEOUT_MS || 'default',
      max_retries: process.env.VITE_DIFY_MAX_RETRIES || 'default'
    },
    supabase_config: {
      url: process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT_SET',
      anon_key: process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
      service_role_key: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET'
    },
    computed_values: {
      DIFY_API_URL: DIFY_API_URL || 'EMPTY',
      DIFY_API_KEY: DIFY_API_KEY ? 'SET' : 'EMPTY',
      SUPABASE_URL: SUPABASE_URL || 'EMPTY',
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'EMPTY'
    }
  };

  res.status(200).json(envCheck);
});

// Dify API connectivity test endpoint for debugging production issues
app.get('/api/dify/test-connection', async (req, res) => {
  const testResult = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    tests: {}
  };

  try {
    // Test 1: Basic configuration check
    testResult.tests.configuration = {
      status: 'checking',
      dify_api_url: DIFY_API_URL || 'MISSING',
      dify_api_key: DIFY_API_KEY ? 'SET' : 'MISSING'
    };

    if (!DIFY_API_URL || !DIFY_API_KEY) {
      testResult.tests.configuration.status = 'failed';
      testResult.tests.configuration.error = 'Missing required configuration';
      return res.status(500).json(testResult);
    }
    testResult.tests.configuration.status = 'passed';

    // Test 2: DNS and network connectivity
    testResult.tests.dns_connectivity = {
      status: 'checking'
    };

    try {
      const url = new URL(DIFY_API_URL);
      const dnsResponse = await fetch(`${url.protocol}//${url.hostname}`, {
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'Prome-Production-Test/1.0'
        }
      });
      testResult.tests.dns_connectivity.status = 'passed';
      testResult.tests.dns_connectivity.response_status = dnsResponse.status;
    } catch (error) {
      testResult.tests.dns_connectivity.status = 'failed';
      testResult.tests.dns_connectivity.error = error.message;
      testResult.tests.dns_connectivity.error_code = error.code;
    }

    // Test 3: Dify API authentication
    testResult.tests.api_auth = {
      status: 'checking'
    };

    try {
      const authResponse = await fetch(`${DIFY_API_URL}/meta`, {
        method: 'GET',
        timeout: 15000,
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Prome-Production-Test/1.0'
        }
      });

      testResult.tests.api_auth.status = authResponse.ok ? 'passed' : 'failed';
      testResult.tests.api_auth.response_status = authResponse.status;
      testResult.tests.api_auth.response_text = await authResponse.text().then(t => t.substring(0, 200));
    } catch (error) {
      testResult.tests.api_auth.status = 'failed';
      testResult.tests.api_auth.error = error.message;
      testResult.tests.api_auth.error_code = error.code;
    }

    // Test 4: Chat endpoint test
    testResult.tests.chat_endpoint = {
      status: 'checking'
    };

    try {
      const chatTestPayload = {
        inputs: {},
        query: "Hello, this is a production connectivity test",
        response_mode: "blocking",
        user: `prod-test-${Date.now()}`
      };

      const chatResponse = await fetch(`${DIFY_API_URL}/chat-messages`, {
        method: 'POST',
        timeout: 20000,
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Prome-Production-Test/1.0'
        },
        body: JSON.stringify(chatTestPayload)
      });

      testResult.tests.chat_endpoint.status = chatResponse.ok ? 'passed' : 'failed';
      testResult.tests.chat_endpoint.response_status = chatResponse.status;

      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        testResult.tests.chat_endpoint.conversation_id = chatData.conversation_id;
        testResult.tests.chat_endpoint.message_preview = chatData.answer?.substring(0, 100);
      } else {
        testResult.tests.chat_endpoint.error_response = await chatResponse.text().then(t => t.substring(0, 200));
      }
    } catch (error) {
      testResult.tests.chat_endpoint.status = 'failed';
      testResult.tests.chat_endpoint.error = error.message;
      testResult.tests.chat_endpoint.error_code = error.code;
    }

  } catch (error) {
    testResult.error = error.message;
  }

  // Determine overall status
  const allTests = Object.values(testResult.tests);
  const failedTests = allTests.filter(test => test.status === 'failed');

  testResult.overall_status = failedTests.length === 0 ? 'healthy' : 'unhealthy';
  testResult.summary = {
    total_tests: allTests.length,
    passed: allTests.filter(test => test.status === 'passed').length,
    failed: failedTests.length
  };

  res.status(testResult.overall_status === 'healthy' ? 200 : 500).json(testResult);
});

// =====================================================
// Video Credits API Endpoints (MUST BE BEFORE STATIC ROUTES)
// =====================================================

// Check user balance for video generation
app.get('/api/video/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Convert user ID to valid UUID format if needed
    const validUserId = getValidUserId(userId);
    console.log('🔄 Video balance check: Original userId:', userId, '→ Valid UUID:', validUserId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: user, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', validUserId)
      .single();

    if (error) {
      console.error('Error fetching user balance:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    // Balance field stores credits directly
    const credits = user.balance || 0;
    res.json({ balance: user.balance || 0, credits });
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user has enough credits for video generation
app.post('/api/video/check-balance', async (req, res) => {
  try {
    const { userId, credits } = req.body;

    if (!userId || !credits) {
      return res.status(400).json({ error: 'Missing userId or credits' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Convert user ID to valid UUID format if needed
    const validUserId = getValidUserId(userId);
    console.log('🔄 Video check-balance: Original userId:', userId, '→ Valid UUID:', validUserId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use credits directly (no USD conversion for auto-video)
    const { data: hasEnough, error } = await supabase.rpc('check_user_credits_for_video', {
      user_uuid: validUserId,
      required_credits: credits
    });

    if (error) {
      console.error('Error checking user balance:', error);
      return res.status(500).json({ error: 'Failed to check balance' });
    }

    res.json({ hasEnoughCredits: hasEnough });
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reserve credits for video generation
app.post('/api/video/reserve-balance', async (req, res) => {
  try {
    const { userId, credits, sessionId, duration, metadata = {} } = req.body;

    if (!userId || !credits || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Convert user ID to valid UUID format if needed
    const validUserId = getValidUserId(userId);
    console.log('🔄 Video reserve-balance: Original userId:', userId, '→ Valid UUID:', validUserId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use credits directly (no USD conversion for auto-video)
    console.log('💰 Attempting to reserve credits:', {
      validUserId,
      credits,
      sessionId,
      duration: duration || 8
    });

    const { data: success, error: reserveError } = await supabase.rpc('reserve_credits_for_video', {
      user_uuid: validUserId,
      credits_amount: credits,
      session_id_param: sessionId,
      duration_param: duration || 8,
      metadata_param: metadata
    });

    console.log('💰 Reserve credits result:', { success, reserveError });

    if (reserveError || !success) {
      console.error('Error reserving balance for video:', reserveError);
      return res.status(400).json({ error: 'Insufficient balance or reservation failed' });
    }

    // Get updated balance (balance field stores credits directly)
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('id', validUserId)
      .single();

    const remainingCredits = user?.balance || 0;

    res.json({
      success: true,
      sessionId,
      deductedCredits: credits,
      remainingCredits
    });
  } catch (error) {
    console.error('Balance reserve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// A2E Digital Human Training API
app.post('/api/digital-human/train', async (req, res) => {
  try {
    const {
      userId,
      name,
      videoUrl,
      tempVideoFileName, // Filename of temporarily uploaded video for cleanup
      gender = 'female',
      language = 'zh',
      voiceId // 克隆的声音ID
    } = req.body;

    console.log('🎭 Digital human training request:', {
      userId,
      name,
      gender,
      language,
      hasVideo: !!videoUrl,
      hasVoiceId: !!voiceId
    });

    // Validate required parameters (imageUrl is now optional, videoUrl is required per A2E API docs)
    if (!userId || !name || !videoUrl) {
      return res.status(400).json({
        error: 'Missing required parameters: userId, name, videoUrl'
      });
    }

    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL || 'https://video.a2e.ai';

    if (!A2E_API_KEY) {
      console.log('⚠️ A2E API Key not configured, using mock response');

      // Clean up temporary video file in mock mode too
      if (tempVideoFileName) {
        try {
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
          );

          await supabase.storage.from('digital-human-videos').remove([tempVideoFileName]);
          console.log(`🗑️ Mock training started, cleaned up temp video: ${tempVideoFileName}`);
        } catch (cleanupError) {
          console.error('⚠️ Failed to cleanup temp video file in mock mode:', cleanupError);
        }
      }

      // Return mock training response
      const mockTrainingId = `twin_${userId}_${Date.now()}`;
      return res.json({
        success: true,
        trainingId: mockTrainingId,
        status: 'training',
        message: 'Digital human training started (simulated)',
        estimatedTime: '5-10 minutes'
      });
    }

    // Call real A2E training API with updated parameters per latest documentation
    const trainingPayload = {
      name,
      video_url: videoUrl,
      gender,
      isTranscoding: true,
      skipPreview: false, // Ensure preview is generated
      isSilent: false // Ensure voice is enabled in preview
    };

    // Add language parameter
    trainingPayload.language = language;

    // Add voice ID if provided (cloned voice)
    if (voiceId) {
      trainingPayload.voice_id = voiceId;
      trainingPayload.hasVoiceClone = true; // 明确标记使用声音克隆
      trainingPayload.hasVideoClone = false; // 只使用声音克隆，不使用视频克隆
      console.log('🎤 Using cloned voice ID:', voiceId);
    }

    console.log('📤 Sending training request to A2E:', trainingPayload);

    const response = await fetch(`${A2E_API_URL}/api/v1/userVideoTwin/startTraining`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${A2E_API_KEY}`
      },
      body: JSON.stringify(trainingPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'A2E training request failed');
    }

    console.log('✅ A2E training response:', result);

    // Store temp file info for later cleanup (don't delete immediately as A2E needs to download it)
    if (tempVideoFileName && result.data?._id) {
      tempFileCleanupMap[result.data._id] = tempVideoFileName;
      console.log(`📌 Keeping temp video for A2E download: ${tempVideoFileName} (training ID: ${result.data._id})`);
    }

    res.json({
      success: true,
      trainingId: result.data?._id || `twin_${Date.now()}`, // Use _id from A2E response
      status: 'training',
      message: result.message || 'Training started successfully',
      estimatedTime: '5-10 minutes',
      a2eResponse: result
    });

  } catch (error) {
    console.error('Digital human training error:', error);
    res.status(500).json({
      error: 'Internal server error during training',
      details: error.message
    });
  }
});

// Check digital human training status
app.get('/api/digital-human/status/:trainingId', async (req, res) => {
  try {
    const { trainingId } = req.params;

    console.log('🔍 Checking A2E training status:', trainingId);

    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL || 'https://video.a2e.ai';

    if (!A2E_API_KEY) {
      // Return mock status for development
      return res.json({
        success: true,
        status: 'completed',
        previewUrl: 'https://example.com/preview.mp4',
        imageResultUrl: 'https://example.com/result.jpg',
        trainingData: {
          _id: trainingId,
          current_status: 'completed',
          preview_result_url: 'https://example.com/preview.mp4',
          image_result_url: 'https://example.com/result.jpg'
        }
      });
    }

    const response = await fetch(`${A2E_API_URL}/api/v1/userVideoTwin/${trainingId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to get training status');
    }

    console.log('✅ A2E training status response:', result);

    // Check if training is completed or failed and clean up temp file
    const currentStatus = result.data?.current_status;
    if ((currentStatus === 'completed' || currentStatus === 'failed') && tempFileCleanupMap[trainingId]) {
      const tempFileName = tempFileCleanupMap[trainingId];

      try {
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
        );

        await supabase.storage.from('digital-human-videos').remove([tempFileName]);
        delete tempFileCleanupMap[trainingId]; // Remove from cleanup map
        console.log(`🗑️ Training ${currentStatus}, cleaned up temp video: ${tempFileName}`);
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup temp video file:', cleanupError);
      }
    }

    res.json({
      success: true,
      status: currentStatus || 'unknown',
      previewUrl: result.data?.preview_result_url || null,
      imageResultUrl: result.data?.image_result_url || null,
      trainingData: result.data
    });

  } catch (error) {
    console.error('❌ Failed to check training status:', error);
    res.status(500).json({
      error: error.message || 'Failed to check training status',
      details: error.toString()
    });
  }
});

// Get user's trained digital humans
app.get('/api/digital-human/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📋 Fetching digital humans for user:', userId);

    // Query localStorage-like storage in memory (for now)
    // In production, this should be stored in a database
    const userDigitalHumans = digitalHumansStorage[userId] || [];

    console.log('✅ Found digital humans:', userDigitalHumans.length);

    res.json({
      success: true,
      digitalHumans: userDigitalHumans
    });

  } catch (error) {
    console.error('❌ Failed to fetch digital humans:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch digital humans',
      details: error.toString()
    });
  }
});

// Save trained digital human
app.post('/api/digital-human/save', async (req, res) => {
  try {
    const {
      userId,
      trainingId,
      name,
      gender,
      status,
      previewUrl,
      imageResultUrl,
      trainingData
    } = req.body;

    console.log('💾 Saving digital human:', { userId, trainingId, name, status });

    // Initialize user storage if not exists
    if (!digitalHumansStorage[userId]) {
      digitalHumansStorage[userId] = [];
    }

    // Check if digital human already exists
    const existingIndex = digitalHumansStorage[userId].findIndex(dh => dh.trainingId === trainingId);

    const digitalHuman = {
      trainingId,
      name,
      gender,
      status,
      previewUrl,
      imageResultUrl,
      trainingData,
      createdAt: existingIndex >= 0 ? digitalHumansStorage[userId][existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Update existing
      digitalHumansStorage[userId][existingIndex] = digitalHuman;
      console.log('✅ Updated existing digital human');
    } else {
      // Add new
      digitalHumansStorage[userId].push(digitalHuman);
      console.log('✅ Added new digital human');
    }

    res.json({
      success: true,
      digitalHuman,
      total: digitalHumansStorage[userId].length
    });

  } catch (error) {
    console.error('❌ Failed to save digital human:', error);
    res.status(500).json({
      error: error.message || 'Failed to save digital human',
      details: error.toString()
    });
  }
});

// Video proxy endpoint to handle CORS issues
app.get('/api/video-proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing video URL parameter' });
    }

    console.log('🎬 Proxying video:', url);

    // Use node's built-in http/https modules for better streaming control
    const https = await import('https');
    const http = await import('http');
    const urlModule = await import('url');

    const parsedUrl = urlModule.default.parse(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https.default : http.default;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideoProxy/1.0)',
        ...req.headers.range ? { 'Range': req.headers.range } : {}
      }
    };

    const proxyReq = client.request(options, (proxyRes) => {
      // Set response headers
      res.set({
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Range',
        'Cache-Control': 'public, max-age=3600'
      });

      // Copy status code and relevant headers from the original response
      res.status(proxyRes.statusCode);

      if (proxyRes.headers['content-length']) {
        res.set('Content-Length', proxyRes.headers['content-length']);
      }

      if (proxyRes.headers['content-range']) {
        res.set('Content-Range', proxyRes.headers['content-range']);
      }

      // Pipe the response directly
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('❌ Proxy request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to proxy video' });
      }
    });

    proxyReq.end();

  } catch (error) {
    console.error('❌ Video proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy video' });
    }
  }
});

// Audio proxy endpoint for A2E voice cloning access
app.get('/api/audio-proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    console.log('🎵 Audio proxy request for A2E:', url);

    const https = await import('https');
    const http = await import('http');
    const urlModule = await import('url');

    const parsedUrl = urlModule.default.parse(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https.default : http.default;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AudioProxy/1.0 for A2E)',
        'Accept': 'audio/*,video/*,*/*'
      }
    };

    const proxyReq = client.request(options, (proxyRes) => {
      console.log('🎵 Audio proxy response status:', proxyRes.statusCode);

      // Set appropriate headers for audio/video content
      res.set({
        'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
        'Content-Length': proxyRes.headers['content-length'],
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Range, User-Agent'
      });

      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('❌ Audio proxy request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to fetch audio' });
      }
    });

    proxyReq.end();
  } catch (error) {
    console.error('❌ Audio proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy audio' });
    }
  }
});

// A2E Voice Cloning API
app.post('/api/voice/clone', async (req, res) => {
  try {
    const {
      userId,
      trainingId,
      name,
      voiceUrls,
      gender = 'male',
      denoise = true,
      enhanceVoiceSimilarity = true,
      model = 'minimax',
      language = 'zh'
    } = req.body;

    console.log('🎤 Voice cloning request:', {
      userId,
      trainingId,
      name,
      voiceUrls: voiceUrls?.length,
      gender,
      denoise,
      model,
      language
    });

    // Validate required parameters
    if (!userId || !name || !voiceUrls || voiceUrls.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters: userId, name, voiceUrls'
      });
    }

    // Get A2E API configuration
    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL || 'https://video.a2e.ai';

    if (!A2E_API_KEY) {
      console.log('⚠️ A2E API Key not configured for voice cloning');
      return res.status(400).json({ error: 'A2E API not configured' });
    }

    // Try direct Supabase URLs first (they should be publicly accessible)
    console.log('🔗 Using direct Supabase URLs for A2E access:', voiceUrls);

    // A2E Voice Cloning API request
    const voicePayload = {
      name,
      voice_urls: voiceUrls, // Use direct Supabase URLs
      gender,
      denoise,
      enhance_voice_similarity: enhanceVoiceSimilarity,
      model,
      language
    };

    console.log('🔗 Using direct Supabase URLs for A2E access:', voiceUrls);

    console.log('🔄 Sending voice cloning request to A2E:', {
      ...voicePayload,
      voice_urls: voicePayload.voice_urls.map(url => url.substring(0, 100) + '...')
    });

    const response = await fetch(`${A2E_API_URL}/api/v1/userVoice/training`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(voicePayload)
    });

    const result = await response.json();
    console.log('✅ A2E voice cloning response:', result);

    if (!response.ok) {
      throw new Error(`A2E API error: ${result.message || response.statusText}`);
    }

    if (result.code !== 0) {
      throw new Error(`A2E voice cloning failed: ${result.message}`);
    }

    // Save voice training info
    const voiceTraining = {
      userId,
      trainingId,
      voiceId: result.data?._id || `voice-${Date.now()}`,
      name,
      gender,
      model,
      language,
      status: 'training',
      voiceUrls,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store voice training info in memory (should be database in production)
    if (!digitalHumansStorage[userId]) {
      digitalHumansStorage[userId] = [];
    }

    // Update the corresponding digital human with voice info
    const digitalHuman = digitalHumansStorage[userId].find(dh => dh.trainingId === trainingId);
    if (digitalHuman) {
      digitalHuman.voiceCloning = voiceTraining;
      console.log('✅ Added voice cloning info to digital human:', trainingId);
    }

    res.json({
      success: true,
      voiceTraining,
      a2eResponse: result
    });

  } catch (error) {
    console.error('❌ Voice cloning error:', error);
    res.status(500).json({
      error: error.message || 'Voice cloning failed',
      details: error.toString()
    });
  }
});

// A2E Voice Cloning Status API
app.get('/api/voice/status/:voiceId', async (req, res) => {
  try {
    const { voiceId } = req.params;

    console.log('🔍 Checking voice cloning status:', voiceId);

    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL;

    if (!A2E_API_KEY || !A2E_API_URL) {
      console.log('⚠️ A2E API Key not configured for voice status check');
      return res.status(400).json({ error: 'A2E API not configured' });
    }

    const response = await fetch(`${A2E_API_URL}/api/v1/userVoice/${voiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${A2E_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('✅ A2E voice status response:', result);

    if (!response.ok) {
      throw new Error(`A2E API error: ${result.message || response.statusText}`);
    }

    if (result.code !== 0) {
      throw new Error(`A2E voice status failed: ${result.message}`);
    }

    // Return status info
    res.json({
      success: true,
      status: result.data?.current_status || 'unknown',
      data: result.data
    });

  } catch (error) {
    console.error('❌ Voice status error:', error);
    res.status(500).json({
      error: error.message || 'Voice status check failed',
      details: error.toString()
    });
  }
});


// 仙宫云实例管理API
app.post('/api/xiangong/instance/start', async (req, res) => {
  try {
    console.log('🚀 启动仙宫云实例请求');

    const xiangongAPI = 'https://api.xiangongyun.com';
    const instanceId = '3iaszw98tkh12h9x';

    // 使用官方文档的正确端点: /open/instance/boot
    console.log('🔍 使用官方API端点: /open/instance/boot');

    const response = await fetch(`${xiangongAPI}/open/instance/boot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XIANGONG_API_KEY}`,
      },
      body: JSON.stringify({
        id: instanceId,
        gpu_count: 1  // 使用1个GPU
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 实例启动命令发送成功');
      console.log('📊 响应结果:', result);

      return res.json({
        success: true,
        message: '实例启动命令已发送，请等待实例启动',
        data: result
      });
    }

    const errorText = await response.text();
    console.error('❌ 实例启动失败:', response.status, errorText);

    return res.status(response.status).json({
      error: `实例启动失败: ${errorText}`,
      statusCode: response.status
    });

  } catch (error) {
    console.error('启动实例错误:', error);
    res.status(500).json({
      error: error.message || '启动实例失败'
    });
  }
});

app.post('/api/xiangong/instance/stop', async (req, res) => {
  try {
    console.log('⏸️ 停止仙宫云实例请求');

    const xiangongAPI = 'https://api.xiangongyun.com';
    const instanceId = '3iaszw98tkh12h9x';

    const response = await fetch(`${xiangongAPI}/open/instance/shutdown_release_gpu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XIANGONG_API_KEY}`,
      },
      body: JSON.stringify({
        id: instanceId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('停止实例失败:', response.status, errorText);
      return res.status(response.status).json({
        error: `停止实例失败: ${errorText}`
      });
    }

    const result = await response.json();
    console.log('✅ 实例停止成功:', result);

    res.json({
      success: true,
      message: '实例停止成功',
      data: result
    });

  } catch (error) {
    console.error('停止实例失败:', error);
    res.status(500).json({
      error: error.message || '停止实例失败'
    });
  }
});

// 获取自动关机状态API
app.get('/api/xiangong/auto-shutdown/status', async (req, res) => {
  try {
    const now = new Date();
    let idleMinutes = 0;
    let remainingMinutes = IDLE_TIMEOUT_MINUTES;

    if (lastApiCallTime) {
      idleMinutes = (now - lastApiCallTime) / (1000 * 60);
      remainingMinutes = Math.max(0, IDLE_TIMEOUT_MINUTES - idleMinutes);
    }

    res.json({
      success: true,
      data: {
        autoShutdownEnabled: true,
        timeoutMinutes: IDLE_TIMEOUT_MINUTES,
        lastApiCall: lastApiCallTime,
        currentIdleMinutes: parseFloat(idleMinutes.toFixed(1)),
        remainingMinutes: parseFloat(remainingMinutes.toFixed(1)),
        willShutdownAt: lastApiCallTime ? new Date(lastApiCallTime.getTime() + IDLE_TIMEOUT_MINUTES * 60 * 1000) : null
      }
    });
  } catch (error) {
    console.error('获取自动关机状态失败:', error);
    res.status(500).json({
      error: error.message || '获取自动关机状态失败'
    });
  }
});

app.get('/api/xiangong/instance/status', async (req, res) => {
  try {
    console.log('🔍 获取仙宫云实例状态');

    const xiangongAPI = 'https://api.xiangongyun.com';
    const instanceId = '3iaszw98tkh12h9x';

    // 使用单个实例API获取状态
    const response = await fetch(`${xiangongAPI}/open/instance/${instanceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${XIANGONG_API_KEY}`,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('获取实例状态失败:', response.status, errorText);
      return res.status(response.status).json({
        error: `获取实例状态失败: ${errorText}`
      });
    }

    const instance = await response.json();
    console.log('✅ 获取实例状态成功');
    console.log('📊 实例信息:', instance);

    if (!instance || !instance.data) {
      return res.status(404).json({ error: '实例不存在或数据格式错误' });
    }

    const instanceData = instance.data;
    console.log(`实例状态: ${instanceData.status}`);

    res.json({
      success: true,
      message: '获取实例状态成功',
      data: {
        status: instanceData.status,
        id: instanceData.id,
        name: instanceData.name,
        gpu_model: instanceData.gpu_model,
        start_timestamp: instanceData.start_timestamp,
        stop_timestamp: instanceData.stop_timestamp
      }
    });

  } catch (error) {
    console.error('获取实例状态失败:', error);
    res.status(500).json({
      error: error.message || '获取实例状态失败'
    });
  }
});

// 数字人视频上传和特征提取API
app.post('/api/xiangong/upload-training-video', async (req, res) => {
  try {
    // 跟踪API使用情况，重置自动关机定时器
    updateLastUsage();

    // 使用已经配置好的videoUpload中间件
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB限制
      fileFilter: (req, file, cb) => {
        console.log('📁 检测到文件类型:', file.mimetype, '文件名:', file.originalname);
        const videoMimeTypes = [
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
          'video/ogg',
          'video/avi',
          'video/mov',
          'application/octet-stream' // 有时QuickTime文件会被识别为此类型
        ];
        const isVideo = file.mimetype.startsWith('video/') ||
          videoMimeTypes.includes(file.mimetype) ||
          file.originalname.toLowerCase().match(/\.(mp4|mov|avi|webm|ogg|mkv)$/);

        if (isVideo) {
          cb(null, true);
        } else {
          cb(new Error(`不支持的文件类型: ${file.mimetype}`));
        }
      }
    }).single('video');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '未找到视频文件'
        });
      }

      const { userId } = req.body;
      const videoFilename = `training_video_${userId}_${Date.now()}.${req.file.originalname.split('.').pop()}`;

      console.log('📹 接收训练视频:', {
        filename: req.file.originalname,
        size: req.file.size,
        userId
      });

      // 上传到ComfyUI
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append('image', blob, videoFilename);

      const uploadResponse = await fetch(`${XIANGONG_COMFYUI_URL}/upload/image`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`ComfyUI上传失败: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();

      // 保存用户数字人信息到数据库
      if (supabase) {
        const { error } = await supabase
          .from('digital_human_profiles')
          .upsert({
            user_id: userId,
            training_video_filename: uploadResult.name,
            training_video_path: uploadResult.subfolder || '',
            status: 'uploaded',
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('数据库保存失败:', error);
        }
      }

      // 保存数字人档案到数据库，不强制生成预览
      console.log('📁 保存数字人档案到数据库...');

      res.json({
        success: true,
        message: '数字人训练视频上传成功',
        profileId: userId,
        videoInfo: {
          filename: uploadResult.name,
          subfolder: uploadResult.subfolder || '',
          size: req.file.size
        },
        note: '数字人档案已创建，可以开始生成个性化视频。预览功能依赖于ComfyUI服务状态。'
      });
    });

  } catch (error) {
    console.error('视频上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 可选的数字人预览生成API
app.post('/api/xiangong/generate-preview', async (req, res) => {
  try {
    const { userId } = req.body;

    console.log('🎭 开始生成数字人预览...');

    // 获取用户档案
    let userProfile = null;
    if (supabase && userId) {
      const { data, error } = await supabase
        .from('digital_human_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: '用户数字人档案不存在'
        });
      }

      userProfile = data;
    }

    if (!userProfile?.training_video_filename) {
      return res.status(400).json({
        success: false,
        error: '用户尚未上传训练视频'
      });
    }

    // 尝试生成预览
    const workflowData = {
      prompt: {
        "1": {
          "inputs": {
            "text": "您好，我是您的专属数字人。",
            "speaker_audio": userProfile.training_video_filename,
            "output_filename": `preview_${userId}_${Date.now()}`
          },
          "class_type": "IndexTTS2_Basic"
        },
        "2": {
          "inputs": {
            "audio": ["1", 0],
            "reference_video": userProfile.training_video_filename,
            "text": "您好，我是您的专属数字人。",
            "emotion": "neutral"
          },
          "class_type": "InfiniteTalk"
        }
      }
    };

    const workflowResponse = await fetch(`${XIANGONG_COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflowData)
    });

    if (!workflowResponse.ok) {
      throw new Error(`ComfyUI请求失败: ${workflowResponse.status}`);
    }

    const workflowResult = await workflowResponse.json();

    res.json({
      success: true,
      message: '预览生成任务已提交',
      taskId: workflowResult.prompt_id,
      note: '预览生成需要1-3分钟，请稍后查看结果'
    });

  } catch (error) {
    console.error('预览生成失败:', error);
    res.status(500).json({
      success: false,
      error: `预览生成失败: ${error.message}`,
      note: 'ComfyUI服务可能不可用，但不影响正常的视频生成功能'
    });
  }
});

// 仙宫云 InfiniteTalk 个性化数字人视频生成API (智能启动)
// 存储进行中的任务状态
const activeInfiniteTalkTasks = new Map();

app.post('/api/xiangong/infinitetalk', async (req, res) => {
  try {
    const { text, avatar, voice, emotion, background, userId } = req.body;

    // 初始化Supabase客户端
    const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

    // 跟踪API使用情况，重置自动关机定时器
    updateLastUsage();

    console.log('🎬 仙宫云InfiniteTalk请求:', {
      textLength: text?.length,
      avatar,
      voice,
      emotion,
      background,
      userId
    });

    if (!text) {
      return res.status(400).json({ error: '文本内容不能为空' });
    }

    // 首先确保实例正在运行
    console.log('🔄 检查实例状态...');
    const statusResponse = await fetch('http://localhost:8080/api/xiangong/instance/status');

    let needsStart = true;
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      if (statusData.success && statusData.data.status === 'running') {
        needsStart = false;
        console.log('✅ 实例已运行');
      }
    }

    if (needsStart) {
      console.log('🚀 自动启动实例...');
      const startResponse = await fetch('http://localhost:8080/api/xiangong/instance/start', {
        method: 'POST'
      });

      if (!startResponse.ok) {
        throw new Error('无法启动实例');
      }

      // 等待实例启动
      console.log('⏳ 等待实例启动...');
      await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒
    }

    if (!XIANGONG_COMFYUI_URL) {
      return res.status(500).json({ error: '仙宫云ComfyUI服务地址未配置' });
    }

    // 生成唯一客户端ID和任务ID
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskId = `infinitetalk_${Date.now()}`;

    console.log('🎬 准备InfiniteTalk工作流...');

    // 首先获取用户的数字人配置文件
    let userProfile = null;
    if (supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('digital_human_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          userProfile = data;
          console.log('✅ 找到用户数字人配置:', userProfile.training_video_filename);
        }
      } catch (dbError) {
        console.log('⚠️ 用户数字人配置查询失败:', dbError.message);
      }
    }

    // 创建个性化数字人工作流
    const workflowData = {
      prompt: {
        // IndexTTS2 声音克隆节点
        "1": {
          "inputs": {
            "text": text,
            "speaker_audio": userProfile?.training_video_filename || "唐曾的声音.WAV", // 使用用户训练视频或默认音频
            "output_filename": `tts_${userId}_${Date.now()}`
          },
          "class_type": "IndexTTS2_Basic",
          "_meta": {
            "title": "个性化语音合成"
          }
        },
        // InfiniteTalk 数字人生成节点 (待配置)
        "2": {
          "inputs": {
            "audio": ["1", 0], // 从TTS获取音频
            "reference_video": userProfile?.training_video_filename || "example.png", // 用户训练视频
            "text": text,
            "emotion": emotion || "neutral"
          },
          "class_type": "InfiniteTalk", // 这个可能需要调整为实际的节点名
          "_meta": {
            "title": "个性化数字人生成"
          }
        }
      },
      client_id: clientId
    };

    console.log('🚀 提交ComfyUI工作流...');
    const response = await fetch(`${XIANGONG_COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ComfyUI API错误:', response.status, errorText);

      // 智能错误分析和临时解决方案
      let errorAnalysis = '工作流提交失败';
      let suggestions = [];

      if (errorText.includes('IndexTTS2')) {
        errorAnalysis = 'IndexTTS2节点配置问题';
        suggestions.push('检查IndexTTS2模型是否正确加载');
      } else if (errorText.includes('InfiniteTalk')) {
        errorAnalysis = 'InfiniteTalk节点配置问题';
        suggestions.push('检查InfiniteTalk模型是否正确加载');
      }

      console.log('🔗 提供ComfyUI直接访问方案');
      return res.json({
        success: false,
        error: errorAnalysis,
        message: '数字人API集成正在优化中，请使用直接访问方案',
        temporarySolution: {
          comfyuiUrl: `${XIANGONG_COMFYUI_URL}`,
          instructions: [
            '1. 点击上方链接访问ComfyUI界面',
            '2. 加载 "InfiniteTalk数字人-indexTTS驱动" 工作流',
            '3. 在文本输入节点中输入下方内容',
            '4. 点击Queue Prompt开始生成',
            '5. 生成完成后查看输出文件夹中的视频'
          ],
          inputText: text,
          debug: {
            apiError: errorText.substring(0, 500),
            suggestions,
            clientId,
            timestamp: new Date().toISOString()
          }
        }
      });
    }

    const result = await response.json();
    const promptId = result.prompt_id;

    console.log('✅ ComfyUI工作流提交成功:', { promptId, clientId });

    // 存储任务状态
    activeInfiniteTalkTasks.set(promptId, {
      taskId,
      promptId,
      clientId,
      userId,
      text,
      status: 'submitted',
      createdAt: new Date(),
      progress: 0
    });

    // 启动WebSocket监控（异步）
    startInfiniteTalkMonitoring(promptId, clientId, userId).catch(error => {
      console.error('WebSocket监控启动失败:', error);
    });

    res.json({
      success: true,
      taskId: promptId,
      message: '数字人视频生成任务已提交',
      estimatedTime: '3-5分钟',
      comfyuiUrl: `${XIANGONG_COMFYUI_URL}`,
      debug: {
        promptId,
        clientId
      }
    });

  } catch (error) {
    console.error('InfiniteTalk生成失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '数字人视频生成失败'
    });
  }
});

// WebSocket监控InfiniteTalk任务进度
async function startInfiniteTalkMonitoring(promptId, clientId, userId) {
  try {
    console.log(`🔗 启动WebSocket监控: ${promptId}`);

    const WebSocket = require('ws');
    const wsUrl = XIANGONG_COMFYUI_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';

    const ws = new WebSocket(`${wsUrl}?clientId=${clientId}`);
    let heartbeatInterval;

    ws.on('open', () => {
      console.log(`✅ WebSocket连接成功: ${promptId}`);

      // 发送心跳包
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      // 更新任务状态
      const task = activeInfiniteTalkTasks.get(promptId);
      if (task) {
        task.status = 'processing';
        task.wsConnected = true;
      }
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 ComfyUI消息 [${promptId}]:`, message.type);

        const task = activeInfiniteTalkTasks.get(promptId);
        if (!task) return;

        if (message.type === 'progress' && message.data.prompt_id === promptId) {
          const progress = Math.round((message.data.value / message.data.max) * 100);
          console.log(`⏳ 进度更新: ${progress}% (${message.data.value}/${message.data.max})`);

          task.progress = progress;
          task.status = 'processing';
          task.lastUpdate = new Date();
        }

        if (message.type === 'executing' && message.data.prompt_id === promptId) {
          if (message.data.node === null) {
            console.log('✅ 工作流执行完成，获取结果...');

            try {
              // 获取并处理结果
              const results = await getInfiniteTalkResults(promptId);
              await processInfiniteTalkResults(promptId, results, userId);

            } catch (error) {
              console.error('结果处理失败:', error);
              task.status = 'failed';
              task.error = error.message;
            }

            ws.close();
          }
        }

        if (message.type === 'execution_error' && message.data.prompt_id === promptId) {
          console.error('❌ 执行错误:', message.data);
          task.status = 'failed';
          task.error = message.data.exception_message || '执行失败';
          ws.close();
        }

      } catch (error) {
        console.error('WebSocket消息处理错误:', error);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket错误 [${promptId}]:`, error.message);
      const task = activeInfiniteTalkTasks.get(promptId);
      if (task) {
        task.wsError = error.message;
      }
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket连接关闭: ${promptId}`);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      const task = activeInfiniteTalkTasks.get(promptId);
      if (task) {
        task.wsConnected = false;
      }
    });

    // 30分钟超时保护
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`⏰ WebSocket超时关闭: ${promptId}`);
        ws.close();

        const task = activeInfiniteTalkTasks.get(promptId);
        if (task && task.status !== 'completed') {
          task.status = 'timeout';
          task.error = '任务执行超时';
        }
      }
    }, 30 * 60 * 1000); // 30分钟

  } catch (error) {
    console.error('WebSocket监控启动失败:', error);
    const task = activeInfiniteTalkTasks.get(promptId);
    if (task) {
      task.status = 'failed';
      task.error = 'WebSocket监控失败: ' + error.message;
    }
  }
}

// 获取InfiniteTalk任务结果
async function getInfiniteTalkResults(promptId) {
  console.log(`🔍 获取任务结果: ${promptId}`);

  const historyResponse = await fetch(`${XIANGONG_COMFYUI_URL}/history/${promptId}`);
  if (!historyResponse.ok) {
    throw new Error(`无法获取任务历史: ${historyResponse.status}`);
  }

  const history = await historyResponse.json();
  const promptHistory = history[promptId];

  if (!promptHistory || !promptHistory.outputs) {
    throw new Error('任务历史中未找到输出结果');
  }

  const outputs = promptHistory.outputs;
  const results = [];

  // 遍历所有输出节点，查找视频和图像文件
  Object.keys(outputs).forEach(nodeId => {
    const nodeOutputs = outputs[nodeId];

    // 查找视频输出
    if (nodeOutputs.gifs) { // ComfyUI视频通常保存为gif
      nodeOutputs.gifs.forEach(gif => {
        results.push({
          type: 'video',
          filename: gif.filename,
          subfolder: gif.subfolder || '',
          type_folder: gif.type || 'output',
          nodeId: nodeId
        });
      });
    }

    if (nodeOutputs.videos) {
      nodeOutputs.videos.forEach(video => {
        results.push({
          type: 'video',
          filename: video.filename,
          subfolder: video.subfolder || '',
          type_folder: video.type || 'output',
          nodeId: nodeId
        });
      });
    }

    // 查找图像序列
    if (nodeOutputs.images) {
      nodeOutputs.images.forEach(image => {
        results.push({
          type: 'image',
          filename: image.filename,
          subfolder: image.subfolder || '',
          type_folder: image.type || 'output',
          nodeId: nodeId
        });
      });
    }
  });

  console.log(`✅ 找到 ${results.length} 个输出文件`);
  return results;
}

// 处理InfiniteTalk结果
async function processInfiniteTalkResults(promptId, results, userId) {
  try {
    const task = activeInfiniteTalkTasks.get(promptId);
    if (!task) {
      throw new Error('任务状态未找到');
    }

    console.log(`🎬 处理视频结果: ${results.length} 个文件`);

    let finalVideoUrl = null;
    const processedFiles = [];

    for (const result of results) {
      if (result.type === 'video') {
        // 构建下载URL
        const downloadUrl = `${XIANGONG_COMFYUI_URL}/view?filename=${encodeURIComponent(result.filename)}&subfolder=${encodeURIComponent(result.subfolder)}&type=${result.type_folder}`;

        console.log('📥 下载视频文件:', result.filename);
        const videoResponse = await fetch(downloadUrl);

        if (!videoResponse.ok) {
          console.error('视频下载失败:', downloadUrl);
          continue;
        }

        const videoBuffer = await videoResponse.arrayBuffer();

        // 生成唯一文件名
        const videoFilename = `infinitetalk_${promptId}_${Date.now()}.${result.filename.split('.').pop()}`;

        // 上传到Supabase存储
        if (supabase) {
          console.log('☁️ 上传视频到Supabase...');
          const { data, error } = await supabase.storage
            .from('digital-human-videos')
            .upload(videoFilename, videoBuffer, {
              contentType: result.filename.endsWith('.mp4') ? 'video/mp4' : 'image/gif'
            });

          if (error) {
            console.error('Supabase上传失败:', error);
            continue;
          }

          // 获取公共URL
          const { data: urlData } = supabase.storage
            .from('digital-human-videos')
            .getPublicUrl(videoFilename);

          finalVideoUrl = urlData.publicUrl;
          console.log('✅ 视频上传成功:', finalVideoUrl);
        } else {
          // 如果没有Supabase，使用ComfyUI直接链接
          finalVideoUrl = downloadUrl;
          console.log('⚠️ 使用ComfyUI直接链接:', finalVideoUrl);
        }

        processedFiles.push({
          type: 'video',
          url: finalVideoUrl,
          filename: result.filename,
          size: videoBuffer.byteLength
        });

        break; // 只处理第一个视频文件
      }
    }

    // 更新任务状态
    task.status = 'completed';
    task.completedAt = new Date();
    task.results = processedFiles;
    task.videoUrl = finalVideoUrl;
    task.progress = 100;

    // 保存到数据库
    if (supabase && userId) {
      try {
        const { error } = await supabase
          .from('digital_human_videos')
          .insert({
            task_id: promptId,
            user_id: userId,
            text_content: task.text,
            video_url: finalVideoUrl,
            status: 'completed',
            created_at: task.createdAt.toISOString(),
            completed_at: new Date().toISOString(),
            metadata: {
              promptId,
              clientId: task.clientId,
              results: processedFiles
            }
          });

        if (error) {
          console.error('数据库保存失败:', error);
        } else {
          console.log('✅ 结果已保存到数据库');
        }
      } catch (dbError) {
        console.error('数据库操作异常:', dbError);
      }
    }

    console.log(`🎉 任务完成: ${promptId} -> ${finalVideoUrl}`);

  } catch (error) {
    console.error('结果处理失败:', error);
    const task = activeInfiniteTalkTasks.get(promptId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
    }
    throw error;
  }
}

// 上传文件到ComfyUI
app.post('/api/xiangong/comfyui/upload', async (req, res) => {
  try {
    const multer = require('multer');
    const fs = require('fs');
    const path = require('path');

    // 配置multer用于处理文件上传
    const storage = multer.memoryStorage();
    const upload = multer({ storage }).single('file');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: '文件上传失败: ' + err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: '未找到上传文件' });
      }

      console.log('📁 上传文件到ComfyUI:', req.file.originalname);

      // 准备上传到ComfyUI
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append('image', blob, req.file.originalname);

      const uploadResponse = await fetch(`${XIANGONG_COMFYUI_URL}/upload/image`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`ComfyUI上传失败: ${uploadResponse.status}`);
      }

      const result = await uploadResponse.json();
      console.log('✅ 文件上传成功:', result);

      res.json({
        success: true,
        filename: result.name,
        subfolder: result.subfolder || '',
        type: result.type || 'input',
        message: '文件上传成功'
      });
    });

  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 查询ComfyUI可用节点类型
app.get('/api/xiangong/comfyui/nodes', async (req, res) => {
  try {
    console.log('🔍 查询ComfyUI节点类型...');

    const response = await fetch(`${XIANGONG_COMFYUI_URL}/object_info`);
    if (!response.ok) {
      throw new Error(`无法获取节点信息: ${response.status}`);
    }

    const nodeInfo = await response.json();

    // 查找TTS和数字人相关节点
    const ttsNodes = [];
    const digitalHumanNodes = [];
    const textInputNodes = [];
    const videoOutputNodes = [];

    Object.keys(nodeInfo).forEach(nodeType => {
      const info = nodeInfo[nodeType];
      const lowerType = nodeType.toLowerCase();

      if (lowerType.includes('tts') || lowerType.includes('speech') || lowerType.includes('audio')) {
        ttsNodes.push({
          type: nodeType,
          category: info.category,
          inputs: Object.keys(info.input?.required || {}),
          outputs: info.output || []
        });
      }

      if (lowerType.includes('infinitetalk') || lowerType.includes('digital') || lowerType.includes('avatar')) {
        digitalHumanNodes.push({
          type: nodeType,
          category: info.category,
          inputs: Object.keys(info.input?.required || {}),
          outputs: info.output || []
        });
      }

      if (lowerType.includes('text') && info.input?.required?.text) {
        textInputNodes.push({
          type: nodeType,
          category: info.category,
          inputs: Object.keys(info.input?.required || {}),
          outputs: info.output || []
        });
      }

      if (lowerType.includes('video') || lowerType.includes('save') || lowerType.includes('output')) {
        videoOutputNodes.push({
          type: nodeType,
          category: info.category,
          inputs: Object.keys(info.input?.required || {}),
          outputs: info.output || []
        });
      }
    });

    console.log(`✅ 找到节点: ${ttsNodes.length}个TTS, ${digitalHumanNodes.length}个数字人, ${textInputNodes.length}个文本输入`);

    res.json({
      success: true,
      data: {
        ttsNodes,
        digitalHumanNodes,
        textInputNodes,
        videoOutputNodes,
        totalNodes: Object.keys(nodeInfo).length
      },
      recommendations: {
        preferredTTS: ttsNodes.length > 0 ? ttsNodes[0].type : null,
        preferredDigitalHuman: digitalHumanNodes.length > 0 ? digitalHumanNodes[0].type : null,
        preferredTextInput: textInputNodes.length > 0 ? textInputNodes[0].type : null
      }
    });

  } catch (error) {
    console.error('节点查询失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 任务状态查询API
app.get('/api/task/status/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = activeInfiniteTalkTasks.get(taskId);

    if (!task) {
      return res.status(404).json({
        status: 'not_found',
        error: '任务未找到'
      });
    }

    res.json({
      status: task.status,
      progress: task.progress || 0,
      videoUrl: task.videoUrl,
      error: task.error,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      estimatedTimeRemaining: task.status === 'processing' ? '2-4分钟' : null,
      debug: {
        promptId: task.promptId,
        clientId: task.clientId,
        wsConnected: task.wsConnected,
        lastUpdate: task.lastUpdate
      }
    });

  } catch (error) {
    console.error('状态查询失败:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// 清理完成的任务（每小时运行）
setInterval(() => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2小时前

  let cleaned = 0;
  for (const [taskId, task] of activeInfiniteTalkTasks.entries()) {
    if (task.createdAt < cutoff && (task.status === 'completed' || task.status === 'failed')) {
      activeInfiniteTalkTasks.delete(taskId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 清理了 ${cleaned} 个已完成的任务`);
  }
}, 60 * 60 * 1000); // 每小时执行

// 仙宫云 IndexTTS2 语音合成API
app.post('/api/xiangong/indextts2', async (req, res) => {
  try {
    const { text, speaker_id, language, speed, pitch } = req.body;

    console.log('🔊 仙宫云IndexTTS2请求:', {
      textLength: text?.length,
      speaker_id,
      language,
      speed,
      pitch
    });

    if (!text) {
      return res.status(400).json({ error: '文本内容不能为空' });
    }

    if (!XIANGONG_INDEXTTS2_URL) {
      return res.status(500).json({ error: '仙宫云IndexTTS2服务地址未配置' });
    }

    // 调用仙宫云API
    const response = await fetch(`${XIANGONG_INDEXTTS2_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XIANGONG_API_KEY}`,
      },
      body: JSON.stringify({
        text,
        speaker_id: speaker_id || 0,
        language: language || 'zh-CN',
        speed: speed || 1.0,
        pitch: pitch || 0.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('仙宫云IndexTTS2错误:', response.status, errorText);
      return res.status(response.status).json({
        error: `仙宫云API调用失败: ${errorText}`
      });
    }

    const result = await response.json();
    console.log('✅ IndexTTS2合成成功:', result);

    res.json({
      success: true,
      audioUrl: result.audio_url,
      audioBase64: result.audio_data,
      message: '语音合成成功'
    });

  } catch (error) {
    console.error('IndexTTS2合成失败:', error);
    res.status(500).json({
      error: error.message || '语音合成失败'
    });
  }
});

// 仙宫云服务健康检查
app.get('/api/xiangong/health', async (req, res) => {
  try {
    if (!XIANGONG_INFINITETALK_URL || !XIANGONG_INDEXTTS2_URL) {
      return res.json({ healthy: false, error: '服务地址未配置' });
    }

    // 检查InfiniteTalk服务
    const response = await fetch(`${XIANGONG_INFINITETALK_URL}/health`, {
      headers: { 'Authorization': `Bearer ${XIANGONG_API_KEY}` }
    });

    if (response.ok) {
      const result = await response.json();
      res.json({
        healthy: true,
        services: result.available_services || ['infinitetalk', 'indextts2']
      });
    } else {
      res.json({ healthy: false, error: `服务不可用 (${response.status})` });
    }
  } catch (error) {
    res.json({ healthy: false, error: error.message });
  }
});

// A2E Digital Human Video Generation API
app.post('/api/digital-human/generate', async (req, res) => {
  try {
    const {
      userId,
      trainingId,
      textScript,
      voiceModel = 'minimax',
      emotion = 'professional',
      language = 'zh-CN',
      duration = 60,
      credits
    } = req.body;

    console.log('🎬 Digital human video generation request:', {
      userId,
      textLength: textScript?.length,
      voiceModel,
      emotion,
      language,
      duration,
      credits
    });

    // Validate required parameters
    if (!userId || !imageUrl || !textScript) {
      return res.status(400).json({
        error: 'Missing required parameters: userId, imageUrl, textScript'
      });
    }

    // Check if user has sufficient credits
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check user balance
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (userData.balance < credits) {
        return res.status(400).json({
          error: `Insufficient credits. Required: ${credits}, Available: ${userData.balance}`
        });
      }

      // Deduct credits
      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: userData.balance - credits })
        .eq('id', userId);

      if (updateError) {
        console.error('Error deducting credits:', updateError);
        return res.status(500).json({ error: 'Failed to deduct credits' });
      }

      console.log('✅ Credits deducted successfully:', { userId, credits, remainingBalance: userData.balance - credits });
    }

    // For MVP, we'll simulate A2E API call
    // In production, you would integrate with actual A2E API
    console.log('🎥 Simulating A2E API call...');

    // Simulate processing time
    const processingDelay = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, processingDelay));

    // For now, return a mock video URL
    // In production, this would be the actual A2E API response
    const mockVideoUrl = `https://mock-a2e-cdn.com/videos/${userId}_${Date.now()}.mp4`;

    console.log('✅ Digital human video generated (simulated):', mockVideoUrl);

    res.json({
      success: true,
      videoUrl: mockVideoUrl,
      status: 'completed',
      message: 'Digital human video generated successfully (simulated)',
      metadata: {
        userId,
        voiceModel,
        emotion,
        language,
        duration,
        creditsUsed: credits,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Digital human video generation error:', error);
    res.status(500).json({
      error: 'Internal server error during video generation',
      details: error.message
    });
  }
});

// A2E API Integration Helper Functions (for future implementation)
// These functions will be implemented when integrating with actual A2E API

async function uploadImageToA2E(imageUrl, a2eApiKey) {
  // TODO: Implement actual A2E image upload
  // const formData = new FormData();
  // const response = await fetch(imageUrl);
  // const buffer = await response.buffer();
  // formData.append('file', buffer, 'image.jpg');

  // const uploadResponse = await fetch('https://api.a2e.ai/upload', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${a2eApiKey}`
  //   },
  //   body: formData
  // });

  // return await uploadResponse.json();
  console.log('📤 A2E Image upload (simulated)');
  return { url: imageUrl };
}

async function generateA2EVideo(params, a2eApiKey) {
  // TODO: Implement actual A2E video generation
  // const { imageUrl, textScript, voiceModel, emotion, language } = params;

  // const payload = {
  //   image_url: imageUrl,
  //   text: textScript,
  //   voice_model: voiceModel,
  //   emotion: emotion,
  //   language: language
  // };

  // const response = await fetch('https://api.a2e.ai/generate/avatar', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${a2eApiKey}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify(payload)
  // });

  // return await response.json();
  console.log('🎬 A2E Video generation (simulated)');
  return { task_id: `task_${Date.now()}` };
}

async function checkA2EVideoStatus(taskId, a2eApiKey) {
  // TODO: Implement actual A2E status checking
  // const response = await fetch(`https://api.a2e.ai/task/${taskId}`, {
  //   headers: {
  //     'Authorization': `Bearer ${a2eApiKey}`
  //   }
  // });

  // return await response.json();
  console.log('🔍 A2E Status check (simulated)');
  return { status: 'completed', result_url: `https://mock-a2e-cdn.com/videos/${taskId}.mp4` };
}

// Video completion webhook
app.post('/api/video/webhook/complete', async (req, res) => {
  try {
    const { sessionId, finalvideourl, status = 'completed' } = req.body;

    console.log('🎬 Video webhook callback received:', { sessionId, finalvideourl, status });

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Store result in memory for polling (backwards compatibility)
    videoResults.set(sessionId, {
      sessionId,
      videoUrl: finalvideourl,
      status: status,
      timestamp: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    });

    console.log('✅ Video result stored in memory for polling:', sessionId);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log('⚠️ Database not configured, only storing in memory');
      res.json({ success: true, message: 'Video status updated in memory' });
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Complete video generation using existing balance system
    const { data: success, error: completeError } = await supabase.rpc('complete_video_generation', {
      session_id_param: sessionId,
      final_status: status,
      video_url_param: finalvideourl
    });

    if (completeError || !success) {
      console.error('Error completing video generation:', completeError);
      return res.status(500).json({ error: 'Failed to complete video generation' });
    }

    console.log('✅ Video webhook processing completed (both memory and database updated)');
    res.json({ success: true, message: 'Video status updated' });
  } catch (error) {
    console.error('Video webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 静态文件服务
app.use(express.static(path.join(dirname, 'dist')));

// SPA 路由 - 必须在所有API路由之后，只处理非API请求
app.get('*', (req, res) => {
  // 不要处理 API 请求
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
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

// 🔍 DEBUG ENDPOINT: 测试不同的Dify API调用方式
app.post('/api/debug/dify-test', async (req, res) => {
  console.log('🔍 [DEBUG] Starting comprehensive Dify API test...');

  const testMessage = req.body.message || "Hello, this is a test message to check token usage.";
  const testUser = `debug-user-${Date.now()}`;

  const results = {
    timestamp: new Date().toISOString(),
    testMessage,
    testUser,
    tests: []
  };

  // 测试1: 标准chat-messages调用
  try {
    console.log('🔍 [TEST 1] Standard chat-messages call...');
    const test1Response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: testMessage,
        user: testUser,
        conversation_id: '',
        response_mode: 'blocking'
      })
    });

    const test1Data = await test1Response.json();
    results.tests.push({
      name: 'Standard chat-messages',
      status: test1Response.status,
      success: test1Response.ok,
      data: test1Data,
      usageFound: !!(test1Data?.metadata?.usage),
      tokensFound: !!(test1Data?.metadata?.usage?.total_tokens),
      tokensValue: test1Data?.metadata?.usage?.total_tokens || 0
    });

  } catch (error) {
    results.tests.push({
      name: 'Standard chat-messages',
      success: false,
      error: error.message
    });
  }

  // 测试2: 检查app参数
  try {
    console.log('🔍 [TEST 2] App parameters...');
    const test2Response = await fetch(`${DIFY_API_URL}/parameters?user=${testUser}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const test2Data = await test2Response.json();
    results.tests.push({
      name: 'App parameters',
      status: test2Response.status,
      success: test2Response.ok,
      data: test2Data
    });

  } catch (error) {
    results.tests.push({
      name: 'App parameters',
      success: false,
      error: error.message
    });
  }

  console.log('🔍 [DEBUG] Test completed, sending results...');
  console.log('🔍 [DEBUG] Full results:', JSON.stringify(results, null, 2));
  res.json(results);
});

console.log('🚀 [BOOT 2] About to start server listening...');

app.listen(port, async () => {
  console.log('✅ [BOOT 3] Server is listening!');
  console.log(`🌐 Server is running on port ${port}`);

  console.log('🔍 [BOOT 4] Starting database health check...');

  // Perform database health check on startup
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    console.log('🔍 Performing database health check...');
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const isHealthy = await checkDatabaseHealth(supabase);

      if (!isHealthy) {
        console.error('⚠️ WARNING: Database is not healthy. Workflows may fail.');
        console.error('Please ensure database migrations have been run.');
      } else {
        console.log('✅ Database health check passed');
      }
    } catch (dbError) {
      console.error('❌ Database health check failed:', dbError);
    }
  } else {
    console.log('⚠️ Supabase not configured - database features disabled');
  }

  console.log('🎉 [BOOT 5] Server startup complete!');
});

