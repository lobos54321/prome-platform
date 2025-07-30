/**
 * Chat Message Component
 * 
 * Displays individual chat messages with proper styling and metadata.
 */

import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User, 
  Bot, 
  Clock, 
  RotateCcw, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/hooks/useDifyChat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

interface ChatMessageProps {
  message: ChatMessageType;
  onRetry?: () => void;
  showMetadata?: boolean;
  className?: string;
}

export const ChatMessage = memo(({ 
  message, 
  onRetry, 
  showMetadata = false,
  className 
}: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  
  const isUser = message.role === 'user';
  const hasError = !!message.error;
  const isStreaming = message.isStreaming;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('消息已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "flex-row-reverse" : "flex-row",
      className
    )}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={cn(
          isUser 
            ? "bg-blue-100 text-blue-600" 
            : "bg-green-100 text-green-600"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "text-right" : "text-left"
      )}>
        {/* Message Bubble */}
        <Card className={cn(
          "inline-block max-w-[80%]",
          isUser 
            ? "bg-blue-600 text-white ml-auto" 
            : hasError 
              ? "bg-red-50 border-red-200" 
              : "bg-gray-50",
          hasError && "border-red-300"
        )}>
          <CardContent className="p-3">
            {/* Error State */}
            {hasError && (
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">发送失败</span>
              </div>
            )}

            {/* Message Content */}
            <div className={cn(
              "whitespace-pre-wrap break-words",
              hasError && "text-gray-600"
            )}>
              {message.content || (isStreaming ? "正在思考..." : "无响应内容")}
              {isStreaming && (
                <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
              )}
            </div>

            {/* Error Message */}
            {hasError && message.error && (
              <div className="mt-2 text-sm text-red-600 bg-red-100 p-2 rounded">
                {message.error}
              </div>
            )}

            {/* Streaming Indicator */}
            {isStreaming && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-3 w-3 animate-spin" />
                <span>AI正在回复...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Actions */}
        <div className={cn(
          "flex items-center gap-2 text-xs text-gray-500",
          isUser ? "justify-end" : "justify-start"
        )}>
          <span>{formatTimestamp(message.timestamp)}</span>
          
          {!isUser && message.content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-gray-400 hover:text-gray-600"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}

          {hasError && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-red-500 hover:text-red-700"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              重试
            </Button>
          )}
        </div>

        {/* Metadata (Debug Info) */}
        {showMetadata && message.metadata && (
          <div className="text-xs text-gray-400 space-y-1">
            {message.metadata.messageId && (
              <div>消息ID: {message.metadata.messageId}</div>
            )}
            {message.metadata.usage && (
              <div className="flex gap-3">
                <span>输入: {message.metadata.usage.prompt_tokens}</span>
                <span>输出: {message.metadata.usage.completion_tokens}</span>
                <span>总计: {message.metadata.usage.total_tokens} tokens</span>
              </div>
            )}
          </div>
        )}

        {/* Status Badges */}
        <div className={cn(
          "flex gap-1",
          isUser ? "justify-end" : "justify-start"
        )}>
          {isStreaming && (
            <Badge variant="secondary" className="text-xs">
              正在输入
            </Badge>
          )}
          {hasError && (
            <Badge variant="destructive" className="text-xs">
              错误
            </Badge>
          )}
          {message.metadata?.usage && (
            <Badge variant="outline" className="text-xs">
              {message.metadata.usage.total_tokens} tokens
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';