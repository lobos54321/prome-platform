/**
 * Enhanced Error Boundary and Error Handling Components
 */

import React, { ErrorInfo, ReactNode, Component, memo } from 'react';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  className?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    
    this.setState({ errorInfo });
    
    // Call external error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to monitoring service (if available)
    if (typeof window !== 'undefined' && (window as any).errorReporting) {
      (window as any).errorReporting.captureException(error, {
        tags: { component: 'ErrorBoundary' },
        extra: { errorInfo, errorId: this.state.errorId }
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={cn("p-6", this.props.className)}>
          <ErrorDisplay
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            errorId={this.state.errorId}
            onRetry={this.handleRetry}
            showDetails={this.props.showDetails}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorDisplayProps {
  error: Error | null;
  errorInfo?: ErrorInfo | null;
  errorId?: string;
  onRetry?: () => void;
  onHome?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const ErrorDisplay = memo(({
  error,
  errorInfo,
  errorId,
  onRetry,
  onHome,
  showDetails = false,
  className
}: ErrorDisplayProps) => {
  const [showStackTrace, setShowStackTrace] = React.useState(false);

  const handleCopyError = async () => {
    const errorText = `
Error ID: ${errorId}
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Time: ${new Date().toISOString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      // Could show a toast here
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  return (
    <Card className={cn("max-w-lg mx-auto", className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-lg text-red-600">出现错误</CardTitle>
            <p className="text-sm text-gray-600">很抱歉，页面遇到了问题</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Message */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">
            {error?.message || '未知错误'}
          </p>
          {errorId && (
            <Badge variant="secondary" className="mt-2 text-xs">
              错误ID: {errorId}
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          )}
          {onHome && (
            <Button variant="outline" onClick={onHome} className="flex-1">
              <Home className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          )}
        </div>

        {/* Debug Information */}
        {showDetails && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStackTrace(!showStackTrace)}
                className="p-0 h-auto text-gray-500 hover:text-gray-700"
              >
                <Bug className="h-4 w-4 mr-1" />
                {showStackTrace ? '隐藏' : '显示'}技术详情
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyError}
                className="p-0 h-auto text-gray-500 hover:text-gray-700"
              >
                复制错误信息
              </Button>
            </div>

            {showStackTrace && (
              <div className="p-3 bg-gray-100 border rounded text-xs font-mono max-h-40 overflow-auto">
                <div className="mb-2">
                  <strong>错误堆栈:</strong>
                  <pre className="whitespace-pre-wrap mt-1">{error?.stack}</pre>
                </div>
                {errorInfo?.componentStack && (
                  <div>
                    <strong>组件堆栈:</strong>
                    <pre className="whitespace-pre-wrap mt-1">{errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// Network Error Component
interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
  className?: string;
}

export const NetworkError = memo(({ onRetry, message, className }: NetworkErrorProps) => (
  <Card className={cn("max-w-sm mx-auto", className)}>
    <CardContent className="pt-6 text-center">
      <div className="mb-4">
        <div className="p-3 bg-orange-100 rounded-full inline-block">
          <AlertCircle className="h-6 w-6 text-orange-600" />
        </div>
      </div>
      <h3 className="font-medium text-gray-900 mb-2">网络连接问题</h3>
      <p className="text-sm text-gray-600 mb-4">
        {message || '无法连接到服务器，请检查您的网络连接'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      )}
    </CardContent>
  </Card>
));

// API Error Component
interface ApiErrorProps {
  status?: number;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ApiError = memo(({ status, message, onRetry, className }: ApiErrorProps) => {
  const getErrorMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 400:
        return '请求参数错误';
      case 401:
        return '用户认证失败，请重新登录';
      case 403:
        return '没有权限访问此资源';
      case 404:
        return '请求的资源不存在';
      case 500:
        return '服务器内部错误';
      case 502:
        return '服务器网关错误';
      case 503:
        return '服务暂时不可用';
      default:
        return '请求失败，请稍后重试';
    }
  };

  return (
    <Card className={cn("max-w-sm mx-auto", className)}>
      <CardContent className="pt-6 text-center">
        <div className="mb-4">
          <div className="p-3 bg-red-100 rounded-full inline-block">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
        </div>
        <h3 className="font-medium text-gray-900 mb-2">
          请求失败
          {status && <Badge variant="secondary" className="ml-2">{status}</Badge>}
        </h3>
        <p className="text-sm text-gray-600 mb-4">{getErrorMessage()}</p>
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

ErrorDisplay.displayName = 'ErrorDisplay';
NetworkError.displayName = 'NetworkError';
ApiError.displayName = 'ApiError';