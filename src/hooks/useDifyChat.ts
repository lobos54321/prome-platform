import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

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
  
  // 持久化消息 - 修复：确保数据完整性
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // 确保所有消息都有必要的字段
        const validMessages = messages.map(msg => ({
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp || Date.now(),
          metadata: msg.metadata || {}
        }))
        localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(validMessages))
      } catch (error) {
        console.error('Failed to save messages to cache:', error)
      }
    } else {
      localStorage.removeItem(MESSAGES_CACHE_KEY)
    }
  }, [messages])
  
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
      // 🎯 使用后端server.js接口，包含预热机制
      const backendEndpoint = convId 
        ? `/api/dify/${convId}` // 使用现有会话的blocking endpoint
        : '/api/dify' // 新会话使用generic endpoint
        
      const response = await fetch(backendEndpoint, {
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
        signal: abortControllerRef.current.signal,
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
    
    // 立即显示用户消息
    setMessages(prev => [...prev, userMessage])
    
    // 添加加载占位消息
    const loadingMessage: DifyMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '正在思考中...',
      timestamp: Date.now(), // 确保这里是数字
      metadata: { loading: true },
    }
    setMessages(prev => [...prev, loadingMessage])
    
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
      
      // 替换加载消息为实际回复
      setMessages(prev => 
        prev.filter(m => m.id !== loadingMessage.id).concat(assistantMessage)
      )
      
    } catch (err: any) {
      console.error('[useDifyChat] Send message error:', err)
      
      // 处理中断错误
      if (err.name === 'AbortError') {
        setMessages(prev => prev.filter(m => m.id !== loadingMessage.id))
        return
      }
      
      const errorMessage = err.message || '发送失败，请重试'
      setError(errorMessage)
      
      // 显示错误消息
      const errorMsg: DifyMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，遇到了错误：${errorMessage}\n\n请点击重试或开始新对话。`,
        timestamp: Date.now(), // 确保这里是数字
        metadata: { error: true },
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
  
  // 组件卸载时中断请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  return {
    messages,
    conversationId,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    resetConversation,
    retryLastMessage,
  }
}

// 导出默认
export default useDifyChat
