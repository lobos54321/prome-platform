import { useState, useRef, useEffect, useCallback } from 'react';
import { createDifyAPIClient, DifyAPIClient, DifyResponse, DifyStreamResponse } from '@/lib/dify-api-client';
import { generateUUID, isValidUUID } from '@/lib/utils';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';

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

// Helper function to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

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

  // 构建完整的输入参数 - 关键修复点：简化配置，避免冲突
  const buildCompleteInputs = useCallback((message: string, customInputs?: Record<string, unknown>) => {
    const currentTime = new Date();
    
    // 计算用户消息数量（排除系统消息和助手消息）
    const userMessageCount = state.messages.filter(msg => msg.role === 'user').length;
    const totalMessageCount = state.messages.length;
    const hasConversationHistory = userMessageCount > 0;
    
    // 简化的基础输入参数 - 移除冲突配置
    const baseInputs = {
      // 系统参数
      "user_id": user || 'default-user',
      "session_id": state.conversationId || 'new-session',
      "timestamp": currentTime.toISOString(),
      "datetime": currentTime.toLocaleString('zh-CN'),
      "current_date": currentTime.toLocaleDateString('zh-CN'),
      "current_time": currentTime.toLocaleTimeString('zh-CN'),
      
      // 消息相关参数
      "user_message": message,
      "query": message,
      "user_input": message,
      "question": message,
      "current_message": message,
      
      // 会话控制参数 - 简化版本
      "language": "zh-CN",
      "locale": "zh-CN",
      "chat_mode": "workflow",
      
      // 核心工作流控制参数 - 关键修复
      "conversation_id": state.conversationId,
      "message_count": userMessageCount,
      "is_first_message": userMessageCount === 0,
      "has_history": hasConversationHistory,
      
      // 执行控制 - 防止循环的核心参数
      "execution_mode": hasConversationHistory ? "targeted" : "full",
      "max_iterations": 1, // 强制限制为1次迭代，防止循环
      "force_exit": hasConversationHistory, // 有历史记录时强制退出循环节点
      "skip_initialization": hasConversationHistory, // 跳过初始化节点
      "prevent_infinite_loops": true,
      "workflow_step_limit": hasConversationHistory ? 1 : 3, // 限制工作流步数
      
      // 节点选择策略
      "node_execution": hasConversationHistory ? "selective" : "all",
      "bypass_initial_conditions": hasConversationHistory,
      
      // 上下文信息
      "previous_messages": state.messages.slice(-2).map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 100) // 进一步限制长度
      })),
      
      // 合并其他输入参数
      ...inputs, // 来自 useDifyChat 选项的输入
      ...workflowInputs, // 工作流专用输入
      ...customInputs, // 自定义输入（优先级最高）
    };

    console.log('🔧 Simplified workflow inputs:', {
      userMessageCount,
      hasConversationHistory,
      executionMode: baseInputs.execution_mode,
      maxIterations: baseInputs.max_iterations,
      forceExit: baseInputs.force_exit,
      skipInitialization: baseInputs.skip_initialization,
      nodeExecution: baseInputs.node_execution,
      workflowStepLimit: baseInputs.workflow_step_limit
    });
    
    return baseInputs;
  }, [user, state.conversationId, state.messages, inputs, workflowInputs]);

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
    
    // 构建完整的输入参数
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
        // Streaming response
        let fullContent = '';
        let finalUsage = null;
        let finalMessageId = null;
        let finalConversationId = state.conversationId;

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
            } else if (chunk.event === 'error') {
              throw new Error(chunk.data || 'Dify API error in stream');
            } else if (chunk.event === 'workflow_started') {
              console.log('🚀 Workflow started:', chunk);
            } else if (chunk.event === 'workflow_finished') {
              console.log('✅ Workflow finished:', chunk);
            } else if (chunk.event === 'node_started') {
              console.log('🔄 Node started:', chunk);
            } else if (chunk.event === 'node_finished') {
              console.log('✅ Node finished:', chunk);
            }
          },
          state.conversationId || undefined,
          userId,
          completeInputs // 使用简化的输入参数
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
          completeInputs // 使用简化的输入参数
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

    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      
      // Handle specific error cases
      if (error.name === 'AbortError') {
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
    buildCompleteInputs
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
        messages: prev.messages.filter((msg, index) => {
          // Keep all messages except the last assistant message
          const isLastAssistant = msg.role === 'assistant' && 
            index === prev.messages.findLastIndex(m => m.role === 'assistant');
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
