/**
 * Virtual Message List Component
 * 
 * High-performance virtualized message list for handling large conversation histories
 */

import { memo, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ChatMessage } from './ChatMessage';
import { ChatMessage as ChatMessageType } from '@/hooks/useDifyChat';
import { cn } from '@/lib/utils';

interface VirtualizedMessageListProps {
  messages: ChatMessageType[];
  showMetadata?: boolean;
  onRetry?: () => void;
  height: number;
  itemHeight?: number;
  className?: string;
}

interface MessageItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: ChatMessageType[];
    showMetadata: boolean;
    onRetry?: () => void;
  };
}

const MessageItem = memo(({ index, style, data }: MessageItemProps) => {
  const { messages, showMetadata, onRetry } = data;
  const message = messages[index];
  
  if (!message) {
    return <div style={style} />;
  }

  const isLastMessage = index === messages.length - 1;
  const hasError = message.error;
  
  return (
    <div
      style={style}
      className={cn(
        "border-b border-gray-100 last:border-b-0",
        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
      )}
    >
      <ChatMessage
        message={message}
        onRetry={hasError && isLastMessage ? onRetry : undefined}
        showMetadata={showMetadata}
      />
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export const VirtualizedMessageList = memo(({
  messages,
  showMetadata = false,
  onRetry,
  height,
  itemHeight = 120,
  className
}: VirtualizedMessageListProps) => {
  // Memoize the data object to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    messages,
    showMetadata,
    onRetry
  }), [messages, showMetadata, onRetry]);

  // Memoize the item renderer
  const ItemRenderer = useCallback((props: MessageItemProps) => (
    <MessageItem {...props} />
  ), []);

  if (messages.length === 0) {
    return <div className={cn("h-full", className)} />;
  }

  return (
    <div className={cn("h-full", className)}>
      <List
        height={height}
        itemCount={messages.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5} // Render 5 extra items for smooth scrolling
      >
        {ItemRenderer}
      </List>
    </div>
  );
});

VirtualizedMessageList.displayName = 'VirtualizedMessageList';