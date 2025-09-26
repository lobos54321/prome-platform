/**
 * Virtualized Message List Component
 * 
 * High-performance component for rendering large numbers of chat messages
 * using virtualization to maintain smooth scrolling performance.
 */

import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { ChatMessage } from '@/components/chat/ChatMessage';
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

interface MessageItemData {
  messages: ChatMessageType[];
  showMetadata: boolean;
  onRetry?: () => void;
}

// Individual message row component for virtualization
const MessageRow: React.FC<ListChildComponentProps<MessageItemData>> = ({ 
  index, 
  style, 
  data 
}) => {
  const { messages, showMetadata, onRetry } = data;
  const message = messages[index];
  const isLastMessage = index === messages.length - 1;
  
  if (!message) return null;

  return (
    <div style={style}>
      <ChatMessage
        key={message.id}
        message={message}
        onRetry={isLastMessage && message.metadata?.error ? onRetry : undefined}
        showMetadata={showMetadata}
        className={cn(
          "border-b border-gray-100 last:border-b-0",
          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
        )}
      />
    </div>
  );
};

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  showMetadata = false,
  onRetry,
  height,
  itemHeight = 120, // Estimated height per message
  className
}) => {
  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo<MessageItemData>(() => ({
    messages,
    showMetadata,
    onRetry
  }), [messages, showMetadata, onRetry]);

  // Get dynamic item size based on message content
  const getItemSize = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return itemHeight;
    
    // Calculate rough height based on content length
    const contentLines = Math.ceil(message.content.length / 80); // ~80 chars per line
    const baseHeight = 100; // Base height for avatar, metadata, etc.
    const lineHeight = 24; // Height per line of content
    
    return Math.max(baseHeight + (contentLines * lineHeight), itemHeight);
  }, [messages, itemHeight]);

  // Handle scroll to maintain scroll position
  const handleItemsRendered = useCallback(({ 
    visibleStartIndex, 
    visibleStopIndex 
  }: {
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => {
    // Could add intersection observer logic here for analytics
    // console.log(`Visible messages: ${visibleStartIndex} to ${visibleStopIndex}`);
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>暂无消息</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <List
        height={height}
        itemCount={messages.length}
        itemSize={itemHeight}
        itemData={itemData}
        onItemsRendered={handleItemsRendered}
        overscanCount={5} // Render 5 extra items above/below viewport
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {MessageRow}
      </List>
    </div>
  );
};

export default VirtualizedMessageList;