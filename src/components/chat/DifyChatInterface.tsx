'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RotateCcw, Bot, User, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    messageId?: string;
    usage?: {
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
    };
  };
}

interface WorkflowProgress {
  nodeId: string;
  nodeName: string;
  nodeTitle?: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

interface WorkflowState {
  isWorkflow: boolean;
  nodes: WorkflowProgress[];
  currentNodeId?: string;
  totalNodes?: number;
  completedNodes: number;
}

interface DifyChatInterfaceProps {
  className?: string;
  placeholder?: string;
  welcomeMessage?: string;
  mode?: 'chat' | 'workflow'; // 支持不同模式
  showWorkflowProgress?: boolean; // 是否显示工作流进度
  enableRetry?: boolean; // 是否启用重试功能
}

export function DifyChatInterface({
  className,
  placeholder = "Type your message...",
  welcomeMessage = "Hello! How can I help you today?",
  mode = 'chat',
  showWorkflowProgress = true,
  enableRetry = true
}: DifyChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    isWorkflow: false,
    nodes: [],
    completedNodes: 0
  });
  
  // 生成唯一用户ID（在生产环境应该使用真实的用户ID）
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dify_user_id');
      if (stored) return stored;
      
      const newId = `user_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('dify_user_id', newId);
      return newId;
    }
    return `user_${Math.random().toString(36).substring(2, 15)}`;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 添加欢迎消息
  useEffect(() => {
    if (messages.length === 0 && welcomeMessage) {
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [welcomeMessage]);

  // 工作流进度更新处理
  const updateWorkflowProgress = (nodeUpdate: Partial<WorkflowProgress> & { nodeId: string }) => {
    setWorkflowState(prev => {
      const existingNodeIndex = prev.nodes.findIndex(n => n.nodeId === nodeUpdate.nodeId);
      const newNodes = [...prev.nodes];
      
      if (existingNodeIndex >= 0) {
        // 更新现有节点
        newNodes[existingNodeIndex] = { ...newNodes[existingNodeIndex], ...nodeUpdate };
      } else {
        // 添加新节点
        newNodes.push({
          nodeId: nodeUpdate.nodeId,
          nodeName: nodeUpdate.nodeName || nodeUpdate.nodeId,
          nodeTitle: nodeUpdate.nodeTitle,
          status: nodeUpdate.status || 'waiting',
          startTime: nodeUpdate.startTime,
          endTime: nodeUpdate.endTime,
          error: nodeUpdate.error
        });
      }

      // 计算完成的节点数
      const completedNodes = newNodes.filter(n => n.status === 'completed').length;
      
      return {
        ...prev,
        nodes: newNodes,
        currentNodeId: nodeUpdate.status === 'running' ? nodeUpdate.nodeId : prev.currentNodeId,
        completedNodes
      };
    });
  };

  // 发送消息（支持重试）
  const sendMessageWithRetry = async (messageContent: string, currentRetry = 0): Promise<void> => {
    const maxRetries = enableRetry ? 3 : 0;
    const inputs = {}; // Initialize inputs for request body
    
    try {
      console.log('[Chat] Sending message:', {
        message: messageContent,
        conversationId,
        userId,
        mode,
        attempt: currentRetry + 1
      });

      // 重置工作流状态
      if (showWorkflowProgress) {
        setWorkflowState({
          isWorkflow: true,
          nodes: [],
          completedNodes: 0
        });
      }

      // Fix 1: Better handle conversationId validation
      const endpoint = conversationId && conversationId !== 'default' && conversationId !== 'null' && conversationId !== 'undefined'
        ? `/api/dify/${conversationId}` 
        : '/api/dify';
      const timeoutMs = showWorkflowProgress ? 120000 : 30000; // 显示工作流进度时使用更长的超时

      console.log('[Chat Debug] Sending request:', {
        endpoint,
        messageContent: messageContent.substring(0, 50),
        userId,
        conversationId,
        showWorkflowProgress
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageContent,        // Fix 2: Use standard 'query' field for Dify API
          message: messageContent,      // Keep 'message' for compatibility
          user: userId || 'default-user',
          conversation_id: conversationId,
          response_mode: showWorkflowProgress ? 'streaming' : 'blocking',
          stream: showWorkflowProgress, // Keep existing stream parameter
          inputs: inputs || {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chat Error] Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 200)
        });
        
        const errorData = errorText ? (() => {
          try { return JSON.parse(errorText); } 
          catch { return { error: errorText }; }
        })() : { error: `HTTP ${response.status}` };
        
        // 检查是否是可重试的错误
        const isRetriableError = response.status >= 500 || response.status === 408 || response.status === 429;
        
        if (isRetriableError && currentRetry < maxRetries) {
          console.warn(`🔄 Request failed with ${response.status}, retrying... (attempt ${currentRetry + 1}/${maxRetries + 1})`);
          setRetryCount(currentRetry + 1);
          
          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, currentRetry), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return sendMessageWithRetry(messageContent, currentRetry + 1);
        }
        
        throw new Error(errorData.error || `服务器错误 (${response.status}) - ${errorText.substring(0, 100)}`);
      }

      // Fix 4: Improve Stream Response Processing with fallback
      if (showWorkflowProgress && response.body) {
        try {
          await handleWorkflowStream(response, messageContent);
        } catch (streamError) {
          console.warn('[Chat] Stream processing failed, falling back to regular response:', streamError);
          // Fallback to regular response processing
          try {
            const data = await response.json();
            await handleRegularResponse(data, messageContent);
          } catch (jsonError) {
            console.error('[Chat] Both stream and JSON parsing failed:', jsonError);
            throw new Error('无法处理服务器响应，请重试');
          }
        }
      } else {
        // 处理普通响应
        const data = await response.json();
        await handleRegularResponse(data, messageContent);
      }

      // 重置重试计数
      setRetryCount(0);
      
    } catch (error) {
      console.error('[Chat] Error:', error);
      
      // Fix 3: Enhanced Error Handling and Debugging
      console.error('[Chat Error] Request failed:', {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        messageContent: messageContent.substring(0, 50),
        userId,
        showWorkflowProgress,
        currentRetry
      });
      
      // 处理取消请求
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = showWorkflowProgress 
          ? '工作流执行超时，请稍后重试或联系管理员'
          : '请求超时，请稍后重试';
        throw new Error(timeoutError);
      }
      
      // 如果还有重试机会且是网络错误
      if (currentRetry < maxRetries && enableRetry) {
        console.warn(`🔄 Network error, retrying... (attempt ${currentRetry + 1}/${maxRetries + 1})`);
        setRetryCount(currentRetry + 1);
        
        const delay = Math.min(1000 * Math.pow(2, currentRetry), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return sendMessageWithRetry(messageContent, currentRetry + 1);
      }
      
      throw error;
    }
  };

  // 处理工作流流式响应
  const handleWorkflowStream = async (response: Response, messageContent: string) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法获取响应流');

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              // 流结束，添加最终消息
              if (finalResponse) {
                const assistantMessage: Message = {
                  id: `assistant_${Date.now()}`,
                  content: finalResponse,
                  role: 'assistant',
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, assistantMessage]);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              // 更新会话ID
              if (parsed.conversation_id && parsed.conversation_id !== conversationId) {
                setConversationId(parsed.conversation_id);
              }

              // 处理工作流节点事件
              if (parsed.event === 'node_started' && parsed.node_id) {
                updateWorkflowProgress({
                  nodeId: parsed.node_id,
                  nodeName: parsed.node_name || parsed.node_id,
                  nodeTitle: parsed.node_title,
                  status: 'running',
                  startTime: new Date()
                });
              } else if (parsed.event === 'node_finished' && parsed.node_id) {
                updateWorkflowProgress({
                  nodeId: parsed.node_id,
                  status: 'completed',
                  endTime: new Date()
                });
              } else if (parsed.event === 'node_failed' && parsed.node_id) {
                updateWorkflowProgress({
                  nodeId: parsed.node_id,
                  status: 'failed',
                  endTime: new Date(),
                  error: parsed.error || '节点执行失败'
                });
              }

              // 累积最终答案
              if (parsed.answer) {
                finalResponse += parsed.answer;
              }

            } catch (parseError) {
              console.warn('解析流数据失败:', data, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  // Fix 5: Add Response Validation - 处理普通响应
  const handleRegularResponse = async (data: { 
    answer?: string; 
    content?: string; 
    message?: string; 
    conversation_id?: string; 
    metadata?: Message['metadata'];
  }, messageContent: string) => {
    console.log('[Chat] Received response:', data);

    // Validate response structure
    if (!data || (!data.answer && !data.content && !data.message)) {
      console.error('[Chat] Invalid response structure:', data);
      throw new Error('服务器返回了无效的响应格式');
    }

    // 更新会话ID
    if (data.conversation_id && data.conversation_id !== conversationId) {
      setConversationId(data.conversation_id);
      console.log('[Chat] Updated conversation ID:', data.conversation_id);
    }

    // 添加助手回复 - Better content extraction
    const assistantMessage: Message = {
      id: `assistant_${Date.now()}`,
      content: data.answer || data.content || data.message || '抱歉，我无法处理您的请求。',
      role: 'assistant',
      timestamp: new Date(),
      metadata: data.metadata,
    };

    setMessages(prev => [...prev, assistantMessage]);
  };

  // 主要的表单提交处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    try {
      await sendMessageWithRetry(userMessage.content);
    } catch (error) {
      console.error('[Chat] Final Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      
      // 添加错误消息
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        content: `抱歉，我遇到了一个错误：${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setWorkflowState(prev => ({ ...prev, isWorkflow: false, currentNodeId: undefined }));
      // 聚焦输入框
      inputRef.current?.focus();
    }
  };

  // 重试最后一条消息
  const handleRetry = async () => {
    const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
    if (!lastUserMessage || isLoading) return;

    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    try {
      await sendMessageWithRetry(lastUserMessage.content);
    } catch (error) {
      console.error('[Chat] Retry Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setWorkflowState(prev => ({ ...prev, isWorkflow: false, currentNodeId: undefined }));
    }
  };
  // 开始新对话
  const handleNewConversation = () => {
    setMessages(welcomeMessage ? [{
      id: 'welcome',
      content: welcomeMessage,
      role: 'assistant',
      timestamp: new Date(),
    }] : []);
    setConversationId(null);
    setInput('');
    setError(null);
    setRetryCount(0);
    setWorkflowState({
      isWorkflow: false,
      nodes: [],
      completedNodes: 0
    });
    console.log('[Chat] Started new conversation');
    inputRef.current?.focus();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-lg shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">AI Assistant</h3>
          {mode === 'chat' && showWorkflowProgress && (
            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
              Chat + Workflow Progress
            </span>
          )}
          {mode === 'workflow' && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">
              Workflow Mode
            </span>
          )}
        </div>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all"
          title="Start New Conversation"
        >
          <RotateCcw className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
            )}
            
            <div
              className={cn(
                "max-w-[70%] rounded-lg px-4 py-3",
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <span className={cn(
                "text-xs mt-2 block",
                message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
              )}>
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3 max-w-[70%]">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                <span className="text-gray-600">
                  {showWorkflowProgress ? '执行工作流中...' : 'AI思考中...'}
                </span>
                {retryCount > 0 && (
                  <span className="text-xs text-orange-600">
                    (重试 {retryCount}/3)
                  </span>
                )}
              </div>
              
              {/* 工作流进度显示 */}
              {showWorkflowProgress && workflowState.isWorkflow && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-500 mb-2">
                    工作流进度: {workflowState.completedNodes}/{workflowState.nodes.length} 个节点已完成
                  </div>
                  
                  {/* 进度条 */}
                  {workflowState.nodes.length > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(workflowState.completedNodes / workflowState.nodes.length) * 100}%` 
                        }}
                      />
                    </div>
                  )}

                  {/* 节点状态列表 */}
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {workflowState.nodes.map((node) => (
                      <div 
                        key={node.nodeId} 
                        className={cn(
                          "flex items-center gap-2 text-xs p-2 rounded",
                          node.status === 'running' && "bg-blue-50 border border-blue-200",
                          node.status === 'completed' && "bg-green-50 border border-green-200",
                          node.status === 'failed' && "bg-red-50 border border-red-200",
                          node.status === 'waiting' && "bg-gray-50 border border-gray-200"
                        )}
                      >
                        {/* 状态图标 */}
                        {node.status === 'waiting' && <Clock className="w-3 h-3 text-gray-400" />}
                        {node.status === 'running' && <Play className="w-3 h-3 text-blue-600 animate-pulse" />}
                        {node.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                        {node.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-600" />}
                        
                        {/* 节点信息 */}
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "font-medium truncate",
                            node.status === 'running' && "text-blue-700",
                            node.status === 'completed' && "text-green-700",
                            node.status === 'failed' && "text-red-700",
                            node.status === 'waiting' && "text-gray-600"
                          )}>
                            {node.nodeTitle || node.nodeName}
                          </div>
                          {node.error && (
                            <div className="text-red-600 text-xs mt-1">
                              错误: {node.error}
                            </div>
                          )}
                        </div>

                        {/* 执行时间 */}
                        {node.status === 'running' && node.startTime && (
                          <div className="text-gray-500 text-xs">
                            {Math.floor((Date.now() - node.startTime.getTime()) / 1000)}s
                          </div>
                        )}
                        {node.status === 'completed' && node.startTime && node.endTime && (
                          <div className="text-gray-500 text-xs">
                            {Math.floor((node.endTime.getTime() - node.startTime.getTime()) / 1000)}s
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm mb-2">{error}</p>
            {enableRetry && (
              <button
                onClick={handleRetry}
                disabled={isLoading}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-all disabled:opacity-50"
              >
                重试发送
              </button>
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "px-4 py-2.5 rounded-lg font-medium transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              !input.trim() || isLoading
                ? "bg-gray-300 text-gray-500"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Character count */}
        <div className="mt-2 text-xs text-gray-500 text-right">
          {input.length} / 2000 characters
        </div>
      </form>

      {/* Debug Info (仅开发环境) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2 bg-gray-100 text-xs text-gray-600 border-t space-y-1">
          <div>Mode: {mode}</div>
          <div>User ID: {userId}</div>
          <div>Conversation ID: {conversationId || 'None'}</div>
          <div>Messages: {messages.length}</div>
          <div>Retry Count: {retryCount}</div>
          {workflowState.isWorkflow && (
            <>
              <div>Workflow Nodes: {workflowState.nodes.length}</div>
              <div>Completed: {workflowState.completedNodes}</div>
              <div>Current Node: {workflowState.currentNodeId || 'None'}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 导出默认配置的聊天组件
export function ChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] z-50">
      <DifyChatInterface 
        className="h-full"
        welcomeMessage="Hi! I'm your AI assistant. How can I help you today?"
      />
    </div>
  );
}
