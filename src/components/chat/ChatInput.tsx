/**
 * Chat Input Component
 * 
 * Input field for sending messages with send button and keyboard shortcuts.
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  error?: string | null;
  className?: string;
  maxLength?: number;
}

export const ChatInput = ({ 
  onSendMessage, 
  disabled = false,
  isLoading = false,
  placeholder = "输入您的消息...",
  error,
  className,
  maxLength = 4000
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled && !isLoading) {
      onSendMessage(trimmedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    if (value.length <= maxLength) {
      setMessage(value);
    }
  };

  const isDisabled = disabled || isLoading;
  const canSend = message.trim().length > 0 && !isDisabled;

  return (
    <Card className={cn("border-t", className)}>
      <CardContent className="p-4">
        {/* Error Display */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={isDisabled}
              className={cn(
                "min-h-[40px] max-h-[120px] resize-none",
                "focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '40px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            
            {/* Character Count */}
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {message.length}/{maxLength}
            </div>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="sm"
            className={cn(
              "h-10 px-3 min-w-[40px]",
              canSend 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Helper Text */}
        <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
          <span>按 Enter 发送，Shift+Enter 换行</span>
          {isLoading && (
            <span className="text-blue-600">正在发送消息...</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};