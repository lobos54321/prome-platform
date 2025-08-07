import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

// API 配置
const DIFY_API_URL = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai'
const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY || ''

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
 * useDifyChat Hook - 管理与 Dify API 的对话
 * 核心改动：使用 /v1/chat-messages 多轮对话接口，而不是 /workflows/run
 */
export function useDifyChat(
  userId: string = 'default-user'
): UseDifyChatReturn {
  // 状态管理
  const [messages, setMessages] = useState<DifyMessage[]>(() => {
    try {
      const cached = localStorage.getItem(MESSAGES_CACHE_KEY)
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    return localStorage.getItem(CONVERSATION_KEY) || undefined
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastUserMessageRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // 持久化会话ID
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONVERSATION_KEY, conversationId)
    } else {
      localStorage.removeItem(CONVERSATION_KEY)
    }
  }, [conversationId])
  
  // 持久化消息
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(messages))
    } else {
      localStorage.removeItem(MESSAGES_CACHE_KEY)
    }
  }, [messages])
  
  /**
   * 调用 Dify Chat API
   * 关键：使用 /v1/chat-messages 而不是 /workflows/run
   */
  const callDifyAPI = async (
    query: string,
    convId?: string
  ): Promise<DifyChatResponse> => {
    abortControllerRef.current = new AbortController()
    
    const response = await fetch(`${DIFY_API_URL}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: convId || '',
        query: query,
        user: userId,
        response_mode: 'blocking',
        inputs: {}, // 额外输入参数（如果需要）
      }),
      signal: abortControllerRef.current.signal,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `API Error: ${response.status}`)
    }
    
    return await response.json()
  }
  
  /**
   * 发送消息
   * 核心改动：移除所有本地条件判断，完全交给 Dify Chatflow
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) {
      return
    }
    
    // 保存最后的用户消息（用于重试）
    lastUserMessageRef.current = content.trim()
    
    setIsLoading(true)
    setError(null)
    
    // 生成用户消息
    const userMessage: DifyMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }
    
    // 立即显示用户消息
    setMessages(prev => [...prev, userMessage])
    
    // 添加加载占位消息
    const loadingMessage: DifyMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '正在思考中...',
      timestamp: Date.now(),
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
      if (response.conversation_id && response.conversation_id !== conversationId) {
        setConversationId(response.conversation_id)
        console.log('[useDifyChat] New conversation ID:', response.conversation_id)
      }
      
      // 创建助手消息
      const assistantMessage: DifyMessage = {
        id: `assistant-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: response.answer || '抱歉，我没有理解您的意思。',
        timestamp: Date.now(),
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
        timestamp: Date.now(),
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
