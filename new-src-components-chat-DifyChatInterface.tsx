'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RotateCcw, Bot, User, Play, CheckCircle, AlertCircle, Clock, MessageSquare, X, Trash2, Cloud, Wifi, WifiOff, Code, FileText, Database, Settings, Users, MessageCircle, Zap, Cpu, Globe, RefreshCw } from 'lucide-react';
import { cn, isValidUUID, generateUUID } from '@/lib/utils';
import { useTokenMonitoring } from '@/hooks/useTokenMonitoring';
import { cloudChatHistory, ChatConversation } from '@/lib/cloudChatHistory';
import { chatHistoryMigration } from '@/lib/chatHistoryMigration';
import { authService } from '@/lib/auth';
import { toast } from 'sonner';
import { usePainPointBranches } from '../../hooks/usePainPointBranches';
import { PainPointTabNavigation } from './PainPointTabNavigation';
import { PainPointBranchContent } from './PainPointBranchContent';

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
  difyConversationId?: string; // 🆕 添加 Dify 对话 ID 用于重复检测
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
  
  // 🆕 痛点分支管理
  const {
    versions: painPointVersions,
    activeVersionId,
    regenerateCount,
    maxRegenerateCount,
    canRegenerate,
    switchVersion,
    addNewVersion,
    getActiveVersionMessages
  } = usePainPointBranches(messages);

  // 🔍 调试版本检测
  useEffect(() => {
    if (painPointVersions.length > 0) {
      console.log('🔍 [DifyChatInterface] Pain point versions detected:', painPointVersions.length, painPointVersions.map(v => ({ id: v.id, label: v.label, messageCount: v.messages.length })));
    }
  }, [painPointVersions]);
  
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

  // 🆕 云端对话历史管理函数（性能优化版本）
  const loadCloudConversations = async (forceRefresh = false) => {
    try {
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      // 🔧 性能优化：检查缓存，避免频繁查询数据库
      const now = new Date();
      const lastSyncTime = chatHistory.lastSyncTime;
      const cacheValidDurationMs = 30000; // 30秒缓存
      
      const isCacheValid = !forceRefresh && 
        lastSyncTime && 
        chatHistory.conversations.length > 0 &&
        (now.getTime() - lastSyncTime.getTime()) < cacheValidDurationMs;
      
      if (isCacheValid) {
        console.log('[Chat Debug] 📦 使用缓存的对话列表，跳过数据库查询');
        setChatHistory(prev => ({ ...prev, syncStatus: 'idle' }));
        return;
      }
      
      console.log('[Chat Debug] 🔄 从数据库加载对话历史...');
      const cloudConversations = await cloudChatHistory.getConversations();
      
      // 🔧 修复：确保cloudConversations是数组
      if (!Array.isArray(cloudConversations)) {
        console.warn('[Chat Debug] ⚠️ cloudConversations不是数组:', cloudConversations);
        setChatHistory(prev => ({ ...prev, syncStatus: 'error' }));
        return;
      }
      
      const convertedConversations: ConversationHistoryItem[] = cloudConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessage: conv.last_message || '',
        lastMessageTime: new Date(conv.last_message_time),
        messageCount: conv.message_count,
        messages: [], // 延迟加载消息
        workflowState: conv.workflow_state as WorkflowState,
        difyConversationId: conv.dify_conversation_id // 🆕 设置 Dify 对话 ID
      }));

      console.log('[Chat Debug] ✅ 对话历史加载完成:', convertedConversations.length, '个对话');
      setChatHistory(prev => ({
        ...prev,
        conversations: convertedConversations,
        syncStatus: 'idle',
        lastSyncTime: now
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
    
    // 🔧 修复：防止重复保存相同对话
    const difyConvId = localStorage.getItem('dify_conversation_id');
    const currentConvId = difyConvId || conversationId;
    
    // 检查是否已经保存过这个对话
    if (currentConvId && chatHistory.conversations.some(conv => 
      conv.difyConversationId === currentConvId && conv.messageCount === messages.length
    )) {
      console.log('[Chat Debug] 🔄 对话已存在且消息数量相同，跳过保存:', currentConvId, messages.length);
      return;
    }
    
    try {
      setChatHistory(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const title = generateConversationTitle(messages);
      console.log('[Chat Debug] 💾 保存对话到云端:', title, '消息数:', messages.length);
      
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
        currentConvId || undefined
      );

      // 更新本地状态
      const conversationItem: ConversationHistoryItem = {
        id: cloudConversationId,
        title,
        lastMessage: messages[messages.length - 1]?.content || '',
        lastMessageTime: new Date(),
        messageCount: messages.length,
        messages: [...messages],
        workflowState: { ...workflowState },
        difyConversationId: currentConvId || undefined // 🆕 设置 Dify 对话 ID
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

    // 🔥 关键修复：完全清除所有Dify相关状态，包括对话变量
    // 这样确保新对话从LLM18开始，而不是跳到LLM0或LLM3
    const keysToRemove = [
      'dify_conversation_id', 
      'dify_conversation_id_streaming', 
      'dify_session_timestamp', 
      'dify_workflow_state', 
      'dify_messages',
      'dify_conversation_variables', // 清除可能的对话变量缓存
      'dify_last_real_activity',
      'dify_last_visit'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    // 🔥 关键修复：为新对话生成全新的用户ID，确保Dify服务端完全重置对话变量状态
    const newUserId = user?.id || `fresh-user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setUserId(newUserId);
    localStorage.setItem('dify_user_id', newUserId);
    localStorage.setItem('dify_session_timestamp', Date.now().toString());
    
    console.log('[Chat Debug] 🔥 新对话创建 - 完全重置:', {
      newUserId,
      clearedConversationId: true,
      clearedConversationVariables: true,
      workflowWillStartFromLLM18: true
    });
    
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
  // 🔧 修复：只在真正关闭浏览器时保存，页面刷新不保存（避免重复记录）
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 只在真正关闭浏览器时保存，页面刷新不保存
      // 使用 event.returnValue 检查是否为真正的关闭操作
      if (messages.length > 0 && !event.returnValue) {
        console.log('[Chat Debug] 🏃‍♂️ 浏览器即将关闭，保存对话历史');
        saveConversationToHistory();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 🚫 移除组件卸载时的自动保存，避免页面刷新时重复保存
      // if (messages.length > 0) {
      //   saveConversationToHistory();
      // }
    };
  }, [messages.length]);

  // 🔧 修复：只保存localStorage，不自动保存云端历史（避免创建太多对话记录）
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 🆕 立即保存到localStorage用于页面刷新恢复
    try {
      localStorage.setItem('dify_messages', JSON.stringify(messages));
      console.log('[Chat Debug] 💾 已保存消息到localStorage:', messages.length, '条');
    } catch (error) {
      console.warn('[Chat Debug] 保存消息到localStorage失败:', error);
    }
    
    // 🚫 移除自动保存云端历史，只在用户主动创建新对话时保存
    // const saveTimer = setTimeout(() => {
    //   saveConversationToHistory();
    // }, 2000); // 2秒后保存，避免频繁保存
    // return () => clearTimeout(saveTimer);
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
        // 🔥 优先检查是否有稳定的用户ID（不是临时匿名ID）
        const storedUserId = localStorage.getItem('dify_user_id');
        const storedConversationId = localStorage.getItem('dify_conversation_id');
        
        // 🔧 修复：简化用户ID判断逻辑 - 只要有存储的用户ID就恢复对话历史
        // 这样可以确保所有类型的用户（包括匿名用户）都能在页面刷新后恢复对话
        const hasStoredUserId = storedUserId && storedUserId.length > 5;
        
        if (hasStoredUserId) {
          // 页面刷新，保持原有的会话状态
          console.log('[Chat Debug] 🔄 页面刷新 - 恢复用户ID和对话状态:', storedUserId);
          setUserId(storedUserId);
          
          // 🔧 修复：无论是否有conversation_id都恢复消息历史
          if (storedConversationId) {
            setConversationId(storedConversationId);
            console.log('[Chat Debug] 🔄 恢复对话ID:', storedConversationId);
          }
          
          // 🆕 关键修复：页面刷新时立即恢复消息历史（避免延迟）
          try {
            const storedMessages = localStorage.getItem('dify_messages');
            const storedWorkflowState = localStorage.getItem('dify_workflow_state');
            
            if (storedMessages) {
              const parsedMessages = JSON.parse(storedMessages);
              if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                console.log('[Chat Debug] 🔄 立即恢复消息历史:', parsedMessages.length, '条消息');
                
                // 🔧 优化：消息恢复时保持完整的数据结构
                const restoredMessages = parsedMessages.map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp)
                }));
                
                console.log('[Chat Debug] ✅ 消息历史恢复完成:', restoredMessages.length, '条');
                setMessages(restoredMessages);
                
                // 🔧 关键修复：消息恢复后强制确认conversationId
                if (storedConversationId && !conversationId) {
                  console.log('[Chat Debug] 🔧 强制恢复conversationId:', storedConversationId);
                  setConversationId(storedConversationId);
                }
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

  // 🔧 添加备用消息恢复机制 - 确保无论何种情况都能恢复历史
  useEffect(() => {
    // 早期检查并恢复消息历史（备用机制）
    const storedMessages = localStorage.getItem('dify_messages');
    if (storedMessages && messages.length === 0) {
      try {
        const parsedMessages = JSON.parse(storedMessages);
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          // 🔧 修复：过滤掉只有欢迎消息的情况，显示新的欢迎消息
          const nonWelcomeMessages = parsedMessages.filter((msg: any) => 
            msg.id !== 'welcome' && 
            !msg.content.includes('您好！我是您的AI助手') &&
            !msg.content.includes('Hi! I am your marketing content AI assistant')
          );
          
          if (nonWelcomeMessages.length > 0) {
            console.log('[Chat Debug] 🔄 [备用机制] 恢复消息历史:', nonWelcomeMessages.length, '条消息');
            const restoredMessages = nonWelcomeMessages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(restoredMessages);
            return; // 如果恢复了非欢迎消息，就不添加新欢迎消息
          } else {
            console.log('[Chat Debug] 🔄 [备用机制] 只有欢迎消息，清除并显示新欢迎消息');
            localStorage.removeItem('dify_messages'); // 清除只有欢迎消息的localStorage
          }
        }
      } catch (error) {
        console.warn('[Chat Debug] [备用机制] 消息历史恢复失败:', error);
      }
    }
    
    // 添加欢迎消息 - 只在没有恢复消息的情况下
    if (messages.length === 0 && welcomeMessage && isUserIdReady) {
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
          // 🔥 关键修复：智能对话ID管理，防止工作流重置
          conversation_id: (() => {
            const storedConvId = localStorage.getItem('dify_conversation_id');
            const hasMessages = messages.length > 0;
            const hasActiveConversation = conversationId || storedConvId;
            
            // 🚨 新增：严格条件判断是否为新对话
            // 只有在完全没有消息历史且没有任何对话ID时才算新对话
            const isNewConversation = !hasMessages && !hasActiveConversation;
            
            // 🔧 修复：优先使用React state中的conversationId，其次使用localStorage
            const finalConvId = isNewConversation ? null : (conversationId || storedConvId || null);
            
            console.log('[🔍 对话状态调试] conversation_id逻辑详细追踪:', {
              conversationId_react_state: conversationId,
              localStorage_dify_id: storedConvId,
              messages_count: messages.length,
              hasMessages,
              hasActiveConversation,
              isNewConversation,
              final_conversation_id: finalConvId,
              workflowWillStartFrom: isNewConversation ? 'LLM18 (全新对话)' : 'continuation (继续对话)',
              workflow_protection: !isNewConversation ? '✅ 保护现有工作流状态' : '⚠️ 将开始新工作流',
              timestamp: new Date().toISOString(),
              debug_context: {
                caller: 'sendMessageWithRetry',
                retry_attempt: currentRetry,
                user_message: messageContent.substring(0, 30) + '...'
              }
            });
            
            // 🛡️ 安全检查：如果有消息但没有对话ID，这是异常情况
            if (hasMessages && !hasActiveConversation) {
              console.warn('[🚨 对话状态异常] 检测到有消息历史但缺少对话ID，这可能导致工作流重置!', {
                messages_count: messages.length,
                conversationId,
                storedConvId,
                will_create_new_conversation: true,
                recommendation: '考虑从消息历史中恢复对话ID或提醒用户重新开始'
              });
            }
            
            return finalConvId;
          })(),
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
        
        // 🔧 修复：只在真正的conversation ID错误时才重置，避免误清除
        if (errorData.message && (
          errorData.message.includes('Conversation Not Exists') || 
          errorData.message.includes('not a valid uuid')
        ) && response.status === 404) {
          console.warn('🔄 Confirmed invalid conversation_id (404), clearing and retrying with new conversation');
          console.warn('🔍 Error details:', errorData.message);
          
          // 只有在确认是404错误且明确是conversation ID问题时才重置
          localStorage.removeItem('dify_conversation_id');
          setConversationId(null);
          
          if (currentRetry < maxRetries) {
            return sendMessageWithRetry(messageContent, currentRetry + 1);
          }
        }
        
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
        const isActiveWorkflow = workflowState.isWorkflow && workflowState.nodes.length > 0;
        const timeoutError = isActiveWorkflow 
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

  // 🔧 处理流式响应（包含工作流节点事件）
  const handleWorkflowStream = async (response: Response, messageContent: string) => {
    if (!response.body) {
      throw new Error('No response body available for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessageId = generateUUID();
    let assistantContent = '';
    let bufferContent = '';
    let detectedConversationId: string | null = null;
    let streamError: string | null = null;
    let finalUsageData: any = null;

    // 🔍 预先添加用户消息到界面
    const userMessageId = generateUUID();
    const userMessage: Message = {
      id: userMessageId,
      content: messageContent,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        bufferContent += chunk;

        // 处理多个完整的事件行
        const lines = bufferContent.split('\n');
        bufferContent = lines.pop() || ''; // 保留可能不完整的最后一行

        for (const line of lines) {
          if (!line.trim()) continue;
          
          // SSE格式：data: {json}
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6);
              
              // 跳过结束标记
              if (jsonStr === '[DONE]' || jsonStr.includes('[DONE]')) {
                console.log('[Stream] 🏁 接收到结束标记，流结束');
                continue;
              }

              const data = JSON.parse(jsonStr);
              console.log('[Stream] 📦 收到数据包:', {
                event: data.event,
                conversation_id: data.conversation_id,
                hasAnswer: !!data.answer,
                answerLength: data.answer?.length
              });

              // 🔧 修复：始终检查并更新conversation_id
              if (data.conversation_id && data.conversation_id !== conversationId) {
                console.log('[Stream] 🆔 更新conversation_id:', data.conversation_id);
                detectedConversationId = data.conversation_id;
                setConversationId(data.conversation_id);
                
                if (typeof window !== 'undefined') {
                  localStorage.setItem('dify_conversation_id', data.conversation_id);
                  localStorage.setItem('dify_conversation_id_streaming', data.conversation_id);
                }
              }

              // 处理不同类型的流事件
              switch (data.event) {
                case 'message':
                case 'agent_message':
                  // 增量更新助手消息内容
                  if (data.answer) {
                    assistantContent += data.answer;
                    
                    // 实时更新消息显示
                    setMessages(prev => {
                      const existingIndex = prev.findIndex(m => m.id === assistantMessageId);
                      const assistantMessage: Message = {
                        id: assistantMessageId,
                        content: assistantContent,
                        role: 'assistant',
                        timestamp: new Date(),
                        metadata: { messageId: data.message_id }
                      };

                      if (existingIndex >= 0) {
                        const newMessages = [...prev];
                        newMessages[existingIndex] = assistantMessage;
                        return newMessages;
                      } else {
                        return [...prev, assistantMessage];
                      }
                    });
                  }
                  break;

                case 'node_started':
                  // 工作流节点开始
                  console.log('[Workflow] 🚀 节点开始:', data.data?.node_id);
                  if (data.data?.node_id) {
                    updateWorkflowProgress({
                      nodeId: data.data.node_id,
                      nodeName: data.data.title || data.data.node_id,
                      nodeTitle: data.data.title,
                      nodeType: data.data.node_type,
                      status: 'running',
                      startTime: new Date()
                    });
                  }
                  break;

                case 'node_finished':
                  // 工作流节点完成
                  console.log('[Workflow] ✅ 节点完成:', data.data?.node_id);
                  if (data.data?.node_id) {
                    updateWorkflowProgress({
                      nodeId: data.data.node_id,
                      status: 'completed',
                      endTime: new Date()
                    });

                    // 🔍 尝试提取模型信息
                    const extractedModel = extractModelFromResponse(data, 'node_finished');
                    if (extractedModel) {
                      finalUsageData = {
                        ...finalUsageData,
                        model: extractedModel,
                        model_provider: data.data?.process_data?.model_provider || 'unknown'
                      };
                    }
                  }
                  break;

                case 'error':
                  // 错误处理
                  console.error('[Stream] ❌ 收到错误:', data);
                  streamError = data.message || '处理过程中发生错误';
                  break;

                case 'message_end':
                case 'workflow_finished':
                  // 流结束事件
                  console.log('[Stream] 🏁 流结束事件:', data.event);
                  
                  // 处理最终的usage数据
                  if (data.metadata?.usage) {
                    finalUsageData = {
                      ...finalUsageData,
                      ...data.metadata.usage
                    };
                  }
                  break;

                default:
                  console.log('[Stream] 📋 未处理的事件类型:', data.event, data);
              }

            } catch (parseError) {
              console.warn('[Stream] ⚠️ 解析JSON失败:', parseError, 'Line:', line);
              // 继续处理下一行，不中断流
            }
          }
        }
      }

      // 流处理完成后的清理工作
      console.log('[Stream] 📋 流处理完成，最终状态:', {
        assistantContentLength: assistantContent.length,
        detectedConversationId,
        streamError,
        finalUsageData
      });

      // 如果有错误，抛出异常
      if (streamError) {
        throw new Error(streamError);
      }

      // 处理token使用情况
      if (finalUsageData && processTokenUsage) {
        try {
          await processTokenUsage(finalUsageData);
          console.log('[Token] ✅ Token使用处理完成');
        } catch (tokenError) {
          console.warn('[Token] ⚠️ Token处理失败:', tokenError);
        }
      }

      // 确保会话ID正确保存
      if (detectedConversationId && detectedConversationId !== conversationId) {
        setConversationId(detectedConversationId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('dify_conversation_id', detectedConversationId);
          localStorage.setItem('dify_session_timestamp', Date.now().toString());
          console.log('[Stream] 💾 最终conversation_id已保存:', detectedConversationId);
        }
      }

    } catch (streamError) {
      console.error('[Stream] ❌ 流处理错误:', streamError);
      
      // 更新UI显示错误
      const errorMessage = streamError instanceof Error ? streamError.message : '流处理失败';
      setMessages(prev => {
        const errorMsg: Message = {
          id: generateUUID(),
          content: `错误: ${errorMessage}`,
          role: 'assistant',
          timestamp: new Date()
        };
        return [...prev, errorMsg];
      });

      throw streamError;
    } finally {
      reader.releaseLock();
    }
  };

  // 🔧 处理普通响应（非流式）
  const handleRegularResponse = async (data: any, messageContent: string) => {
    console.log('[Chat Debug] 📋 处理普通响应:', {
      hasAnswer: !!data.answer,
      answerLength: data.answer?.length || 0,
      conversationId_returned: data.conversation_id,
      messageId: data.message_id,
      hasMetadata: !!data.metadata,
      timestamp: new Date().toISOString()
    });

    // 更新conversation_id
    if (data.conversation_id && data.conversation_id !== conversationId) {
      console.log('[Chat Debug] 🆔 更新conversation_id从普通响应:', data.conversation_id);
      setConversationId(data.conversation_id);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('dify_conversation_id', data.conversation_id);
        localStorage.setItem('dify_session_timestamp', Date.now().toString());
        console.log('[Chat Debug] 💾 Conversation ID已保存:', data.conversation_id);
      }
    }

    // 添加用户消息
    const userMessage: Message = {
      id: generateUUID(),
      content: messageContent,
      role: 'user',
      timestamp: new Date()
    };

    // 添加助手响应
    const assistantMessage: Message = {
      id: generateUUID(),
      content: data.answer || '抱歉，没有收到有效回复',
      role: 'assistant',
      timestamp: new Date(),
      metadata: {
        messageId: data.message_id,
        conversationId: data.conversation_id
      }
    };

    // 更新消息列表
    setMessages(prev => [...prev, userMessage, assistantMessage]);

    // 处理token使用情况
    if (data.metadata?.usage && processTokenUsage) {
      try {
        // 🔍 尝试从普通响应中提取模型信息
        const extractedModel = extractModelFromResponse(data, 'regular_response');
        const usageData = {
          ...data.metadata.usage,
          model: extractedModel || data.metadata.usage.model || 'unknown'
        };
        
        await processTokenUsage(usageData);
        console.log('[Token] ✅ Token使用处理完成（普通响应）');
      } catch (tokenError) {
        console.warn('[Token] ⚠️ Token处理失败（普通响应）:', tokenError);
      }
    }

    console.log('[Chat Debug] ✅ 普通响应处理完成');
  };

  // 🔧 工作流按钮点击处理
  const handleWorkflowButtonClick = async (buttonMessage: string) => {
    console.log('[Workflow] 🔘 工作流按钮点击:', buttonMessage);
    
    if (isLoading) {
      console.log('[Workflow] ⚠️ 正在加载中，忽略按钮点击');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await sendMessageWithRetry(buttonMessage);
      console.log('[Workflow] ✅ 工作流按钮消息发送成功');
    } catch (error) {
      console.error('[Workflow] ❌ 工作流按钮消息发送失败:', error);
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔧 重新生成响应处理
  const handleRegenerateResponse = async (messageIndex: number) => {
    console.log('[Regenerate] 🔄 请求重新生成第', messageIndex, '条消息的响应');
    
    if (isLoading) {
      console.log('[Regenerate] ⚠️ 正在加载中，忽略重新生成请求');
      return;
    }
    
    // 找到对应的用户消息
    let userMessageIndex = -1;
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        userMessageIndex = i;
        break;
      }
    }
    
    if (userMessageIndex === -1) {
      console.error('[Regenerate] ❌ 找不到对应的用户消息');
      toast.error('无法重新生成：找不到原始消息');
      return;
    }
    
    const userMessage = messages[userMessageIndex];
    console.log('[Regenerate] 🔍 找到用户消息:', userMessage.content.substring(0, 50) + '...');
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 🚀 关键修复：为重新生成创建全新对话
      // Dify API不支持消息重新生成，所以我们需要在新对话中重新发送消息
      console.log('[Regenerate] 🔥 清除当前对话状态，为重新生成准备新对话');
      
      // 清除Dify对话状态，确保重新生成在全新的上下文中进行
      localStorage.removeItem('dify_conversation_id');
      localStorage.removeItem('dify_conversation_id_streaming');
      setConversationId(null);
      
      // 生成全新的用户ID以确保对话变量被重置
      const freshUserId = user?.id || `regen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      setUserId(freshUserId);
      localStorage.setItem('dify_user_id', freshUserId);
      
      console.log('[Regenerate] 🆕 新的用户ID:', freshUserId);
      
      // 重置工作流状态
      resetWorkflowState();
      
      // 在全新的环境中发送消息
      await sendMessageWithRetry(userMessage.content);
      
      console.log('[Regenerate] ✅ 重新生成成功');
      
      // 📝 标记新生成的消息
      setMessages(prev => prev.map((msg, index) => {
        if (msg.role === 'assistant' && index === messageIndex) {
          return { ...msg, metadata: { ...msg.metadata, isRegenerated: true } };
        }
        return msg;
      }));
      
    } catch (error) {
      console.error('[Regenerate] ❌ 重新生成失败:', error);
      const errorMessage = error instanceof Error ? error.message : '重新生成失败';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔧 提取痛点内容
  const extractPainPointContent = (content: string, painPointNumber: number): string => {
    try {
      // 正则匹配痛点内容
      const painPointRegex = new RegExp(`"${painPointNumber}"\\s*:\\s*\\{[^}]+\\}`, 'g');
      const matches = content.match(painPointRegex);
      
      if (matches && matches[0]) {
        const painPointBlock = matches[0];
        // 提取problem字段的内容
        const problemMatch = painPointBlock.match(/"problem"\s*:\s*"([^"]+)"/); 
        if (problemMatch) {
          const problemText = problemMatch[1];
          console.log(`[PainPoint] 提取痛点${painPointNumber}:`, problemText);
          return problemText;
        }
      }
      
      // 备用提取方法：直接查找痛点关键词
      const fallbackRegex = new RegExp(`痛点${painPointNumber}[:：]?\\s*([^\n\r。]+)`, 'i');
      const fallbackMatch = content.match(fallbackRegex);
      if (fallbackMatch) {
        const result = fallbackMatch[1].trim();
        console.log(`[PainPoint] 备用提取痛点${painPointNumber}:`, result);
        return result;
      }
      
      console.warn(`[PainPoint] 无法提取痛点${painPointNumber}内容`);
      return `痛点${painPointNumber}`;
    } catch (error) {
      console.error(`[PainPoint] 提取痛点${painPointNumber}出错:`, error);
      return `痛点${painPointNumber}`;
    }
  };

  // 🔧 检测LLM3阶段（痛点精化阶段）
  const isLLM3Stage = (message: Message): boolean => {
    return message.content.includes('优化痛点') || 
           message.content.includes('精化痛点') || 
           message.content.includes('详细分析') ||
           (message.content.includes('痛点') && 
            (message.content.includes('消费者') || message.content.includes('分析')));
  };

  // 🔧 检测内容策略阶段
  const isContentStrategyStage = (message: Message): boolean => {
    return message.content.includes('内容策略') || 
           message.content.includes('文案策略') ||
           message.content.includes('营销策略') ||
           (message.content.includes('策略') && message.content.includes('内容'));
  };

  // 🔧 检测最终文案阶段
  const isFinalContentStage = (message: Message): boolean => {
    return message.content.includes('最终文案') || 
           message.content.includes('营销文案') ||
           (message.content.length > 200 && 
            (message.content.includes('标题') || message.content.includes('正文')));
  };

  // 🔧 表单提交处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) {
      return;
    }
    
    const messageContent = input.trim();
    setInput(''); // 立即清空输入框
    setIsLoading(true);
    setError(null);
    
    try {
      await sendMessageWithRetry(messageContent);
    } catch (error) {
      console.error('[Submit] ❌ 消息发送失败:', error);
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔧 重试处理
  const handleRetry = async () => {
    if (!messages.length || isLoading) return;
    
    // 找到最后一条用户消息
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      toast.error('没有找到可重试的消息');
      return;
    }
    
    console.log('[Retry] 🔄 重试最后一条消息:', lastUserMessage.content.substring(0, 50) + '...');
    
    setIsLoading(true);
    setError(null);
    
    try {
      await sendMessageWithRetry(lastUserMessage.content);
    } catch (error) {
      console.error('[Retry] ❌ 重试失败:', error);
      const errorMessage = error instanceof Error ? error.message : '重试失败';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔧 创建新对话处理
  const handleNewConversation = () => {
  // 🔧 新增：检查是否在等待策略确认阶段
  const isWaitingForStrategyConfirmation = (): boolean => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage.role === 'assistant' && isContentStrategyStage(lastMessage);
  };

  // 🔧 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any as React.FormEvent);
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
            <RefreshCw className="w-4 h-4" />
            New Chat
          </button>
        </div>
      </div>

      {/* 🆕 历史对话面板 */}
      {showHistory && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-64 overflow-y-auto">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-800">Chat History</h4>
              <div className="flex items-center gap-2">
                {migrationStatus.needsMigration && (
                  <button
                    onClick={performMigration}
                    disabled={migrationStatus.isMigrating}
                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-all disabled:opacity-50"
                  >
                    {migrationStatus.isMigrating ? 'Migrating...' : 'Migrate to Cloud'}
                  </button>
                )}
                <button
                  onClick={() => loadCloudConversations(true)}
                  disabled={chatHistory.syncStatus === 'syncing'}
                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-all disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3 h-3", chatHistory.syncStatus === 'syncing' && 'animate-spin')} />
                </button>
              </div>
            </div>
            
            {chatHistory.conversations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No conversation history</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {chatHistory.conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      "p-2 rounded-lg cursor-pointer transition-all text-sm border",
                      chatHistory.currentConversationId === conv.id
                        ? "bg-blue-100 border-blue-200 text-blue-800"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    )}
                    onClick={() => loadConversationFromHistory(conv.id)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{conv.title}</p>
                        <p className="text-gray-500 text-xs truncate">{conv.lastMessage}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-400 text-xs">
                            {conv.lastMessageTime.toLocaleDateString()}
                          </span>
                          <span className="text-gray-400 text-xs">•</span>
                          <span className="text-gray-400 text-xs">{conv.messageCount} messages</span>
                          {conv.workflowState?.isWorkflow && (
                            <span className="text-blue-500 text-xs bg-blue-50 px-1 rounded">Workflow</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Area with Pain Point Navigation */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 🆕 Pain Point Tab Navigation */}
        {painPointVersions.length > 1 && (
          <PainPointTabNavigation
            versions={painPointVersions}
            activeVersionId={activeVersionId}
            onVersionSwitch={switchVersion}
            onAddNewVersion={addNewVersion}
            canRegenerate={canRegenerate}
            maxRegenerateCount={maxRegenerateCount}
            regenerateCount={regenerateCount}
          />
        )}
        
        {/* Messages Display */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 🆕 Pain Point Branch Content */}
          <PainPointBranchContent
            messages={getActiveVersionMessages()}
            onWorkflowButtonClick={handleWorkflowButtonClick}
            onRegenerateResponse={handleRegenerateResponse}
            isLoading={isLoading}
            isLLM3Stage={isLLM3Stage}
            isContentStrategyStage={isContentStrategyStage}
            isFinalContentStage={isFinalContentStage}
            extractPainPointContent={extractPainPointContent}
          />
          
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

                    {/* 节点状态列表 */}
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
                    <RefreshCw className="w-3 h-3" />
                    重试发送
                  </button>
                )}
                
                <button
                  onClick={handleNewConversation}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
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
            disabled={isLoading || !isUserIdReady || isWaitingForStrategyConfirmation()}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isUserIdReady || isWaitingForStrategyConfirmation()}
            className={cn(
              "px-4 py-2.5 rounded-lg font-medium transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              !input.trim() || isLoading || !isUserIdReady || isWaitingForStrategyConfirmation()
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