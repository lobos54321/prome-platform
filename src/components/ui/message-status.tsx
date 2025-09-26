/**
 * Message Status Indicator Component
 * 
 * Shows sending, delivered, and error states for chat messages.
 */

import { memo } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MessageStatus {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  timestamp?: Date | string;
  error?: string;
}

interface MessageStatusIndicatorProps {
  status: MessageStatus['status'];
  size?: 'sm' | 'md';
  showText?: boolean;
  className?: string;
  error?: string;
}

export const MessageStatusIndicator = memo(({
  status,
  size = 'sm',
  showText = false,
  className,
  error
}: MessageStatusIndicatorProps) => {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  const getStatusConfig = () => {
    switch (status) {
      case 'sending':
        return {
          icon: <Loader2 className={cn(iconSize, 'animate-spin')} />,
          text: '发送中...',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50'
        };
      case 'sent':
        return {
          icon: <Check className={iconSize} />,
          text: '已发送',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50'
        };
      case 'delivered':
        return {
          icon: <CheckCheck className={iconSize} />,
          text: '已送达',
          color: 'text-green-500',
          bgColor: 'bg-green-50'
        };
      case 'read':
        return {
          icon: <CheckCheck className={iconSize} />,
          text: '已读',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50'
        };
      case 'failed':
        return {
          icon: <AlertCircle className={iconSize} />,
          text: error || '发送失败',
          color: 'text-red-500',
          bgColor: 'bg-red-50'
        };
      case 'pending':
      default:
        return {
          icon: <Clock className={iconSize} />,
          text: '等待发送',
          color: 'text-gray-400',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn(
      "flex items-center gap-1",
      config.color,
      className
    )}>
      {config.icon}
      {showText && (
        <span className={cn(
          "text-xs",
          size === 'md' && 'text-sm'
        )}>
          {config.text}
        </span>
      )}
    </div>
  );
});

// Animated typing indicator for when AI is responding
export const TypingIndicator = memo(({ 
  message = "AI正在输入...",
  className 
}: { 
  message?: string; 
  className?: string; 
}) => (
  <div className={cn("flex items-center gap-2 text-gray-500", className)}>
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-current rounded-full animate-bounce"
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
    <span className="text-xs">{message}</span>
  </div>
));

// Progress indicator for file uploads or long operations
export const MessageProgress = memo(({ 
  progress, 
  message = "处理中...",
  className 
}: { 
  progress: number; 
  message?: string; 
  className?: string; 
}) => (
  <div className={cn("space-y-2", className)}>
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>{message}</span>
      <span>{Math.round(progress)}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div 
        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  </div>
));

// Combined message feedback component
interface MessageFeedbackProps {
  status: MessageStatus['status'];
  isStreaming?: boolean;
  error?: string;
  progress?: number;
  showTimestamp?: boolean;
  timestamp?: Date | string;
  className?: string;
}

export const MessageFeedback = memo(({
  status,
  isStreaming = false,
  error,
  progress,
  showTimestamp = false,
  timestamp,
  className
}: MessageFeedbackProps) => {
  const formatTimestamp = (ts?: Date | string) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {/* Streaming indicator */}
      {isStreaming && <TypingIndicator />}
      
      {/* Progress indicator */}
      {progress !== undefined && progress < 100 && (
        <MessageProgress progress={progress} />
      )}
      
      {/* Status indicator */}
      {!isStreaming && (
        <MessageStatusIndicator 
          status={status} 
          error={error}
          showText={status === 'failed'}
        />
      )}
      
      {/* Timestamp */}
      {showTimestamp && timestamp && (
        <span className="text-gray-400 ml-auto">
          {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
});

// Message delivery receipt
export const DeliveryReceipt = memo(({ 
  messageId,
  status,
  timestamp,
  className 
}: { 
  messageId: string;
  status: MessageStatus['status'];
  timestamp?: Date | string;
  className?: string;
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'sent':
        return '消息已发送';
      case 'delivered':
        return 'AI已接收消息';
      case 'read':
        return 'AI正在处理';
      case 'failed':
        return '消息发送失败';
      default:
        return '';
    }
  };

  return (
    <div className={cn(
      "text-xs text-gray-500 bg-gray-50 rounded px-2 py-1",
      className
    )}>
      <div className="flex items-center justify-between">
        <span>{getStatusText()}</span>
        {timestamp && (
          <span className="ml-2">
            {new Date(timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>
    </div>
  );
});

MessageStatusIndicator.displayName = 'MessageStatusIndicator';
TypingIndicator.displayName = 'TypingIndicator';
MessageProgress.displayName = 'MessageProgress';
MessageFeedback.displayName = 'MessageFeedback';
DeliveryReceipt.displayName = 'DeliveryReceipt';