/**
 * Dify Chat Interface
 * 
 * Main chat interface component that combines all chat functionality
 * with real-time token monitoring and billing integration.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  Coins,
  Activity,
  AlertTriangle,
  Bot,
  Zap
} from 'lucide-react';
import { ChatHistory } from './ChatHistory';
import { ChatInput } from './ChatInput';
import { useDifyChat } from '@/hooks/useDifyChat';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';
import { authService } from '@/lib/auth';
import { User } from '@/types';
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
  const [user, setUser] = useState<User | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(enableStreaming);

  // Chat functionality
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
        setError('用户认证失败');
      }
    };

    loadUser();
  }, [setError]);

  // Check for API configuration
  const isDifyConfigured = !!(
    import.meta.env.VITE_DIFY_API_URL &&
    import.meta.env.VITE_DIFY_APP_ID &&
    import.meta.env.VITE_DIFY_API_KEY
  );

  if (!isDifyConfigured) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="flex items-center justify-center h-full">
          <Alert className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Dify API 未配置。请设置相关环境变量：
              <ul className="mt-2 text-sm list-disc list-inside">
                <li>VITE_DIFY_API_URL</li>
                <li>VITE_DIFY_APP_ID</li>
                <li>VITE_DIFY_API_KEY</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="flex items-center justify-center h-full">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              请先登录以使用聊天功能
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleSendMessage = async (message: string) => {
    // Check balance before sending
    if (user.balance <= 0) {
      toast.error('余额不足，请先充值');
      return;
    }

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('发送消息失败');
    }
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
                onClick={startNewConversation}
                disabled={chatState.isLoading}
              >
                <Plus className="h-4 w-4 mr-1" />
                新对话
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTokenDetails(!showTokenDetails)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showTokenDetails && (
            <>
              <Separator className="my-4" />
              <div className="grid gap-4 md:grid-cols-2">
                {/* User Balance */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    账户余额
                  </h4>
                  <div className="text-2xl font-bold text-green-600">
                    {user.balance.toLocaleString()} 积分
                  </div>
                  <p className="text-xs text-gray-500">
                    汇率: 10,000积分 = $1 USD
                  </p>
                </div>

                {/* Token Usage Stats */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    本次会话统计
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>总Token:</span>
                      <Badge variant="outline">{tokenState.totalTokensUsed}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>总费用:</span>
                      <Badge variant="outline">${tokenState.totalCost.toFixed(6)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>积分消费:</span>
                      <Badge variant="outline">{tokenState.totalPointsDeducted}</Badge>
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">设置</h4>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="streaming"
                      checked={streamingEnabled}
                      onCheckedChange={setStreamingEnabled}
                    />
                    <Label htmlFor="streaming" className="text-sm">
                      流式响应
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="metadata"
                      checked={showMetadata}
                      onCheckedChange={setShowTokenDetails}
                    />
                    <Label htmlFor="metadata" className="text-sm">
                      显示Token详情
                    </Label>
                  </div>
                </div>

                {/* Recent Usage */}
                {tokenState.usageHistory.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">最近使用</h4>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {tokenState.usageHistory.slice(0, 3).map((usage, index) => (
                        <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          <div className="flex justify-between">
                            <span>{usage.modelName}</span>
                            <span>{usage.totalTokens} tokens</span>
                          </div>
                          <div className="text-gray-500">
                            {usage.pointsDeducted} 积分 • {new Date(usage.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardHeader>
      </Card>

      {/* Error Display */}
      {(chatState.error || tokenState.error) && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {chatState.error || tokenState.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Chat History */}
      <div className="flex-1 min-h-0">
        <ChatHistory
          messages={chatState.messages}
          onRetryMessage={retryLastMessage}
          onClearMessages={clearMessages}
          onRegenerateLastMessage={regenerateLastMessage}
          isLoading={chatState.isLoading}
          isStreaming={chatState.isStreaming}
          showMetadata={showMetadata}
          conversationId={chatState.conversationId}
          className="h-full"
        />
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 mt-4">
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={chatState.isLoading || user.balance <= 0}
          isLoading={chatState.isLoading}
          error={user.balance <= 0 ? '余额不足，请先充值' : null}
          placeholder="输入您的问题... (每次对话会实时扣费)"
        />
      </div>
    </div>
  );
};