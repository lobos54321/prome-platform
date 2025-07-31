import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  RotateCcw, 
  Trash2, 
  MessageSquare,
  Zap,
  AlertCircle,
  Copy,
  Check,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useDifyChat, ChatMessage } from '@/hooks/useDifyChat';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';
import { authService } from '@/lib/auth';
import { User as UserType } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DifyChatInterfaceProps {
  className?: string;
  showMetadata?: boolean;
  enableStreaming?: boolean;
  autoStartConversation?: boolean;
}

export const DifyChatInterface = ({
  className,
  showMetadata = false,
  enableStreaming = true,
  autoStartConversation = true
}: DifyChatInterfaceProps) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(enableStreaming);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 定义工作流专用输入参数
  const workflowInputs = {
    // 工作流控制参数
    "workflow_type": "chat_assistant",
    "execution_mode": "complete",
    "enable_all_nodes": true,
    "bypass_conditions": false,
    
    // 条件判断参数
    "user_intent": "question", // 可以根据消息内容动态调整
    "context_available": true,
    "require_detailed_response": true,
    
    // 自定义工作流变量（根据你的具体工作流调整）
    "processing_level": "full",
    "response_type": "comprehensive",
    "enable_followup": true,
    
    // 如果你的工作流有特定的条件变量，在这里添加
    "condition_check": true,
    "workflow_branch": "main",
    "execute_conditional_nodes": true,
  };

  // Chat functionality with workflow inputs
  const {
    state: chatState,
    sendMessage,
    clearMessages,
    regenerateLastMessage,
    startNewConversation,
    setError,
    retryLastMessage,
  } = useDifyChat({
    autoStartConversation,
    enableStreaming: streamingEnabled,
    user: user?.id,
    workflowInputs, // 传递工作流专用输入
  });

  // Token monitoring
  const { state: tokenState } = useTokenMonitoring();

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
        setError('Failed to load user data');
      }
    };

    loadUser();
  }, [setError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || chatState.isLoading) return;

    const message = inputMessage.trim();
    setInputMessage('');

    // 根据消息内容动态添加输入参数
    const dynamicInputs = {
      "message_length": message.length,
      "message_type": message.includes('?') || message.includes('？') ? 'question' : 'statement',
      "is_greeting": /^(你好|hi|hello|嗨)/i.test(message),
      "requires_analysis": message.length > 50,
      "user_emotion": "neutral", // 可以根据消息内容分析情绪
      "priority": "normal",
      "current_datetime": new Date().toISOString(),
    };

    try {
      await sendMessage(message, dynamicInputs);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('发送消息失败，请重试');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const MessageItem = ({ message }: { message: ChatMessage }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      await copyToClipboard(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className={cn(
        "flex gap-3 p-4 rounded-lg",
        message.role === 'user' 
          ? "bg-blue-50 ml-8" 
          : "bg-gray-50 mr-8"
      )}>
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          message.role === 'user' 
            ? "bg-blue-600 text-white" 
            : "bg-gray-600 text-white"
        )}>
          {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {message.role === 'user' ? '你' : 'AI助手'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {formatTimestamp(message.timestamp)}
              </span>
              {message.content && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 w-6 p-0"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              )}
            </div>
          </div>
          
          {message.error ? (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message.error}</AlertDescription>
            </Alert>
          ) : (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.isStreaming && (
                <div className="flex items-center gap-2 mt-2 text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">正在生成回复...</span>
                </div>
              )}
            </div>
          )}

          {showMetadata && message.metadata && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
              {message.metadata.messageId && (
                <div>Message ID: {message.metadata.messageId}</div>
              )}
              {message.metadata.usage && (
                <div>
                  Tokens: {message.metadata.usage.prompt_tokens}+{message.metadata.usage.completion_tokens}={message.metadata.usage.total_tokens}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <Card className="flex-shrink-0 mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  AI助手聊天
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    原生API
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  直接调用Dify API，100%准确的Token监控
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenDetails(!showTokenDetails)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStreamingEnabled(!streamingEnabled)}
              >
                {streamingEnabled ? 'Streaming: On' : 'Streaming: Off'}
              </Button>
            </div>
          </div>

          {showTokenDetails && tokenState.lastUsage && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>输入Tokens:</span>
                  <span>{tokenState.lastUsage.prompt_tokens}</span>
                </div>
                <div className="flex justify-between">
                  <span>输出Tokens:</span>
                  <span>{tokenState.lastUsage.completion_tokens}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>总计Tokens:</span>
                  <span>{tokenState.lastUsage.total_tokens}</span>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Error Display */}
      {chatState.error && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {chatState.error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setError(null)}
              className="ml-2"
            >
              关闭
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatState.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">开始对话</p>
                <p className="text-sm text-center max-w-md">
                  发送消息开始与AI助手对话。支持复杂工作流和条件判断。
                </p>
              </div>
            ) : (
              <>
                {chatState.messages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <Separator />

          {/* Input Area */}
          <div className="p-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
                  className="min-h-[60px] resize-none"
                  disabled={chatState.isLoading}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSendMessage}
                  disabled={chatState.isLoading || !inputMessage.trim()}
                  className="h-[60px] px-4"
                >
                  {chatState.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerateLastMessage}
                  disabled={chatState.isLoading || chatState.messages.length === 0}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重新生成
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearMessages}
                  disabled={chatState.isLoading || chatState.messages.length === 0}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  清空对话
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startNewConversation}
                  disabled={chatState.isLoading}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  新对话
                </Button>
              </div>

              <div className="text-xs text-gray-500">
                {user && (
                  <span>余额: {user.balance.toLocaleString()} 积分</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
