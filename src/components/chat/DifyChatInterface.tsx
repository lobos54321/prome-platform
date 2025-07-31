import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  RefreshCw,
  Activity
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
  const [workflowReset, setWorkflowReset] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 动态工作流专用输入参数 - 根据状态变化
  const workflowInputs = useMemo(() => {
    const baseWorkflowInputs = {
      // 工作流控制参数
      "workflow_type": "chat_assistant",
      "execution_mode": "controlled", // 改为受控模式
      "enable_all_nodes": false, // 改为 false
      "bypass_conditions": false,
      
      // 条件判断参数
      "user_intent": inputMessage ? "question" : "init",
      "context_available": true,
      "require_detailed_response": true,
      
      // 自定义工作流变量（根据你的具体工作流调整）
      "processing_level": "optimized", // 改为优化模式
      "response_type": "contextual", // 改为上下文相关
      "enable_followup": true,
      
      // 工作流条件控制 - 关键修复
      "condition_check": true,
      "workflow_branch": "main",
      "execute_conditional_nodes": false, // 改为 false，避免执行所有条件节点
      
      // 循环控制参数
      "prevent_infinite_loops": true,
      "max_workflow_steps": 3,
      "step_timeout": 30,
      "auto_exit_conditions": true,
      
      // 重置标志
      "workflow_reset": workflowReset,
    };

    // 如果是重置状态，清除重置标志
    if (workflowReset) {
      setTimeout(() => setWorkflowReset(false), 100);
    }

    return baseWorkflowInputs;
  }, [inputMessage, workflowReset]);

  // Chat functionality with workflow inputs
  const {
    state: chatState,
    sendMessage,
    clearMessages,
    regenerateLastMessage,
    startNewConversation: originalStartNewConversation,
    setError,
    retryLastMessage,
  } = useDifyChat({
    autoStartConversation,
    enableStreaming: streamingEnabled,
    user: user?.id,
    workflowInputs, // 传递动态工作流输入
  });

  // Enhanced start new conversation with workflow reset
  const startNewConversation = useCallback(() => {
    // 设置工作流重置标志
    setWorkflowReset(true);
    
    // 清除输入消息
    setInputMessage('');
    
    // 清除相关的本地存储
    localStorage.removeItem('dify_conversation_id');
    sessionStorage.removeItem('dify_conversation_id');
    localStorage.removeItem('dify_workflow_state');
    localStorage.removeItem('dify_messages');
    
    // 调用原始的新对话函数
    originalStartNewConversation();
    
    console.log('🔄 Started new conversation with workflow reset');
  }, [originalStartNewConversation]);

  // Token monitoring
  const { state: tokenState } = useTokenMonitoring();

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };

    loadUser();
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatState.messages]);

  // Update user balance after token consumption
  useEffect(() => {
    if (tokenState.lastConsumption && user) {
      setUser(prev => prev ? {
        ...prev,
        balance: prev.balance - tokenState.lastConsumption!.totalCost
      } : null);
    }
  }, [tokenState.lastConsumption, user]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('复制失败');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || chatState.isLoading) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    
    // 发送消息时添加当前输入的上下文
    const messageInputs = {
      "current_input": message,
      "input_length": message.length,
      "has_questions": message.includes('?') || message.includes('？'),
      "message_type": message.length > 100 ? "detailed" : "simple",
    };
    
    await sendMessage(message, messageInputs);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearMessages = () => {
    if (window.confirm('确定要清空当前对话吗？这将保留对话ID但清除所有消息。')) {
      clearMessages();
      setInputMessage('');
    }
  };

  const handleStartNewConversation = () => {
    if (window.confirm('确定要开始新对话吗？这将创建一个全新的对话会话。')) {
      startNewConversation();
    }
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

  if (!user) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在加载用户信息...</p>
        </div>
      </div>
    );
  }

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
                  {chatState.conversationId && (
                    <Badge variant="outline" className="text-xs">
                      对话ID: {chatState.conversationId.slice(0, 8)}...
                    </Badge>
                  )}
                  {chatState.isStreaming && (
                    <Badge variant="secondary" className="text-xs animate-pulse">
                      <Activity className="h-3 w-3 mr-1" />
                      正在输入...
                    </Badge>
                  )}
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
                onClick={handleStartNewConversation}
                disabled={chatState.isLoading}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                新对话
              </Button>
              
              {showMetadata && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokenDetails(!showTokenDetails)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="streaming"
                  checked={streamingEnabled}
                  onCheckedChange={setStreamingEnabled}
                  disabled={chatState.isLoading}
                />
                <Label htmlFor="streaming" className="text-xs">
                  流式输出
                </Label>
              </div>
            </div>
          </div>

          {/* Token Details */}
          {showTokenDetails && tokenState.isMonitoring && (
            <div className="mt-3 p-3 bg-white rounded-lg border text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">Token 监控状态</span>
                <Badge variant="secondary" className="text-xs">
                  {tokenState.isMonitoring ? '活跃' : '未活跃'}
                </Badge>
              </div>
              
              {tokenState.lastConsumption && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-600">最近消费:</span>
                    <span className="font-medium ml-1">
                      {tokenState.lastConsumption.totalTokens} tokens
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">费用:</span>
                    <span className="font-medium ml-1">
                      {tokenState.lastConsumption.totalCost.toFixed(6)} 积分
                    </span>
                  </div>
                </div>
              )}
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
                  size="sm"
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
                  onClick={handleClearMessages}
                  disabled={chatState.isLoading || chatState.messages.length === 0}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  清空对话
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartNewConversation}
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
