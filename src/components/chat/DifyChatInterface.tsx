'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RotateCcw, Bot, User, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn, isValidUUID } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, unknown>;
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
  
  // 🔧 修复：安全的用户ID初始化
  const [userId, setUserId] = useState<string>('');
  const [isUserIdReady, setIsUserIdReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔧 修复：在 useEffect 中安全初始化 userId 和恢复会话状态
  useEffect(() => {
    const initUserIdAndSession = () => {
      if (typeof window !== 'undefined') {
        // 初始化用户ID
        const stored = localStorage.getItem('dify_user_id');
        if (stored) {
          setUserId(stored);
        } else {
          const newId = `user_${Math.random().toString(36).substring(2, 15)}`;
          setUserId(newId);
          localStorage.setItem('dify_user_id', newId);
        }
        
        // 🔧 修复：恢复工作流会话状态 - 确保会话连续性
        const workflowConversationId = localStorage.getItem('dify_workflow_conversation_id');
        const regularConversationId = localStorage.getItem('dify_conversation_id');
        
        // 优先使用工作流会话ID，因为它更具体
        const restoredConversationId = workflowConversationId || regularConversationId;
        
        if (restoredConversationId && isValidUUID(restoredConversationId)) {
          console.log('[Chat Debug] Restored conversation ID from localStorage:', restoredConversationId);
          setConversationId(restoredConversationId);
        } else {
          console.log('[Chat Debug] No valid conversation ID found in localStorage');
        }
        
        setIsUserIdReady(true);
        return;
      }
      
      const newId = `user_${Math.random().toString(36).substring(2, 15)}`;
      setUserId(newId);
      setIsUserIdReady(true);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('dify_user_id', newId);
      }
    };
    
    initUserIdAndSession();
  }, []);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 添加欢迎消息 - 等待 userId 准备完成
  useEffect(() => {
    if (messages.length === 0 && welcomeMessage && isUserIdReady) {
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [welcomeMessage, isUserIdReady]);

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
    
    try {
      // Check if we have a valid conversation ID for targeted API calls
      const endpoint = conversationId && isValidUUID(conversationId)
        ? `/api/dify/${conversationId}` 
        : '/api/dify';
      
      // Fix 3: Enhanced Error Handling and Debugging - Add comprehensive logging
      console.log('[Chat Debug] Sending request:', {
        endpoint,
        messageContent: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
        userId,
        conversationId,
        workflowConversationId: localStorage.getItem('dify_workflow_conversation_id'),
        regularConversationId: localStorage.getItem('dify_conversation_id'),
        showWorkflowProgress,
        timestamp: new Date().toISOString()
      });

      // 重置工作流状态
      if (showWorkflowProgress) {
        setWorkflowState({
          isWorkflow: true,
          nodes: [],
          completedNodes: 0
        });
      }

      // 🔧 修复：改进超时机制 - 为工作流提供更长的超时时间
      const timeoutMs = showWorkflowProgress ? 5 * 60 * 1000 : 2 * 60 * 1000; // 5min for workflows, 2min for regular chat

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Chat Debug] Request timeout after', timeoutMs / 1000, 'seconds');
        controller.abort();
      }, timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Fix 2: Standardize Request Format - Use both fields for compatibility
          query: messageContent,        // Standard field expected by Dify API
          message: messageContent,      // Keep for backward compatibility
          user: userId || 'default-user',
          conversation_id: conversationId,
          response_mode: showWorkflowProgress ? 'streaming' : 'blocking',
          stream: showWorkflowProgress, // 启用流式响应以获取工作流进度
          inputs: {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Fix 3: Enhanced Error Handling - Better error reporting
        let errorText = '';
        let errorData = null;
        
        try {
          errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error('[Chat Error] Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          body: errorText.substring(0, 200) + (errorText.length > 200 ? '...' : ''),
          timestamp: new Date().toISOString()
        });
        
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
        
        throw new Error(errorData.error || `服务器错误 (${response.status})`);
      }

      // Fix 4: Improve Stream Response Processing with fallback
      if (showWorkflowProgress && response.body) {
        try {
          await handleWorkflowStream(response, messageContent);
        } catch (streamError) {
          console.warn('[Chat Debug] Stream processing failed, falling back to regular response:', streamError);
          // 🔧 修复：保持会话连续性的回退机制
          try {
            // 获取或恢复会话ID - 优先使用当前会话ID，其次从localStorage恢复，最后才创建新的
            const fallbackConversationId = conversationId || 
              localStorage.getItem('dify_workflow_conversation_id') || 
              localStorage.getItem('dify_conversation_id') || 
              null;
            
            console.log('[Chat Debug] Attempting fallback request with preserved conversation ID:', fallbackConversationId);
            
            // 使用保持会话连续性的endpoint
            const fallbackEndpoint = fallbackConversationId && isValidUUID(fallbackConversationId)
              ? `/api/dify/${fallbackConversationId}` 
              : '/api/dify';
            
            const fallbackResponse = await fetch(fallbackEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: messageContent,
                message: messageContent,
                user: userId || 'default-user',
                conversation_id: fallbackConversationId, // 🔧 关键修复：传递会话ID保持连续性
                response_mode: 'blocking', // Force blocking mode for fallback
                stream: false,
                inputs: {}
              }),
              signal: controller.signal
            });

            if (!fallbackResponse.ok) {
              throw new Error(`Fallback request failed: ${fallbackResponse.status}`);
            }

            const data = await fallbackResponse.json();
            // 🔧 修复：在fallback时保持会话ID连续性
            if (data.conversation_id && data.conversation_id !== conversationId) {
              console.log('[Chat Debug] Fallback response updated conversation ID from', conversationId, 'to', data.conversation_id);
              setConversationId(data.conversation_id);
              localStorage.setItem('dify_workflow_conversation_id', data.conversation_id);
              localStorage.setItem('dify_conversation_id', data.conversation_id);
            }
            
            await handleRegularResponse(data, messageContent);
            console.log('[Chat Debug] Fallback request succeeded with preserved session');
          } catch (fallbackError) {
            console.error('[Chat Debug] Fallback processing also failed:', fallbackError);
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
      // Fix 3: Enhanced Error Handling - Better error logging and user messages
      console.error('[Chat] Error sending message:', error);
      
      // 处理取消请求
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = showWorkflowProgress 
          ? '复杂工作流执行超时（5分钟）。如果您的工作流包含20+个节点，这可能需要更多时间。请尝试简化请求或稍后重试。'
          : '请求超时（2分钟），请稍后重试';
        throw new Error(timeoutError);
      }
      
      // Handle specific error cases for better user experience
      let userFriendlyMessage = '发送消息时发生错误，请重试';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          userFriendlyMessage = '网络连接失败，请检查网络后重试';
        } else if (error.message.includes('timeout') || error.message.includes('超时')) {
          userFriendlyMessage = '请求超时，请稍后重试';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          userFriendlyMessage = '服务器内部错误，请稍后重试';
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          userFriendlyMessage = '请求格式错误，请重新发送消息';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          userFriendlyMessage = '认证失败，请刷新页面后重试';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          userFriendlyMessage = '访问被拒绝，请联系管理员';
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          userFriendlyMessage = '服务不可用，请联系管理员';
        } else {
          userFriendlyMessage = `错误：${error.message}`;
        }
      }
      
      // 如果还有重试机会且是网络错误
      if (currentRetry < maxRetries && enableRetry) {
        console.warn(`🔄 Network error, retrying... (attempt ${currentRetry + 1}/${maxRetries + 1})`);
        setRetryCount(currentRetry + 1);
        
        const delay = Math.min(1000 * Math.pow(2, currentRetry), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return sendMessageWithRetry(messageContent, currentRetry + 1);
      }
      
      throw new Error(userFriendlyMessage);
    }
  };

  // 处理工作流流式响应 - 修复SSE解析和会话管理问题
  const handleWorkflowStream = async (response: Response, messageContent: string) => {
    console.log('[Chat Debug] Starting workflow stream processing');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法获取响应流');

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse = '';
    let detectedConversationId = conversationId; // 保持会话ID连续性
    
    // 🔧 修复：优化SSE解析参数
    const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5分钟超时
    const MAX_ITERATIONS = 10000; // 最大迭代次数防止无限循环
    const STALL_TIMEOUT_MS = 30 * 1000; // 30秒无数据则认为停滞
    
    let iterationCount = 0;
    let lastProgressTime = Date.now();
    let hasReceivedData = false;
    let processedDataCount = 0; // 跟踪处理的数据块数量

    try {
      // 创建超时控制器
      const streamController = new AbortController();
      const streamTimeoutId = setTimeout(() => {
        console.warn('[Chat Debug] Stream timeout after 5 minutes');
        streamController.abort();
      }, STREAM_TIMEOUT_MS);

      // 包装流读取以支持超时
      const readWithTimeout = async () => {
        return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Stream read timeout'));
          }, STALL_TIMEOUT_MS);

          reader.read().then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          }).catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
        });
      };

      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        
        // 检查是否被中止
        if (streamController.signal.aborted) {
          console.warn('[Chat Debug] Stream processing aborted due to timeout');
          throw new Error('流处理超时（5分钟）');
        }

        // 检查停滞时间
        const currentTime = Date.now();
        if (hasReceivedData && (currentTime - lastProgressTime) > STALL_TIMEOUT_MS) {
          console.warn('[Chat Debug] Stream stalled for 30 seconds, breaking loop');
          throw new Error('流式响应停滞，可能服务器连接异常');
        }

        let result;
        try {
          result = await readWithTimeout();
        } catch (readError) {
          console.error('[Chat Debug] Stream read error:', readError);
          if (hasReceivedData && finalResponse.trim()) {
            // 如果已有数据，尝试优雅降级
            console.log('[Chat Debug] Graceful degradation with existing data');
            break;
          }
          throw new Error('流读取失败：' + (readError instanceof Error ? readError.message : '未知错误'));
        }

        const { done, value } = result;
        
        if (done) {
          console.log('[Chat Debug] Stream naturally ended after', iterationCount, 'iterations');
          break;
        }

        if (value && value.length > 0) {
          hasReceivedData = true;
          lastProgressTime = currentTime;
          
          // 🔧 修复：添加原始数据调试日志
          const chunk = decoder.decode(value, { stream: true });
          console.log('[Chat Debug] Raw chunk received:', {
            length: chunk.length,
            preview: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''),
            iteration: iterationCount
          });
          
          buffer += chunk;
          
          // 🔧 修复：改进跨chunk数据分割处理
          // 检查buffer中是否有完整的行
          let lineEndIndex;
          const processedLines: string[] = [];
          
          while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEndIndex).trim();
            if (line) {
              processedLines.push(line);
            }
            buffer = buffer.substring(lineEndIndex + 1);
          }

          console.log('[Chat Debug] Processing', processedLines.length, 'complete lines, iteration', iterationCount, 'remaining buffer:', buffer.length);

          for (const line of processedLines) {
            // 🔧 修复：增强data:前缀识别和处理
            if (line.startsWith('data:')) {
              const data = line.substring(5).trim(); // 使用substring而不是slice，更明确
              
              if (data === '[DONE]') {
                console.log('[Chat Debug] Stream ended with [DONE], finalResponse length:', finalResponse.length);
                clearTimeout(streamTimeoutId);
                // 流结束，添加最终消息 - 确保会话ID连续性
                if (finalResponse.trim()) {
                  const assistantMessage: Message = {
                    id: `assistant_${Date.now()}`,
                    content: finalResponse.trim(),
                    role: 'assistant',
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  console.log('[Chat Debug] Added assistant message from stream with conversation ID:', detectedConversationId);
                  
                  // 保存工作流状态到localStorage
                  if (detectedConversationId) {
                    localStorage.setItem('dify_workflow_conversation_id', detectedConversationId);
                    console.log('[Chat Debug] Saved workflow conversation ID to localStorage:', detectedConversationId);
                  }
                } else {
                  console.warn('[Chat Debug] Stream completed but no content accumulated, using fallback');
                  // 触发回退机制 - 抛出错误让外层 catch 处理
                  throw new Error('流式响应未获取到内容');
                }
                return;
              }

              if (data) {
                processedDataCount++;
                try {
                  const parsed = JSON.parse(data);
                  console.log('[Chat Debug] Parsed stream data:', {
                    event: parsed.event,
                    hasAnswer: !!parsed.answer,
                    answerLength: parsed.answer?.length || 0,
                    conversationId: parsed.conversation_id,
                    messageId: parsed.message_id,
                    iteration: iterationCount,
                    dataBlockIndex: processedDataCount
                  });
                  
                  // 🔧 修复：保持会话连续性 - 只在第一次或明确不同时更新会话ID
                  if (parsed.conversation_id && 
                      (!detectedConversationId || parsed.conversation_id !== detectedConversationId)) {
                    console.log('[Chat Debug] Updating conversation ID from', detectedConversationId, 'to', parsed.conversation_id);
                    detectedConversationId = parsed.conversation_id;
                    setConversationId(parsed.conversation_id);
                  }

                  // 处理工作流节点事件
                  if (parsed.event === 'node_started' && parsed.node_id) {
                    console.log('[Chat Debug] Node started:', parsed.node_id, parsed.node_name);
                    updateWorkflowProgress({
                      nodeId: parsed.node_id,
                      nodeName: parsed.node_name || parsed.node_id,
                      nodeTitle: parsed.node_title,
                      status: 'running',
                      startTime: new Date()
                    });
                  } else if (parsed.event === 'node_finished' && parsed.node_id) {
                    console.log('[Chat Debug] Node finished:', parsed.node_id);
                    updateWorkflowProgress({
                      nodeId: parsed.node_id,
                      status: 'completed',
                      endTime: new Date()
                    });
                  } else if (parsed.event === 'node_failed' && parsed.node_id) {
                    console.log('[Chat Debug] Node failed:', parsed.node_id, parsed.error);
                    updateWorkflowProgress({
                      nodeId: parsed.node_id,
                      status: 'failed',
                      endTime: new Date(),
                      error: parsed.error || '节点执行失败'
                    });
                  }

                  // 🔧 修复：正确解析和累积消息内容 - 处理更多格式
                  if (parsed.event === 'message' && parsed.answer) {
                    console.log('[Chat Debug] Accumulating message answer:', parsed.answer.length, 'chars');
                    finalResponse += parsed.answer;
                  } else if (parsed.answer && !parsed.event) {
                    // 兼容性处理：如果没有event字段但有answer字段
                    console.log('[Chat Debug] Accumulating direct answer:', parsed.answer.length, 'chars');  
                    finalResponse += parsed.answer;
                  } else if (parsed.event === 'message_end' && parsed.answer) {
                    // 处理message_end事件中的answer
                    console.log('[Chat Debug] Accumulating message_end answer:', parsed.answer.length, 'chars');
                    finalResponse += parsed.answer;
                  }

                } catch (parseError) {
                  console.warn('[Chat Debug] 解析流数据失败:', {
                    data: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
                    error: parseError,
                    line: line.substring(0, 100) + (line.length > 100 ? '...' : '')
                  });
                }
              }
            }
          }
        }
      }

      // 如果达到最大迭代次数
      if (iterationCount >= MAX_ITERATIONS) {
        console.warn('[Chat Debug] Reached maximum iterations, breaking loop');
        if (finalResponse.trim()) {
          console.log('[Chat Debug] Using accumulated response despite reaching max iterations');
        } else {
          throw new Error('流处理达到最大迭代次数限制，可能存在无限循环');
        }
      }

      // 清理超时
      clearTimeout(streamTimeoutId);

      // 如果循环正常结束但没有收到 [DONE] 信号，处理已收集的数据
      if (finalResponse.trim()) {
        console.log('[Chat Debug] Stream ended without [DONE], using accumulated response');
        const assistantMessage: Message = {
          id: `assistant_${Date.now()}`,
          content: finalResponse.trim(),
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        console.log('[Chat Debug] Added assistant message from incomplete stream');
        
        // 保存工作流状态到localStorage
        if (detectedConversationId) {
          localStorage.setItem('dify_workflow_conversation_id', detectedConversationId);
          console.log('[Chat Debug] Saved workflow conversation ID to localStorage:', detectedConversationId);
        }
      } else {
        console.warn('[Chat Debug] Stream ended without content, triggering fallback');
        throw new Error('流式响应处理完成但未获取到内容');
      }

    } finally {
      try {
        reader.releaseLock();
        console.log('[Chat Debug] Stream reader released after', iterationCount, 'iterations with processed data blocks:', processedDataCount);
      } catch (releaseError) {
        console.warn('[Chat Debug] Error releasing stream reader:', releaseError);
      }
    }
  };

  // Fix 5: Enhanced regular response handling with validation
  const handleRegularResponse = async (data: Record<string, unknown>, messageContent: string) => {
    console.log('[Chat Debug] Received response:', {
      hasAnswer: !!data.answer,
      hasContent: !!data.content,
      hasMessage: !!data.message,
      hasResult: !!data.result,
      conversationId: data.conversation_id,
      messageId: data.message_id,
      keys: Object.keys(data)
    });

    // Fix 5: Add Response Validation
    if (!data || (typeof data !== 'object')) {
      throw new Error('服务器返回了无效的响应格式');
    }

    // Validate response has some content
    if (!data.answer && !data.content && !data.message && !data.result) {
      console.error('[Chat Debug] Empty response received:', data);
      throw new Error('服务器返回了空的响应内容');
    }

    // Fix 5: Update conversation ID if provided and different
    if (data.conversation_id && typeof data.conversation_id === 'string' && data.conversation_id !== conversationId) {
      setConversationId(data.conversation_id);
      console.log('[Chat Debug] Updated conversation ID:', data.conversation_id);
    }

    // Fix 5: Better content extraction with multiple fallbacks
    const responseContent = (
      (typeof data.answer === 'string' ? data.answer : '') ||
      (typeof data.content === 'string' ? data.content : '') ||
      (typeof data.message === 'string' ? data.message : '') ||
      (typeof data.result === 'string' ? data.result : '') ||
      '抱歉，我无法处理您的请求。'
    );

    console.log('[Chat Debug] Extracted response content:', {
      length: responseContent.length,
      preview: responseContent.substring(0, 100) + (responseContent.length > 100 ? '...' : '')
    });

    // 添加助手回复
    const assistantMessage: Message = {
      id: `assistant_${Date.now()}`,
      content: responseContent,
      role: 'assistant',
      timestamp: new Date(),
      metadata: data.metadata,
    };

    setMessages(prev => [...prev, assistantMessage]);
    console.log('[Chat Debug] Added assistant message from regular response');
  };

  // 主要的表单提交处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isUserIdReady) return;

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
  
  // 开始新对话 - 修复会话状态管理
  const handleNewConversation = () => {
    console.log('[Chat Debug] Starting new conversation - clearing previous session state');
    
    setMessages(welcomeMessage ? [{
      id: 'welcome',
      content: welcomeMessage,
      role: 'assistant',
      timestamp: new Date(),
    }] : []);
    
    // 🔧 修复：只有用户主动开始新对话时才清除会话ID
    setConversationId(null);
    setInput('');
    setError(null);
    setRetryCount(0);
    setWorkflowState({
      isWorkflow: false,
      nodes: [],
      completedNodes: 0
    });
    
    // 🔧 修复：清除存储的会话状态，确保下次是全新开始
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dify_conversation_id');
      localStorage.removeItem('dify_workflow_conversation_id');
      localStorage.removeItem('dify_workflow_state');
      console.log('[Chat Debug] Cleared stored conversation and workflow state');
    }
    
    console.log('[Chat Debug] Started new conversation - all session state cleared');
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
                  {showWorkflowProgress ? '处理复杂工作流中，请耐心等待...' : 'AI思考中...'}
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
            disabled={isLoading || !isUserIdReady}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isUserIdReady}
            className={cn(
              "px-4 py-2.5 rounded-lg font-medium transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              !input.trim() || isLoading || !isUserIdReady
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
          <div>User ID Ready: {isUserIdReady ? 'Yes' : 'No'}</div>
          <div>Conversation ID: {conversationId || 'None'}</div>
          <div>Stored Workflow Conv ID: {typeof window !== 'undefined' ? localStorage.getItem('dify_workflow_conversation_id') || 'None' : 'N/A'}</div>
          <div>Stored Regular Conv ID: {typeof window !== 'undefined' ? localStorage.getItem('dify_conversation_id') || 'None' : 'N/A'}</div>
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
