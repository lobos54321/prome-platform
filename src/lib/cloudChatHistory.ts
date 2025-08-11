/**
 * 云端Chat History管理服务
 * 使用Supabase数据库存储和同步聊天历史
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateUUID } from './utils';

// 数据库表的TypeScript类型定义
export interface ChatDevice {
  id: string;
  device_id: string;
  created_at: string;
  last_active: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export interface ChatConversation {
  id: string;
  device_id: string;
  title: string;
  dify_conversation_id?: string;
  message_count: number;
  last_message?: string;
  last_message_time: string;
  created_at: string;
  updated_at: string;
  workflow_state?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  message_id?: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
}

class CloudChatHistoryService {
  private supabase: SupabaseClient;
  private deviceId: string;

  constructor() {
    // 初始化Supabase客户端
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * 获取或创建设备唯一标识
   */
  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return '';
    
    let deviceId = localStorage.getItem('chat_device_id');
    
    if (!deviceId) {
      // 生成基于浏览器特征的设备ID
      const navigator_info = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const screen_info = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '';
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = typeof navigator !== 'undefined' ? navigator.language : '';
      
      const fingerprint = `${navigator_info}-${screen_info}-${timezone}-${language}`;
      const hash = this.simpleHash(fingerprint);
      
      deviceId = `device_${hash}_${Date.now()}`;
      localStorage.setItem('chat_device_id', deviceId);
      
      // 注册设备到数据库
      this.registerDevice(deviceId, navigator_info).catch(error => {
        console.warn('Failed to register device:', error);
      });
    }
    
    return deviceId;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 注册设备到数据库
   */
  private async registerDevice(deviceId: string, userAgent?: string): Promise<void> {
    const { error } = await this.supabase
      .from('chat_devices')
      .upsert({
        device_id: deviceId,
        user_agent: userAgent,
        last_active: new Date().toISOString(),
        metadata: {
          created_via: 'web_app',
          version: '1.0.0'
        }
      }, {
        onConflict: 'device_id'
      });

    if (error) {
      console.warn('Failed to register device:', error);
    }
  }

  /**
   * 设置当前设备ID到Supabase会话
   */
  private async setCurrentDeviceId(): Promise<void> {
    const { error } = await this.supabase.rpc('set_config', {
      setting_name: 'app.current_device_id',
      setting_value: this.deviceId
    });
    
    if (error) {
      console.warn('Failed to set device ID in session:', error);
    }
  }

  /**
   * 保存对话到云端
   */
  async saveConversation(
    title: string,
    messages: Array<{
      id: string;
      content: string;
      role: 'user' | 'assistant' | 'system';
      timestamp: Date;
      metadata?: Record<string, any>;
    }>,
    workflowState?: Record<string, any>,
    difyConversationId?: string
  ): Promise<string> {
    await this.setCurrentDeviceId();
    
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const lastMessage = messages[messages.length - 1];
    
    // 插入或更新对话记录
    const conversationData = {
      device_id: this.deviceId,
      title,
      dify_conversation_id: difyConversationId,
      message_count: messages.length,
      last_message: lastMessage?.content || '',
      last_message_time: lastMessage?.timestamp.toISOString() || new Date().toISOString(),
      workflow_state: workflowState || {},
      metadata: {
        last_user_message: lastUserMessage?.content || '',
        updated_via: 'auto_save'
      }
    };

    const { data: conversation, error: conversationError } = await this.supabase
      .from('chat_conversations')
      .insert(conversationData)
      .select('id')
      .single();

    if (conversationError) {
      throw new Error(`Failed to save conversation: ${conversationError.message}`);
    }

    // 批量插入消息
    const messagesToInsert = messages.map(msg => ({
      conversation_id: conversation.id,
      content: msg.content,
      role: msg.role,
      created_at: msg.timestamp.toISOString(),
      metadata: msg.metadata || {}
    }));

    const { error: messagesError } = await this.supabase
      .from('chat_messages')
      .insert(messagesToInsert);

    if (messagesError) {
      console.warn('Some messages failed to save:', messagesError);
    }

    return conversation.id;
  }

  /**
   * 获取所有对话列表
   */
  async getConversations(): Promise<ChatConversation[]> {
    await this.setCurrentDeviceId();
    
    const { data, error } = await this.supabase
      .from('chat_conversations')
      .select('*')
      .eq('device_id', this.deviceId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取特定对话及其消息
   */
  async getConversationWithMessages(conversationId: string): Promise<ConversationWithMessages | null> {
    await this.setCurrentDeviceId();
    
    // 获取对话信息
    const { data: conversation, error: convError } = await this.supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('device_id', this.deviceId)
      .single();

    if (convError || !conversation) {
      console.warn('Conversation not found:', convError?.message);
      return null;
    }

    // 获取消息
    const { data: messages, error: messagesError } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.warn('Failed to fetch messages:', messagesError.message);
      return { ...conversation, messages: [] };
    }

    return {
      ...conversation,
      messages: messages || []
    };
  }

  /**
   * 更新已存在的对话
   */
  async updateConversation(
    conversationId: string,
    updates: Partial<{
      title: string;
      last_message: string;
      message_count: number;
      workflow_state: Record<string, any>;
    }>
  ): Promise<void> {
    await this.setCurrentDeviceId();
    
    const { error } = await this.supabase
      .from('chat_conversations')
      .update({
        ...updates,
        last_message_time: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('device_id', this.deviceId);

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.setCurrentDeviceId();
    
    const { error } = await this.supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('device_id', this.deviceId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  /**
   * 添加新消息到现有对话
   */
  async addMessageToConversation(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant' | 'system',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.setCurrentDeviceId();
    
    // 插入消息
    const { error: messageError } = await this.supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content,
        role,
        metadata: metadata || {}
      });

    if (messageError) {
      throw new Error(`Failed to add message: ${messageError.message}`);
    }

    // 更新对话的最后消息信息
    const { error: updateError } = await this.supabase
      .from('chat_conversations')
      .update({
        last_message: content,
        last_message_time: new Date().toISOString(),
        message_count: await this.getMessageCount(conversationId)
      })
      .eq('id', conversationId)
      .eq('device_id', this.deviceId);

    if (updateError) {
      console.warn('Failed to update conversation metadata:', updateError.message);
    }
  }

  /**
   * 获取对话的消息数量
   */
  private async getMessageCount(conversationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversationId);

    if (error) {
      console.warn('Failed to count messages:', error.message);
      return 0;
    }

    return count || 0;
  }

  /**
   * 更新设备活跃时间
   */
  async updateDeviceActivity(): Promise<void> {
    const { error } = await this.supabase
      .from('chat_devices')
      .update({
        last_active: new Date().toISOString()
      })
      .eq('device_id', this.deviceId);

    if (error) {
      console.warn('Failed to update device activity:', error);
    }
  }

  /**
   * 加载历史对话并恢复Dify对话状态
   */
  async loadConversationFromHistory(conversationId: string): Promise<ConversationWithMessages | null> {
    console.log('[Chat Debug] 🔄 开始加载历史对话:', conversationId);
    
    const conversationWithMessages = await this.getConversationWithMessages(conversationId);
    if (!conversationWithMessages) {
      console.log('[Chat Debug] ❌ 历史对话未找到');
      return null;
    }

    // 🚨 关键修复：正确恢复Dify对话ID以保持对话连续性
    if (conversationWithMessages.dify_conversation_id) {
      localStorage.setItem('dify_conversation_id', conversationWithMessages.dify_conversation_id);
      localStorage.setItem('dify_conversation_id_streaming', conversationWithMessages.dify_conversation_id);
      console.log('[Chat Debug] ✅ 恢复Dify对话ID:', conversationWithMessages.dify_conversation_id);
    } else {
      console.log('[Chat Debug] ⚠️ 历史对话没有Dify对话ID，可能会从头开始');
    }

    // 恢复工作流状态
    if (conversationWithMessages.workflow_state) {
      localStorage.setItem('dify_workflow_state', JSON.stringify(conversationWithMessages.workflow_state));
      console.log('[Chat Debug] ✅ 恢复工作流状态:', conversationWithMessages.workflow_state);
    }

    console.log(`[Chat Debug] ✅ 历史对话加载完成: ${conversationWithMessages.title} (${conversationWithMessages.messages.length} 条消息)`);
    return conversationWithMessages;
  }

  /**
   * 获取设备ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }
}

// 导出单例实例
export const cloudChatHistory = new CloudChatHistoryService();
export default cloudChatHistory;