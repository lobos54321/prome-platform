/**
 * Chat History Component
 * 
 * Displays the conversation history with messages and manages scrolling.
 */

import { useEffect, useRef, useMemo, useCallback, memo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Trash2, 
  RotateCcw, 
  ArrowDown,
  History
} from 'lucide-react';
import { ChatLoadingIndicator, SkeletonLoader } from '@/components/ui/loading-indicator';
import { VirtualizedMessageList } from './VirtualizedMessageList';
import { ChatMessage } from './ChatMessage';
import { ChatMessage as ChatMessageType } from '@/hooks/useDifyChat';
import { cn } from '@/lib/utils';

interface ChatHistoryProps {
  messages: ChatMessageType[];
  onRetryMessage?: () => void;
  onClearMessages?: () => void;
  onRegenerateLastMessage?: () => void;
  onLoadMoreMessages?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  isLoadingMore?: boolean;
  hasMoreMessages?: boolean;
  showMetadata?: boolean;
  className?: string;
  conversationId?: string | null;
  virtualizeThreshold?: number; // 消息数量超过此阈值时启用虚拟化
}

export const ChatHistory = memo(({
  messages,
  onRetryMessage,
  onClearMessages,
  onRegenerateLastMessage,
  onLoadMoreMessages,
  isLoading = false,
  isStreaming = false,
  isLoadingMore = false,
  hasMoreMessages = false,
  showMetadata = false,
  className,
  conversationId,
  virtualizeThreshold = 50
}: ChatHistoryProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [shouldVirtualize, setShouldVirtualize] = useState(false);
  
  // Check if virtualization should be enabled
  useEffect(() => {
    setShouldVirtualize(messages.length > virtualizeThreshold);
  }, [messages.length, virtualizeThreshold]);

  // Memoize computed values for better performance
  const computedState = useMemo(() => {
    const hasMessages = messages.length > 0;
    const lastMessage = messages[messages.length - 1];
    return {
      hasMessages,
      lastMessage,
      canRegenerate: hasMessages && lastMessage?.role === 'assistant' && !isLoading,
      hasError: lastMessage?.error,
      shouldVirtualize
    };
  }, [messages, isLoading, shouldVirtualize]);

  // Load more messages when scrolling to top
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!hasMoreMessages || isLoadingMore || !onLoadMoreMessages) return;
    
    const target = event.currentTarget;
    if (target.scrollTop === 0) {
      onLoadMoreMessages();
    }
  }, [hasMoreMessages, isLoadingMore, onLoadMoreMessages]);

  // Optimize scroll function with useCallback
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive (optimized)
  useEffect(() => {
    if (computedState.hasMessages || isStreaming) {
      scrollToBottom();
    }
  }, [messages.length, isStreaming, scrollToBottom, computedState.hasMessages]);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">对话历史</CardTitle>
            {conversationId && (
              <Badge variant="outline" className="text-xs">
                {conversationId.slice(0, 8)}...
              </Badge>
            )}
          </div>
          
          {hasMessages && (
            <div className="flex items-center gap-1">
              {/* Message Count */}
              <Badge variant="secondary" className="text-xs">
                {messages.length} 条消息
              </Badge>

              {/* Actions */}
              {canRegenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerateLastMessage}
                  className="h-8 px-2"
                  title="重新生成最后一条回复"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onClearMessages}
                className="h-8 px-2 text-red-600 hover:text-red-700"
                title="清空对话历史"
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={scrollToBottom}
                className="h-8 px-2"
                title="滚动到底部"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        {!computedState.hasMessages ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <History className="h-12 w-12 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">开始新对话</h3>
            <p className="text-sm text-center max-w-sm">
              输入您的问题开始与AI助手对话。每次对话都会准确计费Token使用量。
            </p>
          </div>
        ) : (
          /* Messages List */
          <ScrollArea ref={scrollAreaRef} className="h-full" onScrollCapture={handleScroll}>
            <div className="space-y-0">
              {/* Load More Indicator at Top */}
              {hasMoreMessages && (
                <div className="flex items-center justify-center p-4 text-gray-500 border-b border-gray-100">
                  {isLoadingMore ? (
                    <ChatLoadingIndicator message="加载更多消息..." />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLoadMoreMessages}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <History className="h-4 w-4 mr-2" />
                      加载更多历史消息
                    </Button>
                  )}
                </div>
              )}

              {shouldVirtualize ? (
                /* Virtual Scrolling for Large Message Lists */
                <VirtualizedMessageList
                  messages={messages}
                  showMetadata={showMetadata}
                  onRetry={computedState.hasError ? onRetryMessage : undefined}
                  height={400} // Fixed height for virtualization
                />
              ) : (
                /* Regular Rendering for Small Message Lists */
                messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onRetry={computedState.hasError && index === messages.length - 1 ? onRetryMessage : undefined}
                    showMetadata={showMetadata}
                    className={cn(
                      "border-b border-gray-100 last:border-b-0",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    )}
                  />
                ))
              )}
              
              {/* Loading Indicator */}
              {isLoading && !isStreaming && (
                <div className="flex items-center justify-center p-4">
                  <ChatLoadingIndicator message="AI正在思考..." />
                </div>
              )}

              {/* Bottom anchor for auto-scroll */}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});