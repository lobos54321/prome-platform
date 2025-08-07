/**
 * Dify API 集成层 - 使用原生 fetch，不依赖 axios
 */

// 从环境变量读取配置
const DIFY_BASE_URL = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai'
const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY || ''

// API 响应类型定义
export interface DifyChatResponse {
  conversation_id: string
  message_id: string
  answer: string
  created_at: number
  metadata?: Record<string, any>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface DifyFileUploadResponse {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
  created_by: string
  created_at: number
}

export interface DifyMessageHistory {
  data: Array<{
    id: string
    conversation_id: string
    inputs: Record<string, any>
    query: string
    answer: string
    message_files: any[]
    feedback: null | { rating: string }
    retriever_resources: any[]
    created_at: number
  }>
  has_more: boolean
  limit: number
}

// 请求参数类型定义
export interface SendChatMessageParams {
  conversationId?: string
  query: string
  userId: string
  inputs?: Record<string, any>
  files?: Array<{
    type: string
    transfer_method: string
    url?: string
    upload_file_id?: string
  }>
}

export interface GetMessagesParams {
  conversationId: string
  userId: string
  limit?: number
  firstId?: string
}

export interface SubmitFeedbackParams {
  messageId: string
  rating: 'like' | 'dislike' | null
  userId: string
}

/**
 * Dify API 客户端类 - 使用原生 fetch
 */
export class DifyAPIClient {
  private baseURL: string
  private apiKey: string
  
  constructor(baseURL?: string, apiKey?: string) {
    this.baseURL = baseURL || DIFY_BASE_URL
    this.apiKey = apiKey || DIFY_API_KEY
  }
  
  /**
   * 基础请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const defaultHeaders = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    }
    
    console.log(`[Dify API] ${config.method || 'GET'} ${url}`)
    
    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API Error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`[Dify API] Response:`, data)
      return data as T
    } catch (error: any) {
      console.error('[Dify API] Request error:', error)
      throw error
    }
  }
  
  /**
   * 发送聊天消息
   * 核心方法：使用 /v1/chat-messages 多轮对话接口
   */
  async sendChatMessage(params: SendChatMessageParams): Promise<DifyChatResponse> {
    const { conversationId, query, userId, inputs = {}, files = [] } = params
    
    return this.request<DifyChatResponse>('/v1/chat-messages', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId || '',
        query,
        user: userId,
        response_mode: 'blocking',
        inputs,
        files,
      }),
    })
  }
  
  /**
   * 获取会话历史消息
   */
  async getConversationMessages(params: GetMessagesParams): Promise<DifyMessageHistory> {
    const { conversationId, userId, limit = 20, firstId } = params
    
    const queryParams = new URLSearchParams({
      conversation_id: conversationId,
      user: userId,
      limit: limit.toString(),
    })
    
    if (firstId) {
      queryParams.append('first_id', firstId)
    }
    
    return this.request<DifyMessageHistory>(`/v1/messages?${queryParams}`, {
      method: 'GET',
    })
  }
  
  /**
   * 提交消息反馈
   */
  async submitMessageFeedback(params: SubmitFeedbackParams): Promise<{ result: string }> {
    const { messageId, rating, userId } = params
    
    return this.request(`/v1/messages/${messageId}/feedbacks`, {
      method: 'POST',
      body: JSON.stringify({
        rating,
        user: userId,
      }),
    })
  }
  
  /**
   * 上传文件
   */
  async uploadFile(file: File, userId: string): Promise<DifyFileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('user', userId)
    
    const response = await fetch(`${this.baseURL}/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Upload failed: ${response.status}`)
    }
    
    return response.json()
  }
  
  /**
   * 停止消息生成（用于流式响应）
   */
  async stopChatMessage(taskId: string, userId: string): Promise<void> {
    await this.request(`/v1/chat-messages/${taskId}/stop`, {
      method: 'POST',
      body: JSON.stringify({
        user: userId,
      }),
    })
  }
  
  /**
   * 获取应用参数（用于初始化）
   */
  async getApplicationParameters(userId: string): Promise<any> {
    const queryParams = new URLSearchParams({ user: userId })
    return this.request(`/v1/parameters?${queryParams}`, {
      method: 'GET',
    })
  }
  
  /**
   * 获取应用元信息
   */
  async getApplicationMeta(userId: string): Promise<any> {
    const queryParams = new URLSearchParams({ user: userId })
    return this.request(`/v1/meta?${queryParams}`, {
      method: 'GET',
    })
  }
}

// 创建默认实例
export const difyAPI = new DifyAPIClient()

// 导出便捷方法
export const sendChatMessage = (params: SendChatMessageParams) => 
  difyAPI.sendChatMessage(params)

export const getConversationMessages = (params: GetMessagesParams) => 
  difyAPI.getConversationMessages(params)

export const submitMessageFeedback = (params: SubmitFeedbackParams) => 
  difyAPI.submitMessageFeedback(params)

export const uploadFile = (file: File, userId: string) => 
  difyAPI.uploadFile(file, userId)

// 默认导出
export default difyAPI
