'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function DifyChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // 从 localStorage 获取已有的对话ID和消息历史
    const storedId = localStorage.getItem('dify-conversation-id');
    const storedMessages = localStorage.getItem('dify-messages');
    
    if (storedId) {
      setConversationId(storedId);
    }
    
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (e) {
        console.error('Failed to parse stored messages:', e);
      }
    }
  }, []);
  
  useEffect(() => {
    // 保存消息到 localStorage
    if (messages.length > 0) {
      localStorage.setItem('dify-messages', JSON.stringify(messages));
    }
  }, [messages]);
  
  useEffect(() => {
    // 自动滚动到底部
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      role: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chat/dify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversationId: conversationId || undefined,
          user: 'user-123' // 这里可以使用真实的用户ID
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
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.message);
      
      // 移除用户消息，因为发送失败
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      
      // 如果是 404 错误，清除对话
      if (error.message.includes('404') || error.message.includes('Not Exists')) {
        handleClearConversation();
        setError('对话已过期，请重新开始');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearConversation = () => {
    localStorage.removeItem('dify-conversation-id');
    localStorage.removeItem('dify-messages');
    setConversationId(null);
    setMessages([]);
    setError(null);
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto h-[600px] flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">AI 助手</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearConversation}
          disabled={messages.length === 0}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          新对话
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            开始新的对话
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="text-center py-2">
            <Loader2 className="h-6 w-6 animate-spin inline" />
          </div>
        )}
      </ScrollArea>
      
      {error && (
        <Alert variant="destructive" className="mx-4 mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
