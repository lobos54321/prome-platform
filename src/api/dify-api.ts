import axios from 'axios'

const BASE_URL = import.meta.env.VITE_DIFY_BASE_URL || 'https://api.dify.ai'
const API_KEY = import.meta.env.VITE_DIFY_API_KEY || ''

// 创建 axios 实例
const difyClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// 请求拦截器
difyClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加请求日志
    console.log(`[Dify API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('[Dify API] Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
difyClient.interceptors.response.use(
  (response) => {
    console.log(`[Dify API] Response:`, response.data)
    return response
  },
  (error) => {
    console.error('[Dify API] Response error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// 类型定义
export interface SendChatParams {
  conversationId?: string
  query: string
  userId: string
}

export interface ChatResponse {
  conversation_id: string
  message_id: string
  answer: string
  created_at?: number
  metadata?: Record<string, any>
}

export interface FileUploadParams {
  file: File
  userId: string
}

export interface FileUploadResponse {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
  created_by: string
  created_at: number
}

/**
 * 发送聊天消息 - 使用多轮对话接口
 * 关键改动：从 /workflows/run 改为 /chat-messages
 */
export async function sendChatMessage({
  conversationId,
  query,
  userId,
}: SendChatParams): Promise<ChatResponse> {
  try {
    const { data } = await difyClient.post('/v1/chat-messages', {
      conversation_id: conversationId || '',
      query,
      user: userId,
      response_mode: 'blocking',
      inputs: {}, // 如果需要传递额外参数可以在这里添加
    })
    
    return data
  } catch (error) {
    console.error('[sendChatMessage] Error:', error)
    throw error
  }
}

/**
 * 上传文件到 Dify
 */
export async function uploadFile({
  file,
  userId,
}: FileUploadParams): Promise<FileUploadResponse> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('user', userId)

    const { data } = await difyClient.post('/v1/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return data
  } catch (error) {
    console.error('[uploadFile] Error:', error)
    throw error
  }
}

/**
 * 获取会话历史消息
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<any> {
  try {
    const { data } = await difyClient.get('/v1/messages', {
      params: {
        conversation_id: conversationId,
        user: userId,
        limit: 100,
      },
    })
    
    return data
  } catch (error) {
    console.error('[getConversationMessages] Error:', error)
    throw error
  }
}

/**
 * 停止消息生成（用于流式响应）
 */
export async function stopMessageGeneration(
  taskId: string,
  userId: string
): Promise<void> {
  try {
    await difyClient.post(`/v1/chat-messages/${taskId}/stop`, {
      user: userId,
    })
  } catch (error) {
    console.error('[stopMessageGeneration] Error:', error)
    throw error
  }
}

/**
 * 创建新会话
 */
export async function createNewConversation(userId: string): Promise<string> {
  // 发送一个空消息来创建新会话
  const response = await sendChatMessage({
    query: '开始新会话',
    userId,
  })
  return response.conversation_id
}

/**
 * 消息反馈
 */
export async function submitMessageFeedback(
  messageId: string,
  rating: 'like' | 'dislike',
  userId: string
): Promise<void> {
  try {
    await difyClient.post(`/v1/messages/${messageId}/feedbacks`, {
      rating,
      user: userId,
    })
  } catch (error) {
    console.error('[submitMessageFeedback] Error:', error)
    throw error
  }
}

export default {
  sendChatMessage,
  uploadFile,
  getConversationMessages,
  stopMessageGeneration,
  createNewConversation,
  submitMessageFeedback,
}
