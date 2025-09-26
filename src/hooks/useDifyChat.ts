import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useDebouncedCallback } from './useDebouncedCallback'
import { apiRequestQueue } from '@/lib/apiRequestQueue'

// API 配置 - 通过后端server.js代理，包含预热机制
// 不再直接调用 Dify API，而是使用后端endpoints

// 消息类型定义
export interface DifyMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    messageId?: string
    error?: boolean
    loading?: boolean
  }
}

// API 响应类型
interface DifyChatResponse {
  conversation_id: string
  message_id: string
  answer: string
  created_at?: number
  metadata?: Record<string, any>
}

// Hook 返回类型
export interface UseDifyChatReturn {
  messages: DifyMessage[]
  conversationId: string | undefined
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  resetConversation: () => void
  retryLastMessage: () => Promise<void>
  // New pagination methods
  loadMoreMessages: () => Promise<void>
  hasMoreMessages: boolean
  isLoadingMore: boolean
}

// localStorage 键名
const CONVERSATION_KEY = 'dify_conversation_id'
const MESSAGES_CACHE_KEY = 'dify_messages_cache'

/**
 * useDifyChat Hook - 管理与后端 Dify 代理的对话
 * 🔧 核心修复：通过后端server.js预热机制，解决dialogue_count偏移问题
 * 不再直接调用 Dify API，而是使用包含warmup机制的后端endpoints
 */
export function useDifyChat(
  userId: string = 'default-user'
): UseDifyChatReturn {
  // 状态管理 - 修复：确保 timestamp 始终有值
  const [messages, setMessages] = useState<DifyMessage[]>(() => {
    try {
      const cached = localStorage.getItem(MESSAGES_CACHE_KEY)
      if (cached) {
        const parsedMessages = JSON.parse(cached)
        // 确保每个消息都有有效的 timestamp
        return parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp || Date.now()
        }))
      }
      return []
    } catch (error) {
      console.error('Failed to parse cached messages:', error)
      return []
    }
  })
  
  // 🔧 新增：消息分页状态
  const [messagesPagination, setMessagesPagination] = useState({
    hasMore: false,
    isLoadingMore: false,
    currentPage: 0,
    totalMessages: 0,
    messagesPerPage: 50
  })
  
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    const stored = localStorage.getItem(CONVERSATION_KEY)
    if (stored && stored !== 'undefined' && stored !== 'null') {
      console.log('[Chat Debug] Restored conversation ID from localStorage:', stored)
      return stored
    }
    return undefined
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastUserMessageRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // 持久化会话ID - 修复：避免存储 undefined
  useEffect(() => {
    if (conversationId && conversationId !== 'undefined') {
      localStorage.setItem(CONVERSATION_KEY, conversationId)
    } else {
      localStorage.removeItem(CONVERSATION_KEY)
    }
  }, [conversationId])
  
  // 🔧 防抖的缓存函数，避免频繁写入localStorage
  const debouncedCacheMessages = useDebouncedCallback((messagesToCache: DifyMessage[]) => {
    try {
      // 确保所有消息都有必要的字段
      const validMessages = messagesToCache.map(msg => ({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role || 'user',
        content: msg.content || '',
        timestamp: msg.timestamp || Date.now(),
        metadata: msg.metadata ? { 
          // 只保存必要的元数据，避免存储过大的对象
          messageId: msg.metadata.messageId,
          error: msg.metadata.error,
          loading: msg.metadata.loading
        } : {}
      }))
      
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(validMessages))
    } catch (error) {
      console.error('Failed to save messages to cache:', error)
      // 🔧 缓存失败时清理localStorage避免残留
      try {
        localStorage.removeItem(MESSAGES_CACHE_KEY)
      } catch (cleanupError) {
        console.error('Failed to cleanup cache:', cleanupError)
      }
    }
  }, 500, []);

  // 持久化消息 - 修复：确保数据完整性 + 内存优化 + 防抖
  useEffect(() => {
    if (messages.length > 0) {
      // 🔧 内存优化：限制缓存的消息数量，避免无限制增长
      const MAX_CACHED_MESSAGES = 100; // 最多缓存100条消息
      const messagesToCache = messages.slice(-MAX_CACHED_MESSAGES);
      
      // 使用防抖缓存，避免频繁写入
      debouncedCacheMessages(messagesToCache);
    } else {
      localStorage.removeItem(MESSAGES_CACHE_KEY)
    }
  }, [messages, debouncedCacheMessages])
  
  /**
   * 调用后端 Dify Chat API
   * 🔧 关键修复：使用后端server.js的预热机制，而不是直接调用Dify API
   */
  const callDifyAPI = async (
    query: string,
    convId?: string
  ): Promise<DifyChatResponse> => {
    abortControllerRef.current = new AbortController()
    
    try {
      // 🎯 使用后端server.js接口，包含预热机制 + 请求队列优化
      const backendEndpoint = convId 
        ? `/api/dify/${convId}` // 使用现有会话的blocking endpoint
        : '/api/dify' // 新会话使用generic endpoint
        
      const response = await apiRequestQueue.enqueue(backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query, // 🔧 修复：使用query字段，符合DIFY API规范
          user: userId,
          conversation_id: convId || '', // 后端server.js需要的字段
          inputs: {
            // 🔧 修复：传递空的inputs让DIFY自行管理conversation variables
            // DIFY chatflow会自动维护：
            // - conversation_info_completeness (信息完整度)
            // - conversation_collection_count (收集计数)
            // - dialogue_count (对话轮数)
            // - 其他workflow中定义的变量
          },
          response_mode: 'blocking', // 🔧 明确指定blocking模式
          stream: false
        }),
        signal: abortControllerRef.current?.signal,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API Error: ${response.status}`)
      }
      
      const data = await response.json()
      // 确保返回的数据有必要的字段 - 适配后端响应格式
      return {
        conversation_id: data.conversation_id || '',
        message_id: data.message_id || '',
        answer: data.answer || data.response || '', // 后端可能使用response字段
        created_at: data.created_at || Date.now() / 1000,
        metadata: data.metadata || {}
      }
    } catch (error) {
      console.error('[callDifyAPI] Error:', error)
      throw error
    }
  }
  
  /**
   * 发送消息
   * 核心改动：移除所有本地条件判断，完全交给 Dify Chatflow
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content || !content.trim() || isLoading) {
      console.warn('[sendMessage] Invalid input or already loading')
      return
    }
    
    // 保存最后的用户消息（用于重试）
    lastUserMessageRef.current = content.trim()
    
    setIsLoading(true)
    setError(null)
    
    // 生成用户消息 - 确保有有效的 timestamp
    const userMessage: DifyMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(), // 确保这里是数字
    }
    
    // 🔧 优化：批量更新消息以减少渲染次数
    const loadingMessage: DifyMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '正在思考中...',
      timestamp: Date.now(),
      metadata: { loading: true },
    }
    
    setMessages(prev => [...prev, userMessage, loadingMessage])
    
    try {
      // 调用 Dify API
      console.log('[useDifyChat] Sending message:', {
        conversationId,
        query: content.trim(),
        userId,
      })
      
      const response = await callDifyAPI(content.trim(), conversationId)
      
      console.log('[useDifyChat] Received response:', response)
      
      // 更新会话ID（首次对话时会返回新ID）
      if (response.conversation_id && 
          response.conversation_id !== 'undefined' && 
          response.conversation_id !== conversationId) {
        setConversationId(response.conversation_id)
        console.log('[useDifyChat] New conversation ID:', response.conversation_id)
      }
      
      // 创建助手消息 - 确保有有效的 timestamp
      const assistantMessage: DifyMessage = {
        id: `assistant-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: response.answer || '抱歉，我没有理解您的意思。',
        timestamp: response.created_at ? response.created_at * 1000 : Date.now(), // 转换为毫秒
        metadata: {
          messageId: response.message_id,
        },
      }
      
      // 🔧 优化：使用 map 替代 filter+concat 以提高性能
      setMessages(prev => 
        prev.map(msg => msg.id === loadingMessage.id ? assistantMessage : msg)
      )
      
    } catch (err: any) {
      console.error('[useDifyChat] Send message error:', err)
      
      // 处理中断错误
      if (err.name === 'AbortError') {
        setMessages(prev => prev.filter(m => m.id !== loadingMessage.id))
        return
      }
      
      // 🔧 增强的错误分类和处理
      let errorMessage = '发送失败，请重试'
      let errorType = 'general'
      
      if (err.message) {
        if (err.message.includes('Network')) {
          errorMessage = '网络连接失败，请检查网络设置'
          errorType = 'network'
        } else if (err.message.includes('401')) {
          errorMessage = '认证失败，请重新登录'
          errorType = 'auth'
        } else if (err.message.includes('429')) {
          errorMessage = '请求过于频繁，请稍后再试'
          errorType = 'rate_limit'
        } else if (err.message.includes('500')) {
          errorMessage = '服务器错误，请稍后重试'
          errorType = 'server'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      
      // 显示错误消息
      const errorMsg: DifyMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，遇到了错误：${errorMessage}\n\n请点击重试或开始新对话。`,
        timestamp: Date.now(),
        metadata: { 
          error: true, 
          errorType,
          retryable: ['network', 'server', 'rate_limit'].includes(errorType)
        },
      }
      
      // 替换加载消息为错误消息
      setMessages(prev => 
        prev.filter(m => m.id !== loadingMessage.id).concat(errorMsg)
      )
      
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [conversationId, userId])
  
  /**
   * 清空消息（保留会话）
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    localStorage.removeItem(MESSAGES_CACHE_KEY)
    toast.success('消息已清空')
  }, [])
  
  /**
   * 重置会话（清空消息和会话ID）
   */
  const resetConversation = useCallback(() => {
    // 中断正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setMessages([])
    setConversationId(undefined)
    setError(null)
    localStorage.removeItem(CONVERSATION_KEY)
    localStorage.removeItem(MESSAGES_CACHE_KEY)
    lastUserMessageRef.current = ''
    
    console.log('[useDifyChat] Conversation reset')
    toast.success('已开始新对话')
  }, [])
  
  /**
   * 重试最后一条消息
   */
  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) {
      toast.error('没有可重试的消息')
      return
    }
    
    // 移除最后的错误消息
    setMessages(prev => {
      const filtered = [...prev]
      // 从后往前找到第一个错误消息并移除
      for (let i = filtered.length - 1; i >= 0; i--) {
        if (filtered[i].metadata?.error) {
          filtered.splice(i, 1)
          break
        }
      }
      return filtered
    })
    
    // 重新发送
    await sendMessage(lastUserMessageRef.current)
  }, [sendMessage])
  
  // 🔧 增强的清理机制：组件卸载和页面隐藏时清理
  useEffect(() => {
    const cleanup = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
    
    // 页面隐藏时清理（防止后台运行）
    const handleVisibilityChange = () => {
      if (document.hidden && abortControllerRef.current) {
        console.log('[useDifyChat] Page hidden, aborting requests')
        cleanup()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      cleanup()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  
  // 🔧 定期清理localStorage，防止无限制增长
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        // 检查localStorage使用量
        const storageUsed = JSON.stringify(localStorage).length
        if (storageUsed > 5 * 1024 * 1024) { // 超过5MB时清理旧数据
          console.warn('[useDifyChat] localStorage size exceeded 5MB, cleaning old data')
          const keys = Object.keys(localStorage)
          const messageKeys = keys.filter(key => key.startsWith('dify_messages_'))
          if (messageKeys.length > 5) {
            // 只保留最近5个会话的消息
            messageKeys.slice(0, -5).forEach(key => localStorage.removeItem(key))
          }
        }
      } catch (error) {
        console.error('[useDifyChat] localStorage cleanup error:', error)
      }
    }, 5 * 60 * 1000) // 每5分钟检查一次
    
    return () => clearInterval(interval)
  }, [])
  
  /**
   * 加载更多历史消息
   */
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || messagesPagination.isLoadingMore || !messagesPagination.hasMore) {
      return;
    }
    
    setMessagesPagination(prev => ({ ...prev, isLoadingMore: true }));
    
    try {
      // Import cloudChatHistory dynamically to avoid circular imports
      const { cloudChatHistory } = await import('@/lib/cloudChatHistory');
      
      const nextPage = messagesPagination.currentPage + 1;
      const offset = nextPage * messagesPagination.messagesPerPage;
      
      // Load more messages from cloud history
      const conversation = await cloudChatHistory.getConversationWithMessages(
        conversationId,
        messagesPagination.messagesPerPage,
        offset
      );
      
      if (conversation && conversation.messages.length > 0) {
        // Convert cloud messages to DifyMessage format
        const cloudMessages: DifyMessage[] = conversation.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          metadata: msg.metadata
        }));
        
        // Prepend older messages to the beginning
        setMessages(prev => [...cloudMessages, ...prev]);
        
        // Update pagination state
        setMessagesPagination(prev => ({
          ...prev,
          currentPage: nextPage,
          hasMore: conversation.messages.length === messagesPagination.messagesPerPage,
          isLoadingMore: false
        }));
        
        console.log(`[useDifyChat] Loaded ${cloudMessages.length} more messages`);
        toast.success(`加载了 ${cloudMessages.length} 条历史消息`);
      } else {
        // No more messages available
        setMessagesPagination(prev => ({
          ...prev,
          hasMore: false,
          isLoadingMore: false
        }));
        
        toast.info('已加载全部历史消息');
      }
    } catch (error) {
      console.error('[useDifyChat] Failed to load more messages:', error);
      setMessagesPagination(prev => ({ ...prev, isLoadingMore: false }));
      toast.error('加载历史消息失败');
    }
  }, [conversationId, messagesPagination]);

  return {
    messages,
    conversationId,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    resetConversation,
    retryLastMessage,
    // Pagination support
    loadMoreMessages,
    hasMoreMessages: messagesPagination.hasMore,
    isLoadingMore: messagesPagination.isLoadingMore,
  }
}

// 导出默认
export default useDifyChat
