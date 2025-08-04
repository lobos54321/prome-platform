import { useState, useRef, useEffect, useCallback } from 'react';
import { createDifyAPIClient, DifyAPIClient, DifyResponse, DifyStreamResponse } from '@/lib/dify-api-client';
import { generateUUID, isValidUUID } from '@/lib/utils';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';
import { useWorkflowDiagnostics } from '@/hooks/useWorkflowDiagnostics';

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
  workflowInputs?: Record<string, unknown>; // 新增：专门用于工作流的输入参数
}

const INITIAL_STATE: ChatState = {
  messages: [],
  conversationId: null,
  isLoading: false,
  isStreaming: false,
  error: null,
  currentStreamingId: null,
};


export function useDifyChat(options: UseDifyChatOptions = {}) {
  const {
    autoStartConversation = true,
    enableStreaming = true,
    user,
    inputs = {},
    workflowInputs = {} // 新增：工作流专用输入
  } = options;

  const [state, setState] = useState<ChatState>(INITIAL_STATE);
  const clientRef = useRef<DifyAPIClient>();
  const { processTokenUsage } = useTokenMonitoring();
  const { recordEvent, recordParameters } = useWorkflowDiagnostics();
  const abortControllerRef = useRef<AbortController | null>(null);
  const workflowStartTimeRef = useRef<number | null>(null);
  const nodeStartTimesRef = useRef<Map<string, number>>(new Map());

  // Initialize Dify client and clean up invalid conversation IDs
  useEffect(() => {
    try {
      clientRef.current = createDifyAPIClient();
      
      // Clean up any existing invalid conversation IDs from storage
      const storedConversationId = localStorage.getItem('dify_conversation_id') || sessionStorage.getItem('dify_conversation_id');
      if (storedConversationId && !isValidUUID(storedConversationId)) {
        localStorage.removeItem('dify_conversation_id');
        sessionStorage.removeItem('dify_conversation_id');
        console.log('🧹 Cleaned up invalid conversation ID from storage:', storedConversationId);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Dify client:', error);
      setState(prev => ({ ...prev, error: 'Failed to initialize chat client' }));
    }
  }, []);

  // Auto-start conversation if enabled
  useEffect(() => {
    if (autoStartConversation && !state.conversationId && clientRef.current) {
      startNewConversation();
    }
  }, [autoStartConversation]);

  const addMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      error: null,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false,
      isStreaming: false,
      currentStreamingId: null,
    }));
  }, []);

  const startNewConversation = useCallback(async () => {
    try {
      if (!clientRef.current) {
        throw new Error('Chat client not initialized');
      }

      const newConversationId = await clientRef.current.startNewConversation();
      setState(prev => ({
        ...prev,
        conversationId: newConversationId,
        messages: [], // 清空消息历史
        error: null,
      }));
      
      // Store the new conversation ID and clear old data
      localStorage.setItem('dify_conversation_id', newConversationId);
      localStorage.removeItem('dify_messages'); // 清空旧消息
      localStorage.removeItem('dify_workflow_state'); // 清空工作流状态
      
      console.log('🆕 Started new conversation:', newConversationId);
      
      return newConversationId;
    } catch (error) {
      console.error('❌ Failed to start new conversation:', error);
      setError('Failed to start new conversation');
      return null;
    }
  }, [setError]);

  // 构建Dify API标准输入参数 - 使用最简化的格式以避免API解析错误
  const buildCompleteInputs = useCallback((message: string, customInputs?: Record<string, unknown>) => {
    // 计算会话状态用于诊断
    const existingUserMessages = state.messages.filter(msg => msg.role === 'user');
    const currentUserMessageCount = existingUserMessages.length + 1;
    const isFirstMessage = existingUserMessages.length === 0;
    
    // 使用最简单的Dify API标准输入格式
    // 只包含必要的工作流输入参数，避免过多的元数据字段
    const baseInputs = {
      // 合并外部提供的输入参数
      ...inputs, // 来自 useDifyChat 选项的输入
      ...workflowInputs, // 工作流专用输入
      ...customInputs, // 自定义输入（优先级最高）
    };

    console.log('🎯 Dify API inputs:', {
      isFirstMessage,
      messageCount: currentUserMessageCount,
      conversationId: state.conversationId,
      inputsCount: Object.keys(baseInputs).length
    });
    
    // Record parameters for diagnostics
    recordParameters(state.conversationId || 'unknown', baseInputs, currentUserMessageCount);
    
    return baseInputs;
  }, [user, state.conversationId, state.messages, inputs, workflowInputs, recordParameters]);

  const sendMessage = useCallback(async (content: string, customInputs?: Record<string, unknown>) => {
    if (!clientRef.current) {
      setError('Chat client not initialized');
      return;
    }

    if (!content.trim()) {
      setError('Message cannot be empty');
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userId = user || 'default-user';
    const userMessageId = generateUUID();
    const assistantMessageId = generateUUID();
    
    // 关键修复：在添加消息之前构建输入参数
    const completeInputs = buildCompleteInputs(content, customInputs);

    // Add user message
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);

    // Add assistant message placeholder
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
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      if (enableStreaming) {
        // Streaming response with buffer for handling large JSON chunks
        let fullContent = '';
        let finalUsage = null;
        let finalMessageId = null;
        let finalConversationId = state.conversationId;
        const jsonBuffer = ''; // Buffer for handling split JSON data

        await clientRef.current.sendMessageStream(
          content,
          (chunk: DifyStreamResponse) => {
            console.log('📨 Received stream chunk:', chunk);
            
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
                // Update stored conversation ID
                localStorage.setItem('dify_conversation_id', finalConversationId);
              }

              // Record workflow event for diagnostics
              recordEvent(finalConversationId || state.conversationId, {
                event: 'message_end',
                data: {
                  messageId: finalMessageId,
                  usage: finalUsage,
                  contentLength: fullContent.length
                }
              });
            } else if (chunk.event === 'error') {
              // Record error event for diagnostics
              recordEvent(state.conversationId, {
                event: 'error',
                data: chunk.data || 'Unknown error in stream'
              });
              throw new Error(chunk.data || 'Dify API error in stream');
            } else if (chunk.event === 'workflow_started') {
              console.log('🚀 Workflow started:', chunk);
              workflowStartTimeRef.current = Date.now();
              // Record workflow started event for diagnostics
              recordEvent(state.conversationId, {
                event: 'workflow_started',
                data: chunk,
                metadata: {
                  parameters: completeInputs
                }
              });
            } else if (chunk.event === 'workflow_finished') {
              console.log('✅ Workflow finished:', chunk);
              const executionTime = workflowStartTimeRef.current 
                ? Date.now() - workflowStartTimeRef.current 
                : undefined;
              // Record workflow finished event for diagnostics
              recordEvent(state.conversationId, {
                event: 'workflow_finished',
                data: chunk,
                executionTime
              });
              workflowStartTimeRef.current = null;
            } else if (chunk.event === 'node_started') {
              console.log('🔄 Node started:', chunk);
              const nodeId = chunk.node_id || 'unknown_node';
              nodeStartTimesRef.current.set(nodeId, Date.now());
              // Record node started event for diagnostics
              recordEvent(state.conversationId, {
                event: 'node_started',
                nodeId,
                nodeName: chunk.node_name || chunk.node_title || nodeId,
                data: chunk
              });
            } else if (chunk.event === 'node_finished') {
              console.log('✅ Node finished:', chunk);
              const nodeId = chunk.node_id || 'unknown_node';
              const startTime = nodeStartTimesRef.current.get(nodeId);
              const executionTime = startTime ? Date.now() - startTime : undefined;
              nodeStartTimesRef.current.delete(nodeId);
              // Record node finished event for diagnostics
              recordEvent(state.conversationId, {
                event: 'node_finished',
                nodeId,
                nodeName: chunk.node_name || chunk.node_title || nodeId,
                data: chunk,
                executionTime
              });
            } else if (chunk.event === 'parallel_branch_finished') {
              console.log('🔀 Parallel branch finished:', chunk);
            }
          },
          state.conversationId || undefined,
          userId,
          completeInputs // 使用精确的输入参数
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

        console.log('✅ Streaming completed successfully');

      } else {
        // Blocking response
        const response: DifyResponse = await clientRef.current.sendMessage(
          content,
          state.conversationId || undefined,
          userId,
          completeInputs // 使用精确的输入参数
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

        // Store conversation ID
        localStorage.setItem('dify_conversation_id', response.conversation_id);

        // Process token usage
        if (response.metadata.usage) {
          await processTokenUsage(
            response.metadata.usage,
            response.conversation_id,
            response.message_id,
            'dify-native'
          );
        }

        console.log('✅ Non-streaming message sent successfully');
      }

    } catch (error: unknown) {
      console.error('❌ Error sending message:', error);
      
      // Handle specific error cases
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Request was aborted');
        return;
      }

      let errorMessage = 'Failed to send message';
      if (error instanceof Error) {
        if (error.message.includes('Conversation Not Exists') || 
            error.message.includes('Conversation ID format error') ||
            error.message.includes('404') ||
            error.message.includes('Not Found')) {
          // Handle conversation not exists error
          console.log('🔄 Conversation no longer exists, starting new conversation...');
          
          // Clear conversation state
          setState(prev => ({
            ...prev,
            conversationId: null,
          }));
          
          // Clear stored conversation IDs and workflow state
          localStorage.removeItem('dify_conversation_id');
          sessionStorage.removeItem('dify_conversation_id');
          localStorage.removeItem('dify_workflow_state');
          
          await startNewConversation();
          errorMessage = '对话已过期，已自动为你新建会话，请重试刚才的问题';
        } else {
          errorMessage = error.message;
        }
      }

      updateMessage(assistantMessageId, {
        content: '',
        isStreaming: false,
        error: errorMessage
      });

      setError(errorMessage);
    } finally {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        currentStreamingId: null,
      }));
    }
  }, [
    user, 
    state.conversationId, 
    enableStreaming, 
    addMessage, 
    updateMessage, 
    setError, 
    startNewConversation, 
    processTokenUsage,
    buildCompleteInputs,
    recordEvent
  ]);

  const regenerateLastMessage = useCallback(async (customInputs?: Record<string, unknown>) => {
    const lastUserMessage = state.messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'user');

    if (lastUserMessage) {
      // Remove the last assistant message if it exists
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter((msg, index, arr) => {
          // Keep all messages except the last assistant message
          const lastAssistantIndex = arr.map(m => m.role).lastIndexOf('assistant');
          const isLastAssistant = msg.role === 'assistant' && index === lastAssistantIndex;
          return !isLastAssistant;
        }),
      }));

      await sendMessage(lastUserMessage.content, customInputs);
    }
  }, [state.messages, sendMessage]);

  const retryLastMessage = useCallback(async () => {
    await regenerateLastMessage();
  }, [regenerateLastMessage]);

  // Load conversation from storage on mount
  useEffect(() => {
    const loadStoredConversation = () => {
      try {
        // Try to load conversation ID from storage
        const storedConversationId = localStorage.getItem('dify_conversation_id');
        if (storedConversationId && isValidUUID(storedConversationId)) {
          setState(prev => ({
            ...prev,
            conversationId: storedConversationId,
          }));
          console.log('📂 Loaded conversation ID from storage:', storedConversationId);
        }

        // Try to load messages from storage
        const storedMessages = localStorage.getItem('dify_messages');
        if (storedMessages) {
          try {
            const messages = JSON.parse(storedMessages);
            if (Array.isArray(messages)) {
              setState(prev => ({
                ...prev,
                messages: messages,
              }));
              console.log('📂 Loaded messages from storage:', messages.length);
            }
          } catch (error) {
            console.warn('⚠️ Failed to parse stored messages:', error);
            localStorage.removeItem('dify_messages');
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to load stored conversation:', error);
      }
    };

    loadStoredConversation();
  }, []);

  // Save messages to storage when they change
  useEffect(() => {
    if (state.messages.length > 0) {
      try {
        localStorage.setItem('dify_messages', JSON.stringify(state.messages));
      } catch (error) {
        console.warn('⚠️ Failed to save messages to storage:', error);
      }
    }
  }, [state.messages]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Clear conversation data
  const clearConversation = useCallback(() => {
    setState(INITIAL_STATE);
    localStorage.removeItem('dify_conversation_id');
    localStorage.removeItem('dify_messages');
    localStorage.removeItem('dify_workflow_state'); // 清除工作流状态
    sessionStorage.removeItem('dify_conversation_id');
    console.log('🧹 Cleared conversation data and workflow state');
  }, []);

  // Export conversation data
  const exportConversation = useCallback(() => {
    const exportData = {
      conversationId: state.conversationId,
      messages: state.messages,
      timestamp: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `dify-conversation-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }, [state.conversationId, state.messages]);

  // Get conversation statistics
  const getConversationStats = useCallback(() => {
    const totalMessages = state.messages.length;
    const userMessages = state.messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = state.messages.filter(msg => msg.role === 'assistant').length;
    
    const totalTokens = state.messages.reduce((sum, msg) => {
      return sum + (msg.metadata?.usage?.total_tokens || 0);
    }, 0);

    return {
      totalMessages,
      userMessages,
      assistantMessages,
      totalTokens,
      conversationId: state.conversationId,
      hasActiveConversation: !!state.conversationId,
    };
  }, [state.messages, state.conversationId]);

  return {
    state,
    sendMessage,
    clearMessages,
    regenerateLastMessage,
    startNewConversation,
    setError,
    retryLastMessage,
    clearConversation,
    exportConversation,
    getConversationStats,
  };
}
