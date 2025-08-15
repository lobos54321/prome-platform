'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RotateCcw, Bot, User, Play, CheckCircle, AlertCircle, Clock, MessageSquare, X, Trash2, Cloud, Wifi, WifiOff, Code, FileText, Database, Settings, Users, MessageCircle, Zap, Cpu, Globe } from 'lucide-react';
import { cn, isValidUUID, generateUUID } from '@/lib/utils';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';
import { cloudChatHistory, ChatConversation } from '@/lib/cloudChatHistory';
import { chatHistoryMigration } from '@/lib/chatHistoryMigration';

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
  nodeType?: string;
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

interface ConversationHistoryItem {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  messageCount: number;
  messages: Message[];
  workflowState?: WorkflowState;
}

interface ChatHistoryState {
  conversations: ConversationHistoryItem[];
  currentConversationId: string | null;
  isCloudSyncEnabled: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncTime?: Date;
}

interface DifyChatInterfaceProps {
  className?: string;
  placeholder?: string;
  welcomeMessage?: string;
  mode?: 'chat' | 'workflow'; // 支持不同模式
  showWorkflowProgress?: boolean; // 是否显示工作流进度
  enableRetry?: boolean; // 是否启用重试功能
  user?: { id: string; email: string; name: string }; // 已认证用户信息
}

// 获取工作流节点图标的辅助函数
const getNodeIcon = (nodeType?: string) => {
  if (!nodeType) return Clock;
  
  const type = nodeType.toLowerCase();
  
  if (type.includes('llm') || type.includes('ai') || type.includes('model')) return Bot;
  if (type.includes('code') || type.includes('python') || type.includes('javascript')) return Code;
  if (type.includes('knowledge') || type.includes('retrieval') || type.includes('document')) return FileText;
  if (type.includes('database') || type.includes('sql') || type.includes('query')) return Database;
  if (type.includes('parameter') || type.includes('variable') || type.includes('setting')) return Settings;
  if (type.includes('human') || type.includes('user') || type.includes('approval')) return Users;
  if (type.includes('message') || type.includes('text') || type.includes('template')) return MessageCircle;
  if (type.includes('tool') || type.includes('api') || type.includes('webhook')) return Zap;
  if (type.includes('http') || type.includes('request') || type.includes('url')) return Globe;
  if (type.includes('condition') || type.includes('if') || type.includes('logic')) return Cpu;
  
  return Clock; // 默认图标
};

export function DifyChatInterface({
  className,
  placeholder = "Type your message...",
  welcomeMessage = "Hello! How can I help you today?",
  mode = 'chat',
  showWorkflowProgress = true,
  enableRetry = true,
  user
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
  
  // 🔍 专用的模型提取函数 - 基于实际测试发现的Dify API字段
  const extractModelFromResponse = (data: any, source: string): string | null => {
    // 🎯 基于实际测试，发现Dify API在node_finished事件中返回模型信息：
    // data.process_data.model_name = "gpt-4.1-nano-2025-04-14"
    // data.process_data.model_provider = "langgenius/openai/openai"
    const possiblePaths = [
      // 🔥 优先搜索实际测试中发现的字段
      'data.process_data.model_name',
      'data.process_data.model_provider',
      'process_data.model_name',
      'process_data.model_provider',
      // 🔥 用户提到的后台字段
      'model_name',
      'model_provider', 
      'data.model_name',
      'data.model_provider',
      'metadata.model_name',
      'metadata.model_provider',
      // 其他可能的路径
      'execution_metadata.model_name',
      'execution_metadata.model_provider',
      'node_data.model_name',
      'node_data.model_provider',
      'metadata.usage.model',
      'metadata.model', 
      'metadata.llm_model',
      'metadata.provider',
      'model',
      'llm_model',
      'provider',
      'usage.model',
      'data.model',
      'data.llm_model',
      'data.model_config.model',
      'data.model_config.provider',
      'data.model_config.model_name',
      'execution_metadata.model',
      'node_data.model',
      // 嵌套更深层的可能路径
      'data.execution_metadata.model_name',
      'data.execution_metadata.model_provider',
      'workflow_data.model_name',
      'workflow_data.model_provider'
    ];
    
    let extractedModel = null;
    let extractionPath = null;
    
    // 🔍 详细记录所有尝试的路径和值
    const pathResults = [];
    
    for (const path of possiblePaths) {
      const value = path.split('.').reduce((obj, key) => obj?.[key], data);
      pathResults.push({
        path,
        value: value,
        type: typeof value,
        isValid: value && typeof value === 'string' && value !== 'undefined'
      });
      
      if (value && typeof value === 'string' && value !== 'undefined') {
        extractedModel = value;
        extractionPath = path;
        break;
      }
    }
    
    // 🎯 特别处理：如果找到了模型信息，记录成功提取
    if (extractedModel) {
      console.log(`[Model Extraction] ✅ 成功提取模型: ${extractedModel} (来源: ${source}, 路径: ${extractionPath})`);
    } else {
      // 🔍 如果没找到，记录详细的调试信息
      console.log(`[Model Extraction] ❌ ${source} - 未找到模型信息:`, {
        extracted_model: extractedModel,
        extraction_path: extractionPath,
        data_structure: JSON.stringify(data, null, 2),
        key_paths_checked: pathResults.filter(r => r.value !== undefined).slice(0, 5),
        data_keys: Object.keys(data || {}),
        search_attempted: possiblePaths.length
      });
    }
    
    return extractedModel;
  };
  
  // Token monitoring for balance deduction
  const { processTokenUsage } = useTokenMonitoring();
  
  // 🔧 修复：安全的用户ID初始化
  const [userId, setUserId] = useState<string>('');
  const [isUserIdReady, setIsUserIdReady] = useState(false);
  
  // 🆕 对话历史管理 (云端版本)
  const [chatHistory, setChatHistory] = useState<ChatHistoryState>({
    conversations: [],
    currentConversationId: null,
    isCloudSyncEnabled: true,
    syncStatus: 'idle'
  });
  const [showHistory, setShowHistory] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    needsMigration: boolean;
    isChecking: boolean;
    isMigrating: boolean;
  }>({
    needsMigration: false,
    isChecking: true,
    isMigrating: false
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔧 新增：调试工具函数
  const debugWorkflowStatus = () => {
    if (typeof window !== 'undefined') {
      const debug = {
        currentConversationId: conversationId,
        storedRegularId: localStorage.getItem('dify_conversation_id'),
        userId: userId,
        isUserIdReady: isUserIdReady,
        workflowState: workflowState,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1],
        isLoading: isLoading,
        error: error
      };
      
      console.table(debug);
      console.log('[Debug] Full workflow state:', workflowState);
      console.log('[Debug] LocalStorage contents:', {
        dify_user_id: localStorage.getItem('dify_user_id'),
        dify_conversation_id: localStorage.getItem('dify_conversation_id'),
        dify_workflow_state: localStorage.getItem('dify_workflow_state')
      });
      
      return debug;
    }
    return null;
  };

  // 🔧 新增：在开发环境下暴露调试函数到window对象
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      (window as any).debugChat = {
        debugWorkflowStatus,
        resetConversation: handleNewConversation,
        getCurrentState: () => ({
          conversationId,
          userId,
          workflowState,  
          messages: messages.length,
          isLoading,
          error
        }),
        // 🆕 调试localStorage状态
        checkLocalStorage: () => {
          const localStorage_data = {
            dify_user_id: localStorage.getItem('dify_user_id'),
            dify_conversation_id: localStorage.getItem('dify_conversation_id'),
            dify_messages: localStorage.getItem('dify_messages'),
            dify_workflow_state: localStorage.getItem('dify_workflow_state'),
            messages_count: messages.length,
            current_workflow: workflowState.isWorkflow
          };
          console.table(localStorage_data);
          console.log('📋 Complete localStorage dump:', localStorage_data);
          return localStorage_data;
        },
        // 🔧 新增：测试对话流程的工具
        testWorkflowPath: async (message = '你好') => {
          const userId = 'workflow-test-' + Date.now();
          console.log('🧪 测试工作流路径，用户ID:', userId);
          
          const response = await fetch('/api/dify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              message: message,
              user: userId,
              conversation_id: null,
              stream: false
            })
          });
          
          const data = await response.json();
          console.log('🧪 工作流测试结果:');
          console.log('- 回答:', data.answer?.substring(0, 200));
          console.log('- 对话ID:', data.conversation_id);
          console.log('- 元数据:', data.metadata);
          
          return data;
        },
        
        // 🔧 新增：检查用户是否真正进行过有意义对话
        checkRealConversation: () => {
          const hasRealMessages = messages.length > 1 && 
            messages.some(m => m.role === 'user' && 
              m.content.length > 2 && 
              !['你好', 'hello', 'hi'].includes(m.content.toLowerCase()));
          
          const lastActivity = localStorage.getItem('dify_last_real_activity');
          const now = Date.now();
          const hasRecentActivity = lastActivity && (now - parseInt(lastActivity)) < 30 * 60 * 1000; // 30分钟
          
          return {
            hasRealMessages,
            hasRecentActivity,
            shouldReset: !hasRealMessages && !hasRecentActivity
          };
        },
        
        // 🔧 新增：强制重置所有状态的函数
        hardReset: () => {
          console.log('[Debug] Performing hard reset of all chat state...');
          setMessages([]);
          setConversationId(null);
          setInput('');
          setError(null);
          setRetryCount(0);
          setWorkflowState({
            isWorkflow: false,
            nodes: [],
            completedNodes: 0
          });
          
          // 清除所有localStorage和sessionStorage数据
          ['dify_conversation_id', 'dify_conversation_id_streaming', 'dify_user_id', 'dify_workflow_state', 'dify_session_timestamp'].forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          });
          
          // 重新初始化用户ID
          const newUserId = generateUUID();
          setUserId(newUserId);
          localStorage.setItem('dify_user_id', newUserId);
          localStorage.setItem('dify_session_timestamp', Date.now().toString());
          
          console.log('[Debug] Hard reset completed. New user ID:', newUserId);
          return { success: true, newUserId };
        }
      };
      
      console.log('[Debug] Chat debugging utilities available at window.debugChat');
    }
  }, [conversationId, userId, workflowState, messages, isLoading, error]);

  // 🆕 云端对话历史管理函数
  const loadCloudConversations = async () => {
    try {
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const cloudConversations = await cloudChatHistory.getConversations();
      const convertedConversations: ConversationHistoryItem[] = cloudConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessage: conv.last_message || '',
        lastMessageTime: new Date(conv.last_message_time),
        messageCount: conv.message_count,
        messages: [], // 延迟加载消息
        workflowState: conv.workflow_state as WorkflowState
      }));

      setChatHistory(prev => ({
        ...prev,
        conversations: convertedConversations,
        syncStatus: 'idle',
        lastSyncTime: new Date()
      }));

      console.log(`📁 加载了 ${convertedConversations.length} 个云端对话`);
    } catch (error) {
      console.error('Failed to load cloud conversations:', error);
      setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
    }
  };

  const performMigration = async () => {
    try {
      setMigrationStatus(prev => ({ ...prev, isMigrating: true }));
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));

      const migrationResult = await chatHistoryMigration.migrateToCloud();
      
      if (migrationResult.success) {
        console.log(`✅ 迁移完成: ${migrationResult.migratedConversations} 个对话`);
        await chatHistoryMigration.cleanupLocalData();
        await loadCloudConversations();
        
        setMigrationStatus({
          needsMigration: false,
          isChecking: false,
          isMigrating: false
        });
      } else {
        throw new Error(`Migration failed: ${migrationResult.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
      setMigrationStatus(prev => ({ ...prev, isMigrating: false }));
    }
  };

  // 🆕 对话历史管理函数
  const generateConversationTitle = (messages: Message[]): string => {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      // 取前30个字符作为标题
      const title = firstUserMessage.content.substring(0, 30);
      return title.length === 30 ? title + '...' : title;
    }
    return `新对话 ${new Date().toLocaleTimeString()}`;
  };

  const saveConversationToHistory = async () => {
    if (messages.length === 0) return;
    
    try {
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const title = generateConversationTitle(messages);
      // 🔧 修复：使用Dify conversation ID来正确识别对话
      const difyConvId = localStorage.getItem('dify_conversation_id');
      const cloudConversationId = await cloudChatHistory.saveConversation(
        title,
        messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: msg.timestamp,
          metadata: msg.metadata
        })),
        workflowState,
        difyConvId || conversationId || undefined
      );

      // 更新本地状态
      const conversationItem: ConversationHistoryItem = {
        id: cloudConversationId,
        title,
        lastMessage: messages[messages.length - 1]?.content || '',
        lastMessageTime: new Date(),
        messageCount: messages.length,
        messages: [...messages],
        workflowState: { ...workflowState }
      };

      setChatHistory(prev => {
        const existingIndex = prev.conversations.findIndex(c => c.id === conversationItem.id);
        let newConversations;
        
        if (existingIndex >= 0) {
          // 更新现有对话
          newConversations = [...prev.conversations];
          newConversations[existingIndex] = conversationItem;
        } else {
          // 添加新对话到顶部
          newConversations = [conversationItem, ...prev.conversations];
        }
        
        return {
          ...prev,
          conversations: newConversations,
          currentConversationId: conversationItem.id,
          syncStatus: 'idle',
          lastSyncTime: new Date()
        };
      });

      console.log(`💾 已保存对话到云端: ${title}`);
    } catch (error) {
      console.error('Failed to save conversation to cloud:', error);
      setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
    }
  };

  const loadConversationFromHistory = async (conversationId: string) => {
    try {
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      // 🔍 调试：记录加载前的状态
      console.log('[Chat Debug] 🔄 开始加载历史对话:', {
        requestedConversationId: conversationId,
        currentConversationId: conversationId,
        beforeLoad_localStorage_dify_id: localStorage.getItem('dify_conversation_id'),
        beforeLoad_currentMessages: messages.length
      });
      
      // 使用云端服务的专用函数加载历史对话（包含Dify状态恢复）
      const conversationWithMessages = await cloudChatHistory.loadConversationFromHistory(conversationId);
      
      if (!conversationWithMessages) {
        console.warn('Conversation not found in cloud:', conversationId);
        setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
        return;
      }
      
      // 🔍 调试：记录从云端获取的数据
      console.log('[Chat Debug] 📥 从云端获取的对话数据:', {
        cloudConversationId: conversationWithMessages.id,
        difyConversationId: conversationWithMessages.dify_conversation_id,
        messageCount: conversationWithMessages.messages.length,
        hasWorkflowState: !!conversationWithMessages.workflow_state,
        title: conversationWithMessages.title
      });

      // 转换消息格式
      const convertedMessages: Message[] = conversationWithMessages.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: new Date(msg.created_at),
        metadata: msg.metadata
      }));

      // 🔧 强制恢复对话状态和Dify连续性
      setMessages(convertedMessages);
      
      // 确保Dify对话ID被正确设置到localStorage和组件状态
      const difyConvId = conversationWithMessages.dify_conversation_id;
      if (difyConvId) {
        localStorage.setItem('dify_conversation_id', difyConvId);
        localStorage.setItem('dify_conversation_id_streaming', difyConvId);
        setConversationId(difyConvId);
        console.log('[Chat Debug] ✅ 强制恢复Dify对话ID:', difyConvId);
        
        // 🔍 额外调试：验证localStorage确实被设置
        const verifyStored = localStorage.getItem('dify_conversation_id');
        console.log('[Chat Debug] 🔍 验证localStorage写入:', {
          intended: difyConvId,
          actualStored: verifyStored,
          isMatch: verifyStored === difyConvId
        });
      } else {
        setConversationId(conversationWithMessages.id);
        console.log('[Chat Debug] ⚠️ 使用本地对话ID（无Dify ID）:', conversationWithMessages.id);
      }
      
      // 🔧 修复：正确恢复工作流状态，保持节点进度，并修复Date对象问题
      const restoredWorkflowState = conversationWithMessages.workflow_state;
      if (restoredWorkflowState && typeof restoredWorkflowState === 'object') {
        // 🚑 修复Date对象序列化问题：确保startTime和endTime是正确的Date对象
        const processedNodes = Array.isArray(restoredWorkflowState.nodes) 
          ? restoredWorkflowState.nodes.map((node: any) => ({
              ...node,
              startTime: node.startTime ? new Date(node.startTime) : undefined,
              endTime: node.endTime ? new Date(node.endTime) : undefined
            }))
          : [];
          
        const workflowState: WorkflowState = {
          isWorkflow: restoredWorkflowState.isWorkflow || false,
          nodes: processedNodes,
          completedNodes: typeof restoredWorkflowState.completedNodes === 'number' ? restoredWorkflowState.completedNodes : 0,
          totalNodes: typeof restoredWorkflowState.totalNodes === 'number' ? restoredWorkflowState.totalNodes : undefined,
          currentNodeId: restoredWorkflowState.currentNodeId || undefined
        };
        setWorkflowState(workflowState);
        console.log('[Chat Debug] ✅ 已恢复工作流状态:', workflowState);
      } else {
        setWorkflowState({
          isWorkflow: false,
          nodes: [],
          completedNodes: 0
        });
        console.log('[Chat Debug] 📝 初始化新工作流状态');
      }
      
      // 🚨 关键：防止后续的强制新对话逻辑清除我们刚恢复的状态
      console.log('[Chat Debug] 📋 已恢复历史对话，消息数:', convertedMessages.length);
      
      // 🧪 测试：如果是工作流对话，添加额外信息
      if (conversationWithMessages.workflow_state && conversationWithMessages.workflow_state.isWorkflow) {
        console.log('[Chat Debug] 🔄 这是一个工作流对话，工作流状态:', conversationWithMessages.workflow_state);
        console.log('[Chat Debug] 🔍 Dify对话ID:', difyConvId);
        console.log('[Chat Debug] ⚡ 发送消息时将尝试继续此工作流...');
      }
      setError(null);
      setIsLoading(false);

      // 更新当前对话ID和状态
      setChatHistory(prev => ({
        ...prev,
        currentConversationId: conversationId,
        syncStatus: 'idle'
      }));

      // Dify对话ID和工作流状态恢复已在cloudChatHistory.loadConversationFromHistory中处理

      console.log(`📖 已从云端加载对话: ${conversationWithMessages.title} (${convertedMessages.length} 条消息)`);
    } catch (error) {
      console.error('Failed to load conversation from cloud:', error);
      setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
    }
  };

  const createNewConversation = () => {
    // 先保存当前对话
    if (messages.length > 0) {
      saveConversationToHistory();
    }

    // 重置状态创建新对话
    setMessages([]);
    setConversationId(null);
    setInput('');
    setError(null);
    setRetryCount(0);
    setWorkflowState({
      isWorkflow: false,
      nodes: [],
      completedNodes: 0
    });

    // 🆕 清除localStorage中的对话数据（包括消息历史）
    ['dify_conversation_id', 'dify_conversation_id_streaming', 'dify_session_timestamp', 'dify_workflow_state', 'dify_messages'].forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    // 设置新的session时间戳
    localStorage.setItem('dify_session_timestamp', Date.now().toString());
    
    console.log('[Chat Debug] 🔥 新对话创建 - 清除所有对话状态，保持用户ID:', userId);
    
    // 更新历史状态
    setChatHistory(prev => ({
      ...prev,
      currentConversationId: null
    }));
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      // 从云端删除对话
      await cloudChatHistory.deleteConversation(conversationId);
      
      // 更新本地状态
      setChatHistory(prev => {
        const newConversations = prev.conversations.filter(c => c.id !== conversationId);
        return {
          ...prev,
          conversations: newConversations,
          currentConversationId: prev.currentConversationId === conversationId ? null : prev.currentConversationId,
          syncStatus: 'idle',
          lastSyncTime: new Date()
        };
      });

      // 如果删除的是当前对话，清空当前状态
      if (conversationId === chatHistory.currentConversationId) {
        createNewConversation();
      }

      console.log(`🗑️ 已从云端删除对话: ${conversationId}`);
    } catch (error) {
      console.error('Failed to delete conversation from cloud:', error);
      setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
    }
  };

  // 🆕 初始化云端对话历史
  useEffect(() => {
    const initializeCloudHistory = async () => {
      if (typeof window === 'undefined') return;

      try {
        // 检查是否需要迁移
        const migrationInfo = await chatHistoryMigration.getMigrationStatus();
        
        setMigrationStatus({
          needsMigration: migrationInfo.hasLocalData && !migrationInfo.hasMigrated,
          isChecking: false,
          isMigrating: false
        });

        // 如果已经迁移过或没有本地数据，直接加载云端数据
        if (!migrationInfo.hasLocalData || migrationInfo.hasMigrated) {
          await loadCloudConversations();
        }
        
        console.log('📊 聊天历史初始化状态:', migrationInfo);
      } catch (error) {
        console.error('Failed to initialize cloud chat history:', error);
        setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
        setMigrationStatus(prev => ({ ...prev, isChecking: false }));
      }
    };

    initializeCloudHistory();
  }, []);

  // 🔧 修复：添加页面刷新前和组件卸载时保存对话历史
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (messages.length > 0) {
        saveConversationToHistory();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 组件卸载时也保存历史
      if (messages.length > 0) {
        saveConversationToHistory();
      }
    };
  }, [messages.length]);

  // 🔧 修复：消息更新后自动保存历史（防抖处理）
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 🆕 立即保存到localStorage用于页面刷新恢复
    try {
      localStorage.setItem('dify_messages', JSON.stringify(messages));
      console.log('[Chat Debug] 💾 已保存消息到localStorage:', messages.length, '条');
    } catch (error) {
      console.warn('[Chat Debug] 保存消息到localStorage失败:', error);
    }
    
    const saveTimer = setTimeout(() => {
      saveConversationToHistory();
    }, 2000); // 2秒后保存，避免频繁保存

    return () => clearTimeout(saveTimer);
  }, [messages]);

  useEffect(() => {
    const initUserIdAndSession = () => {
      // 🔥 修复用户身份识别问题：优先使用认证用户的ID
      if (user?.id) {
        console.log('[Chat Debug] 🔑 使用认证用户ID:', user.id);
        setUserId(user.id);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('dify_user_id', user.id);
          localStorage.setItem('dify_session_timestamp', Date.now().toString());
        }
        
        setIsUserIdReady(true);
        return;
      }
      
      if (typeof window !== 'undefined') {
        // 检查是否有已存储的用户ID，如果有就使用（页面刷新场景）
        const storedUserId = localStorage.getItem('dify_user_id');
        const storedConversationId = localStorage.getItem('dify_conversation_id');
        
        if (storedUserId && !storedUserId.startsWith('anonymous-')) {
          // 页面刷新，保持原有的会话状态
          console.log('[Chat Debug] 🔄 页面刷新 - 保持原有用户ID和对话状态:', storedUserId);
          setUserId(storedUserId);
          
          if (storedConversationId) {
            setConversationId(storedConversationId);
            console.log('[Chat Debug] 🔄 恢复对话ID:', storedConversationId);
            
            // 🆕 关键修复：页面刷新时恢复消息历史
            try {
              const storedMessages = localStorage.getItem('dify_messages');
              const storedWorkflowState = localStorage.getItem('dify_workflow_state');
              
              if (storedMessages) {
                const parsedMessages = JSON.parse(storedMessages);
                if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                  console.log('[Chat Debug] 🔄 恢复消息历史:', parsedMessages.length, '条消息');
                  setMessages(parsedMessages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  })));
                }
              }
              
              if (storedWorkflowState) {
                const parsedWorkflowState = JSON.parse(storedWorkflowState);
                console.log('[Chat Debug] 🔄 恢复工作流状态:', parsedWorkflowState);
                // 🔧 修复：确保工作流状态的时间戳字段正确转换
                if (parsedWorkflowState.nodes) {
                  parsedWorkflowState.nodes = parsedWorkflowState.nodes.map((node: any) => ({
                    ...node,
                    startTime: node.startTime ? new Date(node.startTime) : undefined,
                    endTime: node.endTime ? new Date(node.endTime) : undefined
                  }));
                }
                setWorkflowState(parsedWorkflowState);
              }
            } catch (error) {
              console.warn('[Chat Debug] 恢复消息历史失败:', error);
            }
          }
          
          setIsUserIdReady(true);
          return;
        }
        
        // 🚨 仅在真正需要时才清理状态（没有有效用户ID的情况）
        console.log('[Chat Debug] ⚠️ 未认证用户 - 清理所有Dify状态');
        
        // 清理无效的会话数据
        ['dify_conversation_id', 'dify_conversation_id_streaming', 'dify_user_id', 'dify_session_timestamp', 'dify_workflow_state', 'dify_last_real_activity', 'dify_last_visit'].forEach(key => {
          if (localStorage.getItem(key)) {
            console.log(`[Chat Debug] 清除 ${key}:`, localStorage.getItem(key));
            localStorage.removeItem(key);
          }
          sessionStorage.removeItem(key);
        });
        
        // 生成匿名用户ID
        const anonymousUserId = 'anonymous-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
        setUserId(anonymousUserId);
        localStorage.setItem('dify_user_id', anonymousUserId);
        localStorage.setItem('dify_last_visit', Date.now().toString());
        localStorage.setItem('dify_session_timestamp', Date.now().toString());
        
        console.log('[Chat Debug] 🔥 匿名用户ID已生成:', anonymousUserId);
        
        setIsUserIdReady(true);
        return;
      }
      
      // 🔧 修复：为非浏览器环境也生成有效的UUID
      const newId = generateUUID();
      setUserId(newId);
      setIsUserIdReady(true);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('dify_user_id', newId);
      }
    };
    
    initUserIdAndSession();
  }, [user?.id]); // 🔥 关键：依赖用户ID变化
  

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🔧 新增：快捷键支持 Ctrl+N 或 Cmd+N 开始新对话
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+N (Windows/Linux) 或 Cmd+N (Mac) 开始新对话
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        handleNewConversation();
        console.log('[Chat Debug] New conversation started via keyboard shortcut');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, []);

  // 添加欢迎消息 - 等待 userId 准备完成
  useEffect(() => {
    // 🔧 修复：检查localStorage是否有恢复的消息，避免覆盖
    const storedMessages = localStorage.getItem('dify_messages');
    const hasStoredMessages = storedMessages && JSON.parse(storedMessages).length > 0;
    
    if (messages.length === 0 && welcomeMessage && isUserIdReady && !hasStoredMessages) {
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [welcomeMessage, isUserIdReady]);

  // 重置工作流状态
  const resetWorkflowState = () => {
    setWorkflowState({
      isWorkflow: false,
      nodes: [],
      completedNodes: 0,
      totalNodes: 0
    });
  };

  // 工作流进度更新处理 - 优化性能
  const updateWorkflowProgress = (nodeUpdate: Partial<WorkflowProgress> & { nodeId: string }) => {
    // 减少console.log以提高性能
    if (process.env.NODE_ENV === 'development') {
      console.log('[Workflow] Node update:', nodeUpdate.nodeId, nodeUpdate.status);
    }
    
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
          nodeType: nodeUpdate.nodeType,
          status: nodeUpdate.status || 'waiting',
          startTime: nodeUpdate.startTime,
          endTime: nodeUpdate.endTime,
          error: nodeUpdate.error
        });
      }

      // 计算完成的节点数
      const completedNodes = newNodes.filter(n => n.status === 'completed').length;
      
      const newState = {
        ...prev,
        isWorkflow: true, // 自动启用工作流状态当检测到节点事件时
        nodes: newNodes,
        currentNodeId: nodeUpdate.status === 'running' ? nodeUpdate.nodeId : prev.currentNodeId,
        completedNodes,
        totalNodes: Math.max(prev.totalNodes || 0, newNodes.length) // 动态更新总节点数
      };
      
      // 🆕 保存工作流状态到localStorage用于页面刷新时恢复
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('dify_workflow_state', JSON.stringify(newState));
          console.log('[Workflow] 💾 State saved to localStorage');
        } catch (error) {
          console.warn('[Workflow] Failed to save state to localStorage:', error);
        }
      }
      
      console.log('[Chat Debug] New workflow state:', newState);
      return newState;
    });
  };

  // 发送消息（支持重试）
  const sendMessageWithRetry = async (messageContent: string, currentRetry = 0): Promise<void> => {
    const maxRetries = enableRetry ? 3 : 0;
    
    // 🔧 修复：只在真正开始新对话时重置工作流状态，不要破坏历史对话恢复的状态
    const hasExistingWorkflow = workflowState.isWorkflow && workflowState.nodes.length > 0;
    const isHistoryConversation = messages.length > 0 && conversationId;
    
    if (currentRetry === 0 && !hasExistingWorkflow && !isHistoryConversation) {
      console.log('[Chat Debug] 🔄 重置工作流状态（新对话）');
      resetWorkflowState();
    } else if (hasExistingWorkflow) {
      console.log('[Chat Debug] 🔄 保持现有工作流状态（继续对话）', {
        nodes: workflowState.nodes.length,
        completedNodes: workflowState.completedNodes,
        currentNode: workflowState.currentNodeId
      });
    }
    
    try {
      
      // Check if we have a valid conversation ID for targeted API calls
      // Always use generic endpoint - let backend handle conversation ID consistency
      const endpoint = '/api/dify';
      
      // Fix 3: Enhanced Error Handling and Debugging - Add comprehensive logging
      const storedConversationId = localStorage.getItem('dify_conversation_id');
      const storedWorkflowState = localStorage.getItem('dify_workflow_state');
      const hasExistingConversation = storedConversationId || conversationId;
      
      console.log('[Chat Debug] 📤 准备发送消息:', {
        endpoint,
        messageContent: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
        userId,
        conversationId_param: conversationId,
        storedConversationId_localStorage: storedConversationId,
        finalConversationId_will_send: localStorage.getItem('dify_conversation_id') || conversationId || undefined,
        hasExistingConversation: !!hasExistingConversation,
        hasStoredWorkflow: !!storedWorkflowState,
        storedWorkflowState: storedWorkflowState ? JSON.parse(storedWorkflowState) : null,
        willProvideInputs: !!hasExistingConversation, // 🚨 新增：是否会提供inputs
        showWorkflowProgress,
        timestamp: new Date().toISOString()
      });

      // 🔧 修复：不要强制启用工作流状态，让Dify API自然响应
      // 只有当检测到实际工作流事件时才设置isWorkflow=true
      console.log('[Chat Debug] 💡 准备发送消息，等待Dify响应以确定是否为工作流');

      // 🆕 智能预测：如果这是一个复杂的请求，预先准备工作流UI
      const isComplexRequest = messageContent.length > 100 || 
                              messageContent.includes('分析') || 
                              messageContent.includes('生成') || 
                              messageContent.includes('创建') ||
                              messageContent.includes('explain') ||
                              messageContent.includes('analyze') ||
                              messageContent.includes('generate');
                              
      if (isComplexRequest) {
        console.log('[Workflow] 🔮 检测到复杂请求，预先准备工作流UI');
        // 预先显示一个通用的处理节点
        setTimeout(() => {
          updateWorkflowProgress({
            nodeId: 'preparing',
            nodeName: '准备处理您的请求...',
            nodeTitle: '初始化',
            nodeType: 'start',
            status: 'running',
            startTime: new Date()
          });
          setWorkflowState(prev => ({
            ...prev,
            isWorkflow: true
          }));
        }, 500); // 延迟500ms显示，避免简单请求的误判
      }

      // 🔧 修复：智能超时机制 - 根据实际工作流状态调整超时时间
      const hasActiveWorkflow = workflowState.isWorkflow && workflowState.nodes.length > 0;
      const timeoutMs = hasActiveWorkflow ? 3 * 60 * 1000 : 60 * 1000; // 3分钟工作流，1分钟普通聊天

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
          // 🔥 修复：使用官方API规范的标准字段
          query: messageContent,        // ✅ 官方API必需字段
          user: userId || 'anonymous-user', // ✅ 官方API必需字段，用户标识
          // 🔧 关键修复：优先使用localStorage中的dify_conversation_id以确保对话连续性
          conversation_id: localStorage.getItem('dify_conversation_id') || conversationId || undefined,
          response_mode: 'streaming', // ✅ 官方API字段：streaming/blocking
          stream: true, // 🔧 关键修复：启用流式响应
          auto_generate_name: true,   // ✅ 官方API字段：自动生成会话标题
          // 🔥 修复：根据官方API文档，inputs用于传递应用定义的变量值
          // 通常应该为空对象，让Dify根据workflow配置和对话上下文处理
          inputs: {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      // 🔍 调试：记录响应信息
      console.log('[Chat Debug] 📥 收到响应:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        },
        timestamp: new Date().toISOString()
      });

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
      // 🔥 现在总是使用流式处理，因为我们总是发送streaming请求
      if (response.body) {
        try {
          await handleWorkflowStream(response, messageContent);
        } catch (streamError) {
          console.warn('[Chat Debug] Stream processing failed, falling back to regular response:', streamError);
          // 🔧 修复：保持会话连续性的回退机制
          try {
            // 获取或恢复会话ID
            const fallbackConversationId = conversationId || 
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
                // 🔥 修复：使用官方API规范的标准字段
                query: messageContent,        // ✅ 官方API必需字段
                user: userId || 'anonymous-user', // ✅ 官方API必需字段，用户标识
                // 传递会话ID保持连续性
                conversation_id: fallbackConversationId,
                response_mode: 'blocking', // ✅ 官方API字段：blocking模式fallback
                auto_generate_name: true,  // ✅ 官方API字段：自动生成会话标题
                inputs: {}                 // ✅ 官方API字段：应用变量
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
              
              // Store the conversation ID for future requests
              if (typeof window !== 'undefined') {
                localStorage.setItem('dify_conversation_id', data.conversation_id);
                localStorage.setItem('dify_session_timestamp', Date.now().toString());
                console.log('[Chat Debug] Stored fallback conversation ID:', data.conversation_id);
              }
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
        
        // 🔍 调试：记录接收到的响应数据
        console.log('[Chat Debug] 📋 收到响应数据:', {
          hasAnswer: !!data.answer,
          answerLength: data.answer?.length || 0,
          conversationId_returned: data.conversation_id,
          conversationId_current_state: conversationId,
          conversationId_localStorage: localStorage.getItem('dify_conversation_id'),
          messageId: data.message_id,
          hasMetadata: !!data.metadata,
          hasUsage: !!data.metadata?.usage,
          responseMode: data.mode || 'unknown',
          timestamp: new Date().toISOString()
        });
        
        await handleRegularResponse(data, messageContent);
      }

      // 重置重试计数
      setRetryCount(0);
      
    } catch (error) {
      // Fix 3: Enhanced Error Handling - Better error logging and user messages
      console.error('[Chat] Error sending message:', error);
      
      // 处理取消请求
      if (error instanceof Error && error.name === 'AbortError') {
        const nodeCount = Object.keys(workflowState.nodes).length;
        const timeoutError = hasActiveWorkflow 
          ? `工作流执行超时（3分钟）。当前工作流包含${nodeCount || 5}个节点，复杂工作流可能需要更多时间。请尝试简化请求或稍后重试。`
          : '请求超时（1分钟），请稍后重试';
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
    const STALL_TIMEOUT_MS = 90 * 1000; // 90秒无数据则认为停滞 (增加到90秒适应复杂工作流)
    
    let iterationCount = 0;
    let lastProgressTime = Date.now();
    let hasReceivedData = false;
    let processedDataCount = 0; // 跟踪处理的数据块数量
    let messageEndReceived = false; // 标记是否收到message_end事件
    let tokenUsageProcessed = false; // 标记是否已处理token计费

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
          console.warn('[Chat Debug] Stream stalled for 90 seconds, breaking loop');
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
          
          // 🔧 修复：检测响应格式 - SSE还是普通JSON
          const processedLines: string[] = [];
          
          // 如果chunk看起来是完整的JSON而不是SSE格式
          if (chunk.trim().startsWith('{') && !chunk.includes('data:')) {
            console.log('[Chat Debug] Detected JSON response format, processing as single block');
            try {
              const parsed = JSON.parse(chunk.trim());
              // 直接处理JSON响应
              if (parsed.answer) {
                finalResponse += parsed.answer;
                console.log('[Chat Debug] Added JSON answer to final response:', parsed.answer.substring(0, 100) + '...');
                
                // 标记为已收到内容
                hasReceivedData = true;
              }

              // 🔧 修复：处理JSON响应中的usage信息（积分扣除的关键修复）
              if (parsed.metadata?.usage && !tokenUsageProcessed) {
                console.log('[Token] ✅ Processing JSON response token usage:', parsed.metadata.usage);
                tokenUsageProcessed = true; // 标记已处理，避免重复计费
                
                try {
                  // 异步处理token使用，不阻塞UI
                  processTokenUsage(
                    parsed.metadata.usage,
                    parsed.conversation_id,
                    parsed.message_id || `json_response_${Date.now()}`,
                    extractModelFromResponse(parsed, 'json_blocking') || 'dify-blocking'
                  ).then(result => {
                    if (result.success) {
                      console.log('[Token] ✅ Successfully processed JSON response token usage:', result.newBalance);
                    } else {
                      console.warn('[Token] ❌ Failed to process JSON response token usage:', result.error);
                    }
                  }).catch(error => {
                    console.error('[Token] ❌ Error processing JSON response token usage:', error);
                  });
                } catch (tokenError) {
                  console.error('[Token] ❌ Error preparing JSON response token usage:', tokenError);
                }
              }
              
              // 🎯 处理工作流开始事件 - 预先显示所有节点
              if (parsed.event === 'workflow_started' && parsed.data?.nodes) {
                console.log('[Workflow] 🚀 工作流已开始，预加载所有节点:', parsed.data.nodes);
                
                // 预先添加所有节点到UI中
                parsed.data.nodes.forEach((nodeInfo: any, index: number) => {
                  updateWorkflowProgress({
                    nodeId: nodeInfo.node_id || `node_${index}`,
                    nodeName: nodeInfo.title || nodeInfo.node_name || `节点 ${index + 1}`,
                    nodeTitle: nodeInfo.title || nodeInfo.node_name,
                    nodeType: nodeInfo.node_type || 'unknown',
                    status: 'waiting',
                    startTime: undefined
                  });
                });

                // 设置工作流状态并清理预备节点
                setWorkflowState(prev => ({
                  ...prev,
                  isWorkflow: true,
                  totalNodes: parsed.data.nodes.length,
                  nodes: prev.nodes.filter(node => node.nodeId !== 'preparing') // 清理预备节点
                }));
              }

              // 处理工作流事件 - 修复事件数据结构
              if (parsed.event === 'node_started' && parsed.data?.node_id) {
                console.log('[Chat Debug] Workflow node started:', parsed.data.node_id, parsed.data.title);
                
                // 🔍 尝试从node_started事件中提取模型信息
                console.log('[Model Extraction] Node started - 详细数据分析:', {
                  node_id: parsed.data.node_id,
                  node_type: parsed.data.node_type,
                  node_title: parsed.data.title,
                  node_data_keys: Object.keys(parsed.data || {}),
                  full_node_data: parsed.data,
                  possible_model_fields: {
                    'data.model': parsed.data.model,
                    'data.llm_model': parsed.data.llm_model,
                    'data.model_name': parsed.data.model_name,
                    'data.provider': parsed.data.provider,
                    'data.model_config': parsed.data.model_config,
                    'data.model_provider': parsed.data.model_provider,
                    'data.inputs': parsed.data.inputs,
                    'data.outputs': parsed.data.outputs,
                    'data.metadata': parsed.data.metadata
                  }
                });
                
                updateWorkflowProgress({
                  nodeId: parsed.data.node_id,
                  nodeName: parsed.data.title || parsed.data.node_id,
                  nodeTitle: parsed.data.title,
                  nodeType: parsed.data.node_type,
                  status: 'running',
                  startTime: new Date()
                });
                
                // 🆕 如果这是第一个节点且还没有设置工作流状态，自动设置并清理预备节点
                setWorkflowState(prev => {
                  if (!prev.isWorkflow) {
                    console.log('[Workflow] 🔄 自动启用工作流模式（检测到节点开始）');
                    return {
                      ...prev,
                      isWorkflow: true,
                      nodes: prev.nodes.filter(node => node.nodeId !== 'preparing') // 清理预备节点
                    };
                  } else {
                    // 如果已经是工作流模式，也清理预备节点
                    return {
                      ...prev,
                      nodes: prev.nodes.filter(node => node.nodeId !== 'preparing')
                    };
                  }
                });
              }
              
              if (parsed.event === 'node_finished' && parsed.data?.node_id) {
                console.log('[Chat Debug] Workflow node finished:', parsed.data.node_id, parsed.data.status);
                
                // 🔍 从node_finished事件中提取模型信息（最有可能包含usage数据）
                console.log('[Model Extraction] Node finished - 寻找模型和usage信息:', {
                  node_id: parsed.data.node_id,
                  node_type: parsed.data.node_type,
                  node_status: parsed.data.status,
                  node_data_keys: Object.keys(parsed.data || {}),
                  full_node_data: parsed.data,
                  usage_info: parsed.data.usage || parsed.data.metadata?.usage,
                  model_extraction_attempts: {
                    'data.model': parsed.data.model,
                    'data.llm_model': parsed.data.llm_model,
                    'data.model_name': parsed.data.model_name,
                    'data.provider': parsed.data.provider,
                    'data.model_config': parsed.data.model_config,
                    'data.usage.model': parsed.data.usage?.model,
                    'data.metadata.usage.model': parsed.data.metadata?.usage?.model,
                    'data.execution_metadata': parsed.data.execution_metadata,
                    'data.outputs': parsed.data.outputs
                  }
                });
                
                updateWorkflowProgress({
                  nodeId: parsed.data.node_id,
                  nodeName: parsed.data.title || parsed.data.node_id,
                  nodeTitle: parsed.data.title,
                  nodeType: parsed.data.node_type,
                  status: parsed.data.status === 'succeeded' ? 'completed' : 'failed',
                  endTime: new Date()
                });
              } else if (parsed.event === 'node_failed' && parsed.data?.node_id) {
                console.log('[Chat Debug] Node failed:', parsed.data.node_id, parsed.data.error);
                updateWorkflowProgress({
                  nodeId: parsed.data.node_id,
                  status: 'failed',
                  endTime: new Date(),
                  error: parsed.data.error || '节点执行失败'
                });
              }
              
              // 继续处理下一个chunk
              continue;
            } catch (jsonError) {
              console.warn('[Chat Debug] Failed to parse as JSON, falling back to SSE processing:', jsonError);
            }
          }
          
          // 传统SSE格式处理
          let lineEndIndex;
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
                  
                  // 保存会话ID到localStorage
                  if (detectedConversationId) {
                    localStorage.setItem('dify_conversation_id', detectedConversationId);
                    console.log('[Chat Debug] Saved conversation ID to localStorage:', detectedConversationId);
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
                    
                    // Store conversation ID for continuity
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('dify_conversation_id', parsed.conversation_id);
                      console.log('[Chat Debug] Stored streaming conversation ID:', parsed.conversation_id);
                    }
                  }

                  // 🎯 处理工作流开始事件 - 预先显示所有节点 (SSE path)
                  if (parsed.event === 'workflow_started' && parsed.data?.nodes) {
                    console.log('[Workflow] 🚀 工作流已开始，预加载所有节点 (SSE path):', parsed.data.nodes);
                    
                    // 预先添加所有节点到UI中
                    parsed.data.nodes.forEach((nodeInfo: any, index: number) => {
                      updateWorkflowProgress({
                        nodeId: nodeInfo.node_id || `node_${index}`,
                        nodeName: nodeInfo.title || nodeInfo.node_name || `节点 ${index + 1}`,
                        nodeTitle: nodeInfo.title || nodeInfo.node_name,
                        nodeType: nodeInfo.node_type || 'unknown',
                        status: 'waiting',
                        startTime: undefined
                      });
                    });

                    // 设置工作流状态并清理预备节点
                    setWorkflowState(prev => ({
                      ...prev,
                      isWorkflow: true,
                      totalNodes: parsed.data.nodes.length,
                      nodes: prev.nodes.filter(node => node.nodeId !== 'preparing') // 清理预备节点
                    }));
                  }

                  // 处理工作流节点事件 - 在第二个处理路径中也需要
                  if (parsed.event === 'node_started' && parsed.data?.node_id) {
                    console.log('[Chat Debug] Workflow node started (path 2):', parsed.data.node_id, parsed.data.title);
                    updateWorkflowProgress({
                      nodeId: parsed.data.node_id,
                      nodeName: parsed.data.title || parsed.data.node_id,
                      nodeTitle: parsed.data.title,
                      nodeType: parsed.data.node_type,
                      status: 'running',
                      startTime: new Date()
                    });
                    
                    // 🆕 如果这是第一个节点且还没有设置工作流状态，自动设置并清理预备节点 (SSE path)
                    setWorkflowState(prev => {
                      if (!prev.isWorkflow) {
                        console.log('[Workflow] 🔄 自动启用工作流模式（检测到节点开始）(SSE path)');
                        return {
                          ...prev,
                          isWorkflow: true,
                          nodes: prev.nodes.filter(node => node.nodeId !== 'preparing') // 清理预备节点
                        };
                      } else {
                        // 如果已经是工作流模式，也清理预备节点
                        return {
                          ...prev,
                          nodes: prev.nodes.filter(node => node.nodeId !== 'preparing')
                        };
                      }
                    });
                  } else if (parsed.event === 'node_finished' && parsed.data?.node_id) {
                    console.log('[Chat Debug] Workflow node finished (path 2):', parsed.data.node_id, parsed.data.status);
                    updateWorkflowProgress({
                      nodeId: parsed.data.node_id,
                      nodeName: parsed.data.title || parsed.data.node_id,
                      nodeTitle: parsed.data.title,
                      nodeType: parsed.data.node_type,
                      status: parsed.data.status === 'succeeded' ? 'completed' : 'failed',
                      endTime: new Date()
                    });
                  } else if (parsed.event === 'node_failed' && parsed.data?.node_id) {
                    console.log('[Chat Debug] Node failed (path 2):', parsed.data.node_id, parsed.data.error);
                    updateWorkflowProgress({
                      nodeId: parsed.data.node_id,
                      status: 'failed',
                      endTime: new Date(),
                      error: parsed.data.error || '节点执行失败'
                    });
                  }

                  // 🎯 最高优先级：处理结合响应头和响应体的增强token使用信息
                  if (parsed.event === 'enhanced_token_usage') {
                    console.log('[Chat Debug] 🚨 收到增强的token使用信息 (响应头+响应体):', parsed.data);
                    
                    if (parsed.data.usage && !tokenUsageProcessed) {
                      console.log('[Token] ✅ Processing enhanced token usage (headers + body combined):', parsed.data.usage);
                      tokenUsageProcessed = true; // 标记已处理，避免重复计费
                      
                      try {
                        // 使用结合响应头准确token数量和响应体价格信息的数据进行计费
                        processTokenUsage(
                          parsed.data.usage,
                          parsed.conversation_id,
                          parsed.message_id || `enhanced_${Date.now()}`,
                          parsed.data.usage.model || extractModelFromResponse(parsed, 'enhanced_combined') || 'dify-chatflow'
                        ).then(result => {
                          if (result.success) {
                            console.log('[Token] ✅ Successfully processed enhanced token usage:', result.newBalance);
                          } else {
                            console.warn('[Token] ❌ Failed to process enhanced token usage:', result.error);
                          }
                        }).catch(error => {
                          console.error('[Token] ❌ Error processing enhanced token usage:', error);
                        });
                      } catch (tokenError) {
                        console.error('[Token] ❌ Error preparing enhanced token usage:', tokenError);
                      }
                    } else {
                      console.log('[Token] ℹ️ Enhanced token usage already processed or no usage data available');
                    }
                  }
                  // 🎯 备用方案：从服务器响应头提取的token使用信息（仅token统计）
                  else if (parsed.event === 'token_usage_extracted') {
                    console.log('[Chat Debug] 🚨 收到从服务器响应头提取的token使用信息:', parsed.data);
                    
                    if (parsed.data.usage && !tokenUsageProcessed) {
                      console.log('[Token] ✅ Processing server-extracted token usage (from Dify response headers):', parsed.data.usage);
                      tokenUsageProcessed = true; // 标记已处理，避免重复计费
                      
                      try {
                        // 使用从响应头提取的真实token数据进行计费
                        processTokenUsage(
                          parsed.data.usage,
                          parsed.conversation_id,
                          parsed.message_id || `server_extracted_${Date.now()}`,
                          extractModelFromResponse(parsed, 'server_headers') || 'dify-chatflow'
                        ).then(result => {
                          if (result.success) {
                            console.log('[Token] ✅ Successfully processed server-extracted token usage:', result.newBalance);
                          } else {
                            console.warn('[Token] ❌ Failed to process server-extracted token usage:', result.error);
                          }
                        }).catch(error => {
                          console.error('[Token] ❌ Error processing server-extracted token usage:', error);
                        });
                      } catch (tokenError) {
                        console.error('[Token] ❌ Error preparing server-extracted token usage:', tokenError);
                      }
                    } else {
                      console.log('[Token] ℹ️ Server-extracted token usage already processed or no usage data available');
                    }
                  }
                  // 🔧 修复：正确解析和累积消息内容 - 处理DIFY流格式
                  else if (parsed.event === 'message' && parsed.answer) {
                    console.log('[Chat Debug] Accumulating message answer:', parsed.answer.length, 'chars');
                    finalResponse += parsed.answer;
                  } else if (parsed.event === 'message_end') {
                    // message_end事件表示消息完成，检查是否有完整答案
                    if (parsed.answer) {
                      console.log('[Chat Debug] Accumulating message_end answer:', parsed.answer.length, 'chars');
                      finalResponse = parsed.answer; // 使用完整答案替换累积内容
                    }
                    // 标记消息结束
                    messageEndReceived = true;
                    console.log('[Chat Debug] Message end received, total content length:', finalResponse.length);
                    
                    // 💰 处理message_end事件中的token使用和积分扣减
                    if (parsed.metadata && parsed.metadata.usage && !tokenUsageProcessed) {
                      console.log('[Token] ✅ Processing message_end token usage (with real Dify pricing):', parsed.metadata.usage);
                      
                      // 🔍 详细调试：检查Dify usage数据的完整结构
                      console.log('[DEBUG MESSAGE_END] 🚨 完整的message_end事件数据结构分析:', {
                        event_type: parsed.event,
                        has_metadata: !!parsed.metadata,
                        has_usage: !!parsed.metadata?.usage,
                        usage_keys: Object.keys(parsed.metadata?.usage || {}),
                        usage_complete_object: JSON.stringify(parsed.metadata?.usage, null, 2),
                        
                        // 检查价格字段的所有可能命名方式
                        price_fields_check: {
                          'usage.prompt_price': parsed.metadata?.usage?.prompt_price,
                          'usage.completion_price': parsed.metadata?.usage?.completion_price,
                          'usage.total_price': parsed.metadata?.usage?.total_price,
                          'usage.price': parsed.metadata?.usage?.price,
                          'usage.cost': parsed.metadata?.usage?.cost,
                          'usage.prompt_cost': parsed.metadata?.usage?.prompt_cost,
                          'usage.completion_cost': parsed.metadata?.usage?.completion_cost,
                          'usage.total_cost': parsed.metadata?.usage?.total_cost,
                          'usage.input_price': parsed.metadata?.usage?.input_price,
                          'usage.output_price': parsed.metadata?.usage?.output_price,
                          'usage.pricing': parsed.metadata?.usage?.pricing,
                          'usage.price_breakdown': parsed.metadata?.usage?.price_breakdown
                        },
                        
                        // 检查其他可能的位置
                        other_locations: {
                          'metadata.price': parsed.metadata?.price,
                          'metadata.cost': parsed.metadata?.cost,
                          'metadata.pricing': parsed.metadata?.pricing,
                          'parsed.price': parsed.price,
                          'parsed.cost': parsed.cost,
                          'parsed.pricing': parsed.pricing,
                          'parsed.data.price': parsed.data?.price,
                          'parsed.data.cost': parsed.data?.cost,
                          'parsed.data.usage': parsed.data?.usage
                        },
                        
                        // 检查currency字段
                        currency_info: {
                          'usage.currency': parsed.metadata?.usage?.currency,
                          'metadata.currency': parsed.metadata?.currency,
                          'parsed.currency': parsed.currency
                        },
                        
                        // 完整的事件数据（为了发现新字段）
                        full_parsed_keys: Object.keys(parsed),
                        full_metadata_keys: Object.keys(parsed.metadata || {}),
                        timestamp: new Date().toISOString()
                      });
                      
                      tokenUsageProcessed = true; // 标记已处理，避免重复计费
                      
                      // 🔍 详细记录所有可能包含模型信息的字段
                      console.log('[Model Extraction] 完整metadata分析:', {
                        full_parsed_data: parsed,
                        metadata_keys: Object.keys(parsed.metadata || {}),
                        usage_keys: Object.keys(parsed.metadata.usage || {}),
                        metadata_complete: parsed.metadata,
                        possible_model_fields: {
                          'metadata.usage.model': parsed.metadata.usage?.model,
                          'metadata.model': parsed.metadata.model,
                          'metadata.llm_model': parsed.metadata.llm_model,
                          'metadata.retriever_resource': parsed.metadata.retriever_resource,
                          'parsed.model': parsed.model,
                          'parsed.data': parsed.data,
                          'parsed.task_id': parsed.task_id,
                          'parsed.workflow_run_id': parsed.workflow_run_id
                        }
                      });
                      try {
                        // 异步处理token使用，不阻塞UI
                        processTokenUsage(
                          parsed.metadata.usage,
                          parsed.conversation_id,
                          parsed.id || parsed.message_id,
                          // 🔍 使用专用提取函数获取模型名称
                          extractModelFromResponse(parsed, 'message_end') || 'dify-chatflow'
                        ).then(result => {
                          if (result.success) {
                            console.log('[Token] Successfully processed message_end token usage:', result.newBalance);
                          } else {
                            console.warn('[Token] Failed to process message_end token usage:', result.error);
                          }
                        }).catch(error => {
                          console.error('[Token] Error processing message_end token usage:', error);
                        });
                      } catch (tokenError) {
                        console.error('[Token] Error preparing message_end token usage:', tokenError);
                      }
                    } else {
                      // 🔍 调试：记录为什么message_end事件没有被处理
                      console.log('[DEBUG MESSAGE_END] ❌ message_end事件未处理原因分析:', {
                        event_type: parsed.event,
                        has_parsed: !!parsed,
                        has_metadata: !!parsed.metadata,
                        has_usage: !!parsed.metadata?.usage,
                        token_usage_already_processed: tokenUsageProcessed,
                        metadata_structure: parsed.metadata ? Object.keys(parsed.metadata) : 'no metadata',
                        full_event_data: JSON.stringify(parsed, null, 2)
                      });
                    }
                  } else if (parsed.event === 'workflow_finished') {
                    // 🎯 关键修复：处理ChatFlow的workflow_finished事件
                    if (parsed.data && parsed.data.outputs && parsed.data.outputs.answer) {
                      console.log('[Chat Debug] Workflow finished with answer:', parsed.data.outputs.answer.length, 'chars');
                      finalResponse = parsed.data.outputs.answer; // ChatFlow的答案在data.outputs.answer中
                      messageEndReceived = true; // 标记消息完成
                      
                      // 🚨 重要修复：workflow_finished不应该立即处理token计费
                      // 应该等待message_end事件，它包含真实的价格信息
                      console.log('[Token] ℹ️ Workflow finished - waiting for message_end with real pricing data');
                      console.log('[Token] 🚫 Delaying token processing to wait for enhanced usage data from server');
                    }
                  } else if (parsed.answer && !parsed.event) {
                    // 兼容性处理：如果没有event字段但有answer字段
                    console.log('[Chat Debug] Accumulating direct answer:', parsed.answer.length, 'chars');  
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
        
        // 🚨 关键修复：检查是否应该退出循环
        if (messageEndReceived && finalResponse.trim()) {
          console.log('[Chat Debug] ✅ Workflow completed successfully, breaking loop');
          console.log('[Chat Debug] Final response length:', finalResponse.length);
          break;
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
        
        // 保存会话ID到localStorage
        if (detectedConversationId) {
          localStorage.setItem('dify_conversation_id', detectedConversationId);
          console.log('[Chat Debug] Saved conversation ID to localStorage:', detectedConversationId);
        }
      } else {
        // 检查是否至少收到了message_end事件
        if (messageEndReceived) {
          console.log('[Chat Debug] Message end received but no content accumulated, this might be a workflow response');
          // 对于工作流，即使没有最终文本回答也可能是正常的
          const assistantMessage: Message = {
            id: `assistant_${Date.now()}`,
            content: '工作流执行完成',
            role: 'assistant',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          console.warn('[Chat Debug] Stream ended without content and no message_end event, triggering fallback');
          throw new Error('流式响应处理完成但未获取到内容');
        }
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
      console.log('[Chat Debug] Updated conversation ID from', conversationId, 'to', data.conversation_id);
      setConversationId(data.conversation_id);
      
      // 🔧 CRITICAL FIX: Store the Dify conversation ID for future requests
      if (typeof window !== 'undefined') {
        localStorage.setItem('dify_conversation_id', data.conversation_id);
        console.log('[Chat Debug] Stored conversation ID in localStorage:', data.conversation_id);
      }
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
    
    // 💰 处理blocking API的token使用
    console.log('[Token Debug] Checking for usage data in blocking API response:', {
      hasMetadata: !!data.metadata,
      hasUsage: !!data.metadata?.usage,
      metadataKeys: data.metadata ? Object.keys(data.metadata) : [],
      usageKeys: data.metadata?.usage ? Object.keys(data.metadata.usage) : [],
      fullUsageData: data.metadata?.usage,
      responseKeys: Object.keys(data)
    });

    if (data.metadata?.usage) {
      console.log('[Token] ✅ Processing blocking API token usage:', data.metadata.usage);
      try {
        // 异步处理token使用，不阻塞UI
        processTokenUsage(
          data.metadata.usage,
          data.conversation_id as string,
          data.message_id as string,
          // 🔍 使用专用提取函数获取模型名称
          extractModelFromResponse(data, 'blocking_api') || 'dify-blocking'
        ).then(result => {
          if (result.success) {
            console.log('[Token] ✅ Successfully processed blocking API token usage:', result.newBalance);
          } else {
            console.warn('[Token] ❌ Failed to process blocking API token usage:', result.error);
          }
        }).catch(error => {
          console.error('[Token] ❌ Error processing blocking API token usage:', error);
        });
      } catch (tokenError) {
        console.error('[Token] ❌ Error preparing blocking API token usage:', tokenError);
      }
    } else {
      console.warn('[Token] ⚠️ No usage data found in blocking API response - credits will not be deducted!');
    }
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
    
    // 🔥 记录真实的用户活动时间戳（不是"你好"这种测试消息）
    if (input.length > 2 && !['你好', 'hello', 'hi', 'test'].includes(input.toLowerCase().trim())) {
      localStorage.setItem('dify_last_real_activity', Date.now().toString());
      console.log('[Chat Debug] 记录真实用户活动:', input.substring(0, 20));
    }

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
      
      // 🔧 修复：移除自动保存，避免创建重复对话记录
      // 对话历史由用户主动操作时保存（如点击新对话按钮）
      
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
  
  // 🔧 增强的新对话功能 - 集成对话历史管理
  const handleNewConversation = () => {
    console.log('[Chat Debug] Starting new conversation with history management');
    
    // 使用新的对话历史管理函数
    createNewConversation();
    
    // 添加欢迎消息
    if (welcomeMessage) {
      setMessages([{
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
    
    // 🔥 修复：保持认证用户的ID，不要重新生成
    if (typeof window !== 'undefined') {
      // 只更新session时间戳，保持现有的用户ID
      localStorage.setItem('dify_session_timestamp', Date.now().toString());
      
      console.log('[Chat Debug] ✅ 保持认证用户ID for fresh conversation:', userId);
    }
    
    // 🔧 提供用户反馈
    if (typeof window !== 'undefined') {
      const notification = document.createElement('div');
      notification.textContent = '✅ 新对话已开始';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: opacity 0.3s ease;
      `;
      
      document.body.appendChild(notification);
      
      // 3秒后自动移除通知
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
    }
    
    console.log('[Chat Debug] New conversation initialized with history support');
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
          <h3 className="text-lg font-semibold text-gray-800">ProMe</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
            title="Chat History (Cloud Sync)"
          >
            <div className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {chatHistory.syncStatus === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
              {chatHistory.syncStatus === 'error' && <WifiOff className="w-3 h-3 text-red-500" />}
              {chatHistory.syncStatus === 'idle' && <Cloud className="w-3 h-3 text-green-500" />}
            </div>
            History ({chatHistory.conversations.length})
          </button>
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm hover:shadow-md"
            title="Start New Conversation (Ctrl+N or Cmd+N)"
          >
            <RotateCcw className="w-4 h-4" />
            New Chat
          </button>
        </div>
      </div>

      {/* 🆕 历史对话面板 */}
      {showHistory && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-64 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">对话历史</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 hover:bg-gray-200 rounded"
                title="关闭历史"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 🆕 数据迁移提示 */}
            {migrationStatus.needsMigration && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">发现本地聊天历史</span>
                  </div>
                  <button
                    onClick={performMigration}
                    disabled={migrationStatus.isMigrating}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {migrationStatus.isMigrating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        迁移中...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3 h-3" />
                        迁移到云端
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  将本地聊天历史上传到云端，实现跨设备同步
                </p>
              </div>
            )}

            {/* 🆕 同步状态指示器 */}
            {chatHistory.lastSyncTime && (
              <div className="mb-3 text-xs text-gray-500 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                最后同步: {chatHistory.lastSyncTime.toLocaleString()}
              </div>
            )}
            
            {chatHistory.conversations.length === 0 ? (
              <div className="text-center py-8">
                <Cloud className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">暂无云端对话历史</p>
                <p className="text-xs text-gray-400 mt-1">新的对话会自动同步到云端</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatHistory.conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
                      conversation.id === chatHistory.currentConversationId
                        ? "bg-blue-100 border border-blue-200"
                        : "bg-white hover:bg-gray-100 border border-gray-200"
                    )}
                    onClick={async () => await loadConversationFromHistory(conversation.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {conversation.title}
                        </h4>
                        {conversation.id === chatHistory.currentConversationId && (
                          <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                            当前
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.lastMessage}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{conversation.messageCount} 条消息</span>
                        <span>{conversation.lastMessageTime.toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteConversation(conversation.id);
                      }}
                      className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      title="删除对话"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                  <div className="text-xs text-gray-500 mb-2 flex justify-between items-center">
                    <span>工作流执行进度</span>
                    <span className="font-medium">
                      {workflowState.completedNodes}/{workflowState.totalNodes || workflowState.nodes.length} 个节点已完成
                    </span>
                  </div>
                  
                  {/* 进度条 */}
                  {workflowState.nodes.length > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${((workflowState.totalNodes || workflowState.nodes.length) > 0) 
                            ? (workflowState.completedNodes / (workflowState.totalNodes || workflowState.nodes.length)) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  )}

                  {/* 节点状态列表 - 增强显示 */}
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {workflowState.nodes.map((node) => {
                      const NodeIcon = getNodeIcon(node.nodeType);
                      return (
                        <div 
                          key={node.nodeId} 
                          className={cn(
                            "flex items-center gap-3 text-xs p-2 rounded-lg transition-all duration-200",
                            node.status === 'running' && "bg-blue-50 border border-blue-200 shadow-sm",
                            node.status === 'completed' && "bg-green-50 border border-green-200 shadow-sm",
                            node.status === 'failed' && "bg-red-50 border border-red-200 shadow-sm",
                            node.status === 'waiting' && "bg-gray-50 border border-gray-100"
                          )}
                        >
                          {/* 节点类型图标 */}
                          <div className="flex-shrink-0">
                            <NodeIcon className={cn(
                              "w-4 h-4",
                              node.status === 'running' && "text-blue-600",
                              node.status === 'completed' && "text-green-600", 
                              node.status === 'failed' && "text-red-600",
                              node.status === 'waiting' && "text-gray-400"
                            )} />
                          </div>

                          {/* 状态图标 */}
                          <div className="flex-shrink-0">
                            {node.status === 'waiting' && <Clock className="w-3 h-3 text-gray-400" />}
                            {node.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                            {node.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                            {node.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-600" />}
                          </div>
                          
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
                            {node.nodeType && (
                              <div className="text-gray-500 text-xs truncate">
                                {node.nodeType}
                              </div>
                            )}
                            {node.error && (
                              <div className="text-red-600 text-xs mt-1 truncate">
                                错误: {node.error}
                              </div>
                            )}
                          </div>

                          {/* 执行时间 */}
                          {node.status === 'running' && node.startTime && (
                            <div className="text-gray-500 text-xs bg-white/50 px-1 py-0.5 rounded">
                              {Math.floor((Date.now() - node.startTime.getTime()) / 1000)}s
                            </div>
                          )}
                          {node.status === 'completed' && node.startTime && node.endTime && (
                            <div className="text-gray-500 text-xs bg-white/50 px-1 py-0.5 rounded">
                              {Math.floor((node.endTime.getTime() - node.startTime.getTime()) / 1000)}s
                            </div>
                          )}

                          {/* 正在运行的动态指示器 */}
                          {node.status === 'running' && (
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Enhanced Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">发生错误</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {enableRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded transition-all disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  重试发送
                </button>
              )}
              
              <button
                onClick={handleNewConversation}
                disabled={isLoading}
                className="inline-flex items-center gap-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                新对话
              </button>
              
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).debugChat) {
                      (window as any).debugChat.debugWorkflowStatus();
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded transition-all"
                >
                  🔧 调试信息
                </button>
              )}
              
              <button
                onClick={() => setError(null)}
                className="inline-flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded transition-all"
              >
                ✕ 关闭
              </button>
            </div>
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
