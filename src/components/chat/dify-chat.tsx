import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, Bot, User, RefreshCw, Trash2, AlertCircle, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface DifyChatProps {
  className?: string;
}

export function DifyChat({ className }: DifyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('dify-messages');
    const savedConversationId = localStorage.getItem('dify-conversation-id');
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed)) {
          setMessages(parsed.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        }
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
        localStorage.removeItem('dify-messages');
      }
    }
    
    if (savedConversationId) {
      setConversationId(savedConversationId);
    }
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('复制失败');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const messageText = input.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: messageText,
      role: 'user',
      timestamp: new Date()
    };

    setInput('');
    setIsLoading(true);
    setError(null);
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/dify/' + (conversationId || ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          conversationId: conversationId || undefined,
          user: 'user-123' // 可以换成真实用户ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();

      // 添加助手回复
      const assistantMessage: Message = {
        id: data.message_id || `assistant-${Date.now()}`,
        content: data.answer,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 更新对话ID
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
        localStorage.setItem('dify-conversation-id', data.conversation_id);
      }

      // 保存历史消息
      const updatedMessages = [...messages, userMessage, assistantMessage];
      localStorage.setItem('dify-messages', JSON.stringify(updatedMessages));
      
      // 重置重试计数
      setRetryCount(0);

    } catch (error: unknown) {
      console.error('Error sending message:', error);
      
      // 移除用户消息，因为发送失败
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));

      // 增加重试计数
      setRetryCount(prev => prev + 1);

      // 处理不同类型的错误
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('404') || 
          errorMessage.includes('Not Exists') || 
          errorMessage.includes('Conversation ID format error') ||
          errorMessage.includes('conversation not found')) {
        
        console.log('🔄 Conversation expired, clearing conversation state...');
        handleClearConversation();
        setError('对话已过期，已自动为你新建会话，请重试刚才的问题');
        
        // 自动重试一次（如果重试次数不超过2次）
        if (retryCount < 2) {
          setTimeout(() => {
            setInput(messageText);
            toast.info('正在自动重试...');
          }, 1000);
        }
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        setError('请求过于频繁，请稍后再试');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('网络连接失败，请检查网络连接后重试');
      } else {
        setError(errorMessage || '发送消息失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setRetryCount(0);
    localStorage.removeItem('dify-messages');
    localStorage.removeItem('dify-conversation-id');
    
    // 清除工作流相关的状态
    localStorage.removeItem('dify_conversation_id');
    sessionStorage.removeItem('dify_conversation_id');
    localStorage.removeItem('dify_workflow_state');
    
    console.log('🧹 Cleared conversation and workflow state');
    toast.success('对话已清空');
  };

  const handleNewConversation = () => {
    if (window.confirm('确定要开始新对话吗？当前对话内容将被清空。')) {
      handleClearConversation();
    }
  };

  const handleRetry = () => {
    if (error && !isLoading) {
      setError(null);
      // 重新发送最后一条用户消息
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.role === 'user');
      
      if (lastUserMessage) {
        setInput(lastUserMessage.content);
        toast.info('已恢复最后一条消息，请重新发送');
      }
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const MessageItem = ({ message }: { message: Message }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      await copyToClipboard(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div
        className={`flex ${
          message.role === 'user' ? 'justify-end' : 'justify-start'
        } mb-4`}
      >
        <div
          className={`max-w-[80%] rounded-lg p-3 ${
            message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <div className="flex items-start gap-2">
            {message.role === 'assistant' && (
              <Bot className="h-4 w-4 mt-1 flex-shrink-0" />
            )}
            {message.role === 'user' && (
              <User className="h-4 w-4 mt-1 flex-shrink-0" />
            )}
            
            <div className="flex-1">
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                <span>{formatTimestamp(message.timestamp)}</span>
                {message.content && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-4 w-4 p-0 ml-2"
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <Card className="h-[600px] flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Header */}
          <div className="border-b p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Dify Chat</h3>
                {conversationId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {conversationId.slice(0, 8)}...
                  </Badge>
                )}
                {isLoading && (
                  <Badge variant="secondary" className="text-xs animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    处理中...
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewConversation}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  新对话
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearConversation}
                  disabled={isLoading}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  清空
                </Button>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 border-b">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{error}</span>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                    >
                      重试
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setError(null)}
                    >
                      关闭
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  开始新对话
                </h3>
                <p className="text-gray-600">
                  输入您的消息开始与 AI 助手对话
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
              </>
            )}
            
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600">AI 正在思考...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4 bg-gray-50">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? "AI 正在回复中..." : "输入您的消息... (Shift+Enter 换行，Enter 发送)"}
                disabled={isLoading}
                className="resize-none"
                rows={3}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="h-[72px] px-4"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {retryCount > 0 && (
              <div className="mt-2 text-xs text-orange-600">
                重试次数: {retryCount}/2
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DifyChat;
