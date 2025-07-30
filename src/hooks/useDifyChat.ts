/**
 * Dify Chat Hook
 * 
 * Provides chat functionality with direct Dify API integration,
 * including message management, streaming support, and conversation handling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { DifyAPIClient, DifyMessage, DifyResponse, DifyStreamResponse, createDifyAPIClient } from '@/lib/dify-api-client';
import { useTokenMonitoring } from './useTokenMonitoring';
import { authService } from '@/lib/auth';
import { generateUUID, isValidUUID } from '@/lib/utils';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  error?: string;
  metadata?: {
    messageId?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

export interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  currentStreamingId: string | null;
}

export interface UseDifyChatOptions {
  autoStartConversation?: boolean;
  enableStreaming?: boolean;
  user?: string;
  inputs?: Record<string, unknown>;
}

export interface UseDifyChatReturn {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  regenerateLastMessage: () => Promise<void>;
  startNewConversation: () => void;
  setError: (error: string | null) => void;
  retryLastMessage: () => Promise<void>;
}

const INITIAL_STATE: ChatState = {
  messages: [],
  conversationId: null,
  isLoading: false,
  isStreaming: false,
  error: null,
  currentStreamingId: null,
};

export function useDifyChat(options: UseDifyChatOptions = {}): UseDifyChatReturn {
  const {
    autoStartConversation = true,
    enableStreaming = true,
    user,
    inputs = {}
  } = options;

  const [state, setState] = useState<ChatState>(INITIAL_STATE);
  const clientRef = useRef<DifyAPIClient>();
  const { processTokenUsage } = useTokenMonitoring();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize Dify client and clean up invalid conversation IDs
  useEffect(() => {
    try {
      clientRef.current = createDifyAPIClient();
      
      // Clean up any existing invalid conversation IDs from storage
      const storedConversationId = localStorage.getItem('dify_conversation_id') || sessionStorage.getItem('dify_conversation_id');
      if (storedConversationId && !isValidUUID(storedConversationId)) {
        localStorage.removeItem('dify_conversation_id');
        sessionStorage.removeItem('dify_conversation_id');
        console.log('Cleaned up invalid conversation ID from storage:', storedConversationId);
      }
    } catch (error) {
      console.error('Failed to initialize Dify client:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Dify API not configured. Please check environment variables.' 
      }));
    }
  }, []);

  // Auto-start conversation if enabled
  useEffect(() => {
    if (autoStartConversation && !state.conversationId && clientRef.current) {
      startNewConversation();
    }
  }, [autoStartConversation, state.conversationId]);

  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const startNewConversation = useCallback(() => {
    // Clear any invalid conversation IDs from storage
    const oldConversationId = localStorage.getItem('dify_conversation_id');
    if (oldConversationId && !isValidUUID(oldConversationId)) {
      localStorage.removeItem('dify_conversation_id');
      sessionStorage.removeItem('dify_conversation_id');
    }
    
    const newConversationId = generateUUID();
    
    setState(prev => ({
      ...prev,
      conversationId: newConversationId,
      messages: [],
      error: null
    }));

    // Store the new UUID for potential reuse
    localStorage.setItem('dify_conversation_id', newConversationId);
    
    toast.success('已开始新对话', {
      description: '对话ID已生成，可以开始聊天了'
    });
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!clientRef.current) {
      toast.error('Dify API client not initialized');
      return;
    }

    if (!content.trim()) {
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentUser = await authService.getCurrentUser();
    const userId = user || currentUser?.id || 'default-user';
    
    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);

    // Create assistant message placeholder
    const assistantMessageId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: enableStreaming,
    };

    addMessage(assistantMessage);

    setState(prev => ({
      ...prev,
      isLoading: true,
      isStreaming: enableStreaming,
      error: null,
      currentStreamingId: enableStreaming ? assistantMessageId : null,
    }));

    try {
      if (enableStreaming) {
        // Streaming response
        let fullContent = '';
        let finalUsage = null;
        let finalMessageId = null;
        let finalConversationId = state.conversationId;

        await clientRef.current.sendMessageStream(
          content,
          (chunk: DifyStreamResponse) => {
            if (chunk.event === 'message') {
              if (chunk.answer) {
                fullContent += chunk.answer;
                updateMessage(assistantMessageId, {
                  content: fullContent,
                  isStreaming: true
                });
              }
            } else if (chunk.event === 'message_end') {
              // Final message with usage data
              if (chunk.metadata?.usage) {
                finalUsage = chunk.metadata.usage;
              }
              if (chunk.message_id) {
                finalMessageId = chunk.message_id;
              }
              if (chunk.conversation_id) {
                finalConversationId = chunk.conversation_id;
              }

              updateMessage(assistantMessageId, {
                content: fullContent,
                isStreaming: false,
                metadata: {
                  messageId: finalMessageId || undefined,
                  usage: finalUsage || undefined
                }
              });

              // Update conversation ID if we got a new one
              if (finalConversationId && finalConversationId !== state.conversationId) {
                setState(prev => ({
                  ...prev,
                  conversationId: finalConversationId,
                }));
              }
            } else if (chunk.event === 'error') {
              throw new Error('Dify API error in stream');
            }
          },
          state.conversationId || undefined,
          userId,
          inputs
        );

        // Process token usage if available
        if (finalUsage) {
          await processTokenUsage(
            finalUsage,
            finalConversationId || state.conversationId || undefined,
            finalMessageId || undefined,
            'dify-native'
          );
        }

      } else {
        // Blocking response
        const response: DifyResponse = await clientRef.current.sendMessage(
          content,
          state.conversationId || undefined,
          userId,
          inputs
        );

        updateMessage(assistantMessageId, {
          content: response.answer,
          isStreaming: false,
          metadata: {
            messageId: response.message_id,
            usage: response.metadata.usage
          }
        });

        // Update conversation ID
        setState(prev => ({
          ...prev,
          conversationId: response.conversation_id,
        }));

        // Process token usage
        if (response.metadata.usage) {
          await processTokenUsage(
            response.metadata.usage,
            response.conversation_id,
            response.message_id,
            'dify-native'
          );
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      console.error('Error sending message:', error);
      
      // Handle conversation ID format errors
      if (errorMessage.includes('Conversation ID format error')) {
        console.log('Conversation ID format error detected, starting new conversation');
        startNewConversation();
        toast.warning('对话ID格式错误，已自动开始新对话', {
          description: '请重新发送您的消息'
        });
        
        updateMessage(assistantMessageId, {
          content: '',
          isStreaming: false,
          error: '对话ID格式错误，已开始新对话，请重新发送消息'
        });
      } else {
        updateMessage(assistantMessageId, {
          content: '',
          isStreaming: false,
          error: errorMessage
        });

        toast.error('发送消息失败', {
          description: errorMessage
        });
      }

      setState(prev => ({
        ...prev,
        error: errorMessage
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        currentStreamingId: null,
      }));
    }
  }, [
    state.conversationId, 
    enableStreaming, 
    user, 
    inputs, 
    generateMessageId, 
    addMessage, 
    updateMessage, 
    processTokenUsage
  ]);

  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      error: null
    }));
  }, []);

  const regenerateLastMessage = useCallback(async () => {
    const messages = state.messages;
    if (messages.length < 2) {
      return;
    }

    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (!lastUserMessage) {
      return;
    }

    // Remove the last assistant message
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter((_, index) => index !== prev.messages.length - 1)
    }));

    // Resend the last user message
    await sendMessage(lastUserMessage.content);
  }, [state.messages, sendMessage]);

  const retryLastMessage = useCallback(async () => {
    const messages = state.messages;
    if (messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.role === 'user') {
      // If last message was from user, resend it
      await sendMessage(lastMessage.content);
    } else if (lastMessage.role === 'assistant' && lastMessage.error) {
      // If last message was assistant with error, regenerate
      await regenerateLastMessage();
    }
  }, [state.messages, sendMessage, regenerateLastMessage]);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  return {
    state,
    sendMessage,
    clearMessages,
    regenerateLastMessage,
    startNewConversation,
    setError,
    retryLastMessage,
  };
}