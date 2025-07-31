import React, { useState, useEffect } from 'react'

interface Message {
  id: string
  content: string
  role: 'assistant' | 'user'
  timestamp: Date
}

export default function DifyChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  useEffect(() => {
    // 从 localStorage 读取 conversationId 和历史消息
    const savedId = localStorage.getItem('dify-conversation-id')
    const savedMessages = localStorage.getItem('dify-messages')
    if (savedId) setConversationId(savedId)
    if (savedMessages) setMessages(JSON.parse(savedMessages))
  }, [])

  const handleSend = async () => {
    if (!input.trim()) return
    setIsLoading(true)
    setError(null)

    // 先添加用户消息到列表
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      role: 'user',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/dify/' + (conversationId || ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversationId: conversationId || undefined,
          user: 'user-123' // 可以换成真实用户ID
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const data = await response.json()

      // 添加助手回复
      const assistantMessage: Message = {
        id: data.message_id || `assistant-${Date.now()}`,
        content: data.answer,
        role: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      // 更新对话ID
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id)
        localStorage.setItem('dify-conversation-id', data.conversation_id)
      }

      // 保存历史消息
      localStorage.setItem('dify-messages', JSON.stringify([...messages, userMessage, assistantMessage]))
    } catch (error: any) {
      console.error('Error sending message:', error)
      setError(error.message)

      // 移除用户消息，因为发送失败
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id))

      // 如果是 404 错误，清除对话
      if (error.message.includes('404') || error.message.includes('Not Exists')) {
        handleClearConversation()
        setError('对话已过期，已自动为你新建会话，请重试刚才的问题')
        // 可选：这里可以自动重试本次消息
        // handleSend()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearConversation = () => {
    localStorage.removeItem('dify-conversation-id')
    localStorage.removeItem('dify-messages')
    setConversationId(null)
    setMessages([])
    setError(null)
  }

  return (
    <div className="w-full max-w-4xl mx-auto h-[600px] flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">AI 助手</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <span>{msg.role === 'user' ? '我: ' : '助手: '}{msg.content}</span>
          </div>
        ))}
        {isLoading && <div>正在生成回复...</div>}
        {error && <div className="text-red-500">{error}</div>}
      </div>
      <div className="p-4 border-t flex">
        <input
          className="flex-1 border rounded p-2"
          placeholder="请输入问题"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSend()
          }}
          disabled={isLoading}
        />
        <button
          className="ml-2 px-4 py-2 rounded bg-blue-600 text-white"
          onClick={handleSend}
          disabled={isLoading}
        >
          发送
        </button>
        <button
          className="ml-2 px-4 py-2 rounded bg-gray-400 text-white"
          onClick={handleClearConversation}
        >
          清空对话
        </button>
      </div>
    </div>
  )
}
