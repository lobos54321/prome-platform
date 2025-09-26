/**
 * Global Loading Indicator Component
 * 
 * Provides various loading states and indicators for the application.
 */

import { memo } from 'react';
import { Loader2, MessageSquare, Database, Cloud, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingIndicatorProps {
  variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton' | 'progress';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  type?: 'chat' | 'database' | 'network' | 'cloud' | 'general';
  className?: string;
  progress?: number; // 0-100 for progress variant
}

export const LoadingIndicator = memo(({
  variant = 'spinner',
  size = 'md',
  message,
  type = 'general',
  className,
  progress
}: LoadingIndicatorProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const getIcon = () => {
    switch (type) {
      case 'chat':
        return <MessageSquare className={sizeClasses[size]} />;
      case 'database':
        return <Database className={sizeClasses[size]} />;
      case 'network':
        return <Wifi className={sizeClasses[size]} />;
      case 'cloud':
        return <Cloud className={sizeClasses[size]} />;
      default:
        return <Loader2 className={sizeClasses[size]} />;
    }
  };

  const renderIndicator = () => {
    switch (variant) {
      case 'spinner':
        return (
          <div className="animate-spin">
            {getIcon()}
          </div>
        );

      case 'dots':
        return (
          <div className="flex space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full bg-current animate-pulse",
                  size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
                )}
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.8s'
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className={cn(
            "animate-pulse rounded-full bg-current",
            size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-16 h-16'
          )} />
        );

      case 'skeleton':
        return (
          <div className="animate-pulse space-y-2">
            <div className={cn(
              "bg-gray-200 rounded",
              size === 'sm' ? 'h-4' : size === 'md' ? 'h-6' : 'h-8'
            )} />
            <div className={cn(
              "bg-gray-200 rounded",
              size === 'sm' ? 'h-3 w-3/4' : size === 'md' ? 'h-4 w-3/4' : 'h-6 w-3/4'
            )} />
          </div>
        );

      case 'progress':
        return (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className={cn(
                "font-medium",
                size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'
              )}>
                {message || '加载中...'}
              </span>
              {progress !== undefined && (
                <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
              )}
            </div>
            <div className={cn(
              "bg-gray-200 rounded-full overflow-hidden",
              size === 'sm' ? 'h-2' : size === 'md' ? 'h-3' : 'h-4'
            )}>
              <div
                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress || 0}%` }}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="animate-spin">
            <Loader2 className={sizeClasses[size]} />
          </div>
        );
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-center text-blue-600",
      className
    )}>
      <div className="flex flex-col items-center gap-2">
        {renderIndicator()}
        {message && variant !== 'progress' && (
          <span className={cn(
            "text-center",
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          )}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
});

LoadingIndicator.displayName = 'LoadingIndicator';

// Convenience components for common loading states
export const ChatLoadingIndicator = memo(({ message = "AI正在思考..." }: { message?: string }) => (
  <LoadingIndicator variant="dots" type="chat" message={message} />
));

export const DatabaseLoadingIndicator = memo(({ message = "连接数据库..." }: { message?: string }) => (
  <LoadingIndicator variant="spinner" type="database" message={message} />
));

export const NetworkLoadingIndicator = memo(({ message = "网络请求中..." }: { message?: string }) => (
  <LoadingIndicator variant="pulse" type="network" message={message} />
));

export const SkeletonLoader = memo(({ lines = 3 }: { lines?: number }) => (
  <div className="animate-pulse space-y-3">
    {[...Array(lines)].map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded mb-2" style={{ width: `${60 + Math.random() * 30}%` }} />
          <div className="h-3 bg-gray-200 rounded" style={{ width: `${40 + Math.random() * 40}%` }} />
        </div>
      </div>
    ))}
  </div>
));

ChatLoadingIndicator.displayName = 'ChatLoadingIndicator';
DatabaseLoadingIndicator.displayName = 'DatabaseLoadingIndicator';
NetworkLoadingIndicator.displayName = 'NetworkLoadingIndicator';
SkeletonLoader.displayName = 'SkeletonLoader';