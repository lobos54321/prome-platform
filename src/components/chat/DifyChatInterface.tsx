'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RotateCcw, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: any;
}

interface DifyChatInterfaceProps {
  className?: string;
  placeholder?: string;
  welcomeMessage?: string;
  mode?: 'chat' | 'workflow'; // 支持不同模式
}

export function DifyChatInterface({
  className,
  placeholder = "Type your message...",
  welcomeMessage = "Hello! How can I help you today?",
  mode = 'chat'
}: DifyChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 生成唯一用户ID（在生产环境应该使用真实的用户ID）
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dify_user_id');
      if (stored) return stored;
      
      const newId = `user_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('dify_user_id', newId);
      return newId;
    }
    return `user_${Math.random().toString(36).substring(2, 15)}`;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 添加欢迎消息
  useEffect(() => {
    if (messages.length === 0 && welcomeMessage) {
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [welcomeMessage]);

  // 发送消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Chat] Sending message:', {
        message: userMessage.content,
        conversationId,
        userId,
        mode
      });

      const response = await fetch('/api/dify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          user: userId,
          conversation_id: conversationId,
          mode: mode,
          inputs: {
            // 可以添加额外的输入参数
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Chat] Received response:', data);

      // 更新会话ID
      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
        console.log('[Chat] Updated conversation ID:', data.conversation_id);
      }

      // 添加助手回复
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        content: data.answer || 'Sorry, I could not process your request.',
        role: 'assistant',
        timestamp: new Date(),
        metadata: data.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[Chat] Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      
      // 添加错误消息
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // 聚焦输入框
      inputRef.current?.focus();
    }
  };

  // 开始新对话
  const handleNewConversation = () => {
    setMessages(welcomeMessage ? [{
      id: 'welcome',
      content: welcomeMessage,
      role: 'assistant',
      timestamp: new Date(),
    }] : []);
    setConversationId(null);
    setInput('');
    setError(null);
    console.log('[Chat] Started new conversation');
    inputRef.current?.focus();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-lg shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">AI Assistant</h3>
          {mode === 'workflow' && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">
              Workflow Mode
            </span>
          )}
        </div>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all"
          title="Start New Conversation"
        >
          <RotateCcw className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
            )}
            
            <div
              className={cn(
                "max-w-[70%] rounded-lg px-4 py-3",
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <span className={cn(
                "text-xs mt-2 block",
                message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
              )}>
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                <span className="text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "px-4 py-2.5 rounded-lg font-medium transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              !input.trim() || isLoading
                ? "bg-gray-300 text-gray-500"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Character count */}
        <div className="mt-2 text-xs text-gray-500 text-right">
          {input.length} / 2000 characters
        </div>
      </form>

      {/* Debug Info (仅开发环境) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2 bg-gray-100 text-xs text-gray-600 border-t space-y-1">
          <div>Mode: {mode}</div>
          <div>User ID: {userId}</div>
          <div>Conversation ID: {conversationId || 'None'}</div>
          <div>Messages: {messages.length}</div>
        </div>
      )}
    </div>
  );
}

// 导出默认配置的聊天组件
export function ChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] z-50">
      <DifyChatInterface 
        className="h-full"
        welcomeMessage="Hi! I'm your AI assistant. How can I help you today?"
      />
    </div>
  );
}
