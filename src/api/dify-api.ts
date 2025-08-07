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

export interface DifyUsageStats {
  totalMessages: number
  totalTokens: number
  totalConversations: number
  totalRequests: number
  promptTokens: number
  completionTokens: number
  lastUpdated: string
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
   */
  async sendChatMessage(params: SendChatMessageParams): Promise<DifyChatResponse> {
    const body = {
      inputs: params.inputs || {},
      query: params.query,
      response_mode: 'blocking',
      conversation_id: params.conversationId || '',
      user: params.userId,
      files: params.files || [],
    }
    
    return this.request<DifyChatResponse>('/v1/chat-messages', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
  
  /**
   * 发送聊天消息（流式）
   */
  async sendChatMessageStream(params: SendChatMessageParams): Promise<Response> {
    const body = {
      inputs: params.inputs || {},
      query: params.query,
      response_mode: 'streaming',
      conversation_id: params.conversationId || '',
      user: params.userId,
      files: params.files || [],
    }
    
    const url = `${this.baseURL}/v1/chat-messages`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Stream API Error: ${response.status}`)
    }
    
    return response
  }
  
  /**
   * 获取会话消息列表
   */
  async getConversationMessages(params: GetMessagesParams): Promise<DifyMessageHistory> {
    const queryParams = new URLSearchParams({
      user: params.userId,
      limit: String(params.limit || 20),
      ...(params.firstId && { first_id: params.firstId }),
    })
    
    return this.request<DifyMessageHistory>(
      `/v1/messages?${queryParams}`,
      { method: 'GET' }
    )
  }
  
  /**
   * 提交消息反馈
   */
  async submitMessageFeedback(params: SubmitFeedbackParams): Promise<void> {
    await this.request(`/v1/messages/${params.messageId}/feedbacks`, {
      method: 'POST',
      body: JSON.stringify({
        rating: params.rating,
        user: params.userId,
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
  
  /**
   * 获取使用统计信息
   */
  async getUsageStats(userId: string): Promise<DifyUsageStats> {
    try {
      // 这里可以调用 Dify 的统计 API（如果有的话）
      // 或者从本地存储获取统计信息
      const stats = localStorage.getItem('dify_usage_stats')
      if (stats) {
        const parsedStats = JSON.parse(stats)
        // 确保返回的数据包含所有必需的属性
        return {
          totalMessages: parsedStats.totalMessages || 0,
          totalTokens: parsedStats.totalTokens || 0,
          totalConversations: parsedStats.totalConversations || 0,
          totalRequests: parsedStats.totalRequests || 0,
          promptTokens: parsedStats.promptTokens || 0,
          completionTokens: parsedStats.completionTokens || 0,
          lastUpdated: parsedStats.lastUpdated || new Date().toISOString(),
        }
      }
      
      // 返回默认值
      return {
        totalMessages: 0,
        totalTokens: 0,
        totalConversations: 0,
        totalRequests: 0,
        promptTokens: 0,
        completionTokens: 0,
        lastUpdated: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[getUsageStats] Error:', error)
      return {
        totalMessages: 0,
        totalTokens: 0,
        totalConversations: 0,
        totalRequests: 0,
        promptTokens: 0,
        completionTokens: 0,
        lastUpdated: new Date().toISOString(),
      }
    }
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

/**
 * 检查 Dify 是否启用
 * @returns boolean
 */
export const isDifyEnabled = (): boolean => {
  const apiKey = import.meta.env.VITE_DIFY_API_KEY
  const apiUrl = import.meta.env.VITE_DIFY_API_URL
  
  return !!(apiKey && apiUrl && apiKey !== '' && apiUrl !== '')
}

/**
 * 获取 Dify 使用统计
 * @param userId 用户ID
 * @returns Promise<DifyUsageStats>
 */
export const getDifyUsageStats = async (userId: string = 'default-user'): Promise<DifyUsageStats> => {
  return difyAPI.getUsageStats(userId)
}

// 默认导出
export default difyAPI
