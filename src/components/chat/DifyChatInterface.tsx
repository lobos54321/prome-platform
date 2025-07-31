import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatHistory } from './ChatHistory';
import { ChatInput } from './ChatInput';
import { useDifyChat } from '@/hooks/useDifyChat';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';
import { authService } from '@/lib/auth';
import { 
  Send, 
  Loader2, 
  Copy, 
  RotateCcw, 
  Trash2, 
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Zap,
  ZapOff
} from 'lucide-react';
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

  // 简化的工作流输入 - 移除复杂参数，只保留必要的标识
  const workflowInputs = useMemo(() => {
    return {
      // 基础标识
      "interface_type": "chat_interface",
      "client_version": "v1.0",
      
      // 简单的用户意图标识（让工作流自己判断）
      "user_query": inputMessage || "",
      
      // 移除所有复杂的执行控制参数
      // 让 useDifyChat 统一管理
    };
  }, [inputMessage]);

  // Chat functionality with simplified workflow inputs
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
    workflowInputs, // 传递简化的工作流输入
  });

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
    
    try {
      await sendMessage(message);
    } catch (error) {
      console.error('发送消息失败:', error);
      toast.error('发送消息失败，请重试');
    }
  };

  const handleClearMessages = () => {
    if (window.confirm('确定要清空所有消息吗？')) {
      clearMessages();
      toast.success('消息已清空');
    }
  };

  const handleStartNewConversation = async () => {
    if (window.confirm('确定要开始新对话吗？这将清空当前对话历史。')) {
      await startNewConversation();
      toast.success('已开始新对话');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">AI 助手</CardTitle>
              {chatState.conversationId && (
                <Badge variant="secondary" className="text-xs">
                  ID: {chatState.conversationId.slice(0, 8)}...
                </Badge>
              )}
              {chatState.isLoading && (
                <Badge variant="outline" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  处理中
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTokenDetails(!showTokenDetails)}
              >
                {showTokenDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              
              <div className="flex items-center gap-1">
                <Switch
                  id="streaming"
                  checked={streamingEnabled}
                  onCheckedChange={setStreamingEnabled}
                  disabled={chatState.isLoading}
                />
                <Label htmlFor="streaming" className="text-xs">
                  {streamingEnabled ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
                </Label>
              </div>
            </div>
          </div>
          
          {showTokenDetails && user && (
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">当前余额</span>
                <span className="text-green-600 font-mono">
                  {user.balance.toLocaleString()} 积分
                </span>
              </div>
              
              {tokenState.lastConsumption && (
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">上次消费</span>
                    <span className="font-mono">
                      {tokenState.lastConsumption.totalTokens.toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">费用</span>
                    <span className="font-mono text-red-600">
                      -{tokenState.lastConsumption.totalCost.toLocaleString()} 积分
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Chat History */}
          <div className="flex-1 min-h-0">
            <ChatHistory
              messages={chatState.messages}
              isLoading={chatState.isLoading}
              isStreaming={chatState.isStreaming}
              error={chatState.error}
              showMetadata={showMetadata}
              onCopyMessage={copyToClipboard}
              onRetryMessage={retryLastMessage}
            />
            <div ref={messagesEndRef} />
          </div>

          <Separator />
          
          {/* Input Area */}
          <div className="p-4">
            <div className="flex gap-2 mb-3">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={chatState.isLoading ? "AI 正在回复中..." : "输入您的消息... (Shift+Enter 换行，Enter 发送)"}
                disabled={chatState.isLoading}
                className="resize-none"
                rows={3}
              />
              <Button
                onClick={handleSendMessage}
                disabled={chatState.isLoading || !inputMessage.trim()}
                className="h-[72px] px-4"
              >
                {chatState.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
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
                {chatState.messages.length > 0 && (
                  <span>{chatState.messages.filter(m => m.role === 'user').length} 条对话</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DifyChatInterface;
