/**
 * Chat History Component
 * 
 * Displays the conversation history with messages and manages scrolling.
 */

import { useEffect, useRef } from 'react';
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
import { ChatMessage } from './ChatMessage';
import { ChatMessage as ChatMessageType } from '@/hooks/useDifyChat';
import { cn } from '@/lib/utils';

interface ChatHistoryProps {
  messages: ChatMessageType[];
  onRetryMessage?: () => void;
  onClearMessages?: () => void;
  onRegenerateLastMessage?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  showMetadata?: boolean;
  className?: string;
  conversationId?: string | null;
}

export const ChatHistory = ({
  messages,
  onRetryMessage,
  onClearMessages,
  onRegenerateLastMessage,
  isLoading = false,
  isStreaming = false,
  showMetadata = false,
  className,
  conversationId
}: ChatHistoryProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isStreaming]);

  const hasMessages = messages.length > 0;
  const lastMessage = messages[messages.length - 1];
  const canRegenerate = hasMessages && lastMessage?.role === 'assistant' && !isLoading;
  const hasError = lastMessage?.error;

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
        {!hasMessages ? (
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
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="space-y-0">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRetry={hasError && index === messages.length - 1 ? onRetryMessage : undefined}
                  showMetadata={showMetadata}
                  className={cn(
                    "border-b border-gray-100 last:border-b-0",
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  )}
                />
              ))}
              
              {/* Loading Indicator */}
              {isLoading && !isStreaming && (
                <div className="flex items-center justify-center p-4 text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">AI正在思考...</span>
                  </div>
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
};