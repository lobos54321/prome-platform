/**
 * Dify API 集成层
 * 提供与 Dify 平台交互的所有 API 方法
 */

import axios, { AxiosInstance, AxiosError } from 'axios'

// 从环境变量读取配置
const DIFY_BASE_URL = import.meta.env.VITE_DIFY_BASE_URL || 'https://api.dify.ai'
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

export interface DifyFeedbackResponse {
  result: string
}

// 错误类型定义
export interface DifyError {
  code: string
  message: string
  status: number
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
 * Dify API 客户端类
 */
export class DifyAPIClient {
  private client: AxiosInstance
  
  constructor(baseURL?: string, apiKey?: string) {
    this.client = axios.create({
      baseURL: baseURL || DIFY_BASE_URL,
      headers: {
        'Authorization': `Bearer ${apiKey || DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30秒超时
    })
    
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Dify API] ${config.method?.toUpperCase()} ${config.url}`, config.data)
        return config
      },
      (error) => {
        console.error('[Dify API] Request error:', error)
        return Promise.reject(error)
      }
    )
    
    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Dify API] Response:`, response.data)
        return response
      },
      (error: AxiosError) => {
        const errorMessage = this.handleError(error)
        console.error('[Dify API] Response error:', errorMessage)
        return Promise.reject(new Error(errorMessage))
      }
    )
  }
  
  /**
   * 错误处理
   */
  private handleError(error: AxiosError): string {
    if (error.response) {
      const data = error.response.data as any
      return data?.message || `API Error: ${error.response.status}`
    } else if (error.request) {
      return '网络连接失败，请检查网络设置'
    } else {
      return error.message || '未知错误'
    }
  }
  
  /**
   * 发送聊天消息
   * 核心方法：使用 /v1/chat-messages 多轮对话接口
   */
  async sendChatMessage(params: SendChatMessageParams): Promise<DifyChatResponse> {
    const { conversationId, query, userId, inputs = {}, files = [] } = params
    
    try {
      const { data } = await this.client.post<DifyChatResponse>(
        '/v1/chat-messages',
        {
          conversation_id: conversationId || '',
          query,
          user: userId,
          response_mode: 'blocking',
          inputs,
          files,
        }
      )
      
      return data
    } catch (error) {
      console.error('[sendChatMessage] Error:', error)
      throw error
    }
  }
  
  /**
   * 获取会话历史消息
   */
  async getConversationMessages(params: GetMessagesParams): Promise<DifyMessageHistory> {
    const { conversationId, userId, limit = 20, firstId } = params
    
    try {
      const { data } = await this.client.get<DifyMessageHistory>(
        '/v1/messages',
        {
          params: {
            conversation_id: conversationId,
            user: userId,
            limit,
            first_id: firstId,
          },
        }
      )
      
      return data
    } catch (error) {
      console.error('[getConversationMessages] Error:', error)
      throw error
    }
  }
  
  /**
   * 提交消息反馈
   */
  async submitMessageFeedback(params: SubmitFeedbackParams): Promise<DifyFeedbackResponse> {
    const { messageId, rating, userId } = params
    
    try {
      const { data } = await this.client.post<DifyFeedbackResponse>(
        `/v1/messages/${messageId}/feedbacks`,
        {
          rating,
          user: userId,
        }
      )
      
      return data
    } catch (error) {
      console.error('[submitMessageFeedback] Error:', error)
      throw error
    }
  }
  
  /**
   * 上传文件
   */
  async uploadFile(file: File, userId: string): Promise<DifyFileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('user', userId)
    
    try {
      const { data } = await this.client.post<DifyFileUploadResponse>(
        '/v1/files/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      
      return data
    } catch (error) {
      console.error('[uploadFile] Error:', error)
      throw error
    }
  }
  
  /**
   * 停止消息生成（用于流式响应）
   */
  async stopChatMessage(taskId: string, userId: string): Promise<void> {
    try {
      await this.client.post(`/v1/chat-messages/${taskId}/stop`, {
        user: userId,
      })
    } catch (error) {
      console.error('[stopChatMessage] Error:', error)
      throw error
    }
  }
  
  /**
   * 获取应用参数（用于初始化）
   */
  async getApplicationParameters(userId: string): Promise<any> {
    try {
      const { data } = await this.client.get('/v1/parameters', {
        params: { user: userId },
      })
      return data
    } catch (error) {
      console.error('[getApplicationParameters] Error:', error)
      throw error
    }
  }
  
  /**
   * 获取应用元信息
   */
  async getApplicationMeta(userId: string): Promise<any> {
    try {
      const { data } = await this.client.get('/v1/meta', {
        params: { user: userId },
      })
      return data
    } catch (error) {
      console.error('[getApplicationMeta] Error:', error)
      throw error
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

// 默认导出
export default difyAPI
