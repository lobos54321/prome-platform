/**
 * Chat History 迁移工具
 * 将localStorage中的聊天历史迁移到Supabase云端存储
 */

import { cloudChatHistory } from './cloudChatHistory';

export interface LocalStorageConversation {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  messageCount: number;
  messages: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
  workflowState?: {
    isWorkflow: boolean;
    nodes: any[];
    completedNodes: number;
    [key: string]: any;
  };
}

export interface LocalStorageChatHistory {
  conversations: LocalStorageConversation[];
  currentConversationId: string | null;
}

class ChatHistoryMigration {
  /**
   * 检查是否有localStorage数据需要迁移
   */
  async checkForLocalData(): Promise<{
    hasLocalData: boolean;
    conversationCount: number;
    totalMessages: number;
  }> {
    if (typeof window === 'undefined') {
      return { hasLocalData: false, conversationCount: 0, totalMessages: 0 };
    }

    try {
      const savedHistory = localStorage.getItem('dify_chat_history');
      if (!savedHistory) {
        return { hasLocalData: false, conversationCount: 0, totalMessages: 0 };
      }

      const localHistory: LocalStorageChatHistory = JSON.parse(savedHistory);
      const totalMessages = localHistory.conversations.reduce(
        (sum, conv) => sum + conv.messages.length, 0
      );

      return {
        hasLocalData: true,
        conversationCount: localHistory.conversations.length,
        totalMessages
      };
    } catch (error) {
      console.warn('Failed to check local data:', error);
      return { hasLocalData: false, conversationCount: 0, totalMessages: 0 };
    }
  }

  /**
   * 从localStorage读取聊天历史
   */
  private getLocalChatHistory(): LocalStorageChatHistory | null {
    if (typeof window === 'undefined') return null;

    try {
      const savedHistory = localStorage.getItem('dify_chat_history');
      if (!savedHistory) return null;

      const parsedHistory: LocalStorageChatHistory = JSON.parse(savedHistory);
      
      // 转换日期字符串回Date对象
      parsedHistory.conversations.forEach(conv => {
        conv.lastMessageTime = new Date(conv.lastMessageTime);
        conv.messages.forEach(msg => {
          msg.timestamp = new Date(msg.timestamp);
        });
      });

      return parsedHistory;
    } catch (error) {
      console.error('Failed to parse local chat history:', error);
      return null;
    }
  }

  /**
   * 执行完整迁移
   */
  async migrateToCloud(): Promise<{
    success: boolean;
    migratedConversations: number;
    migratedMessages: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      migratedConversations: 0,
      migratedMessages: 0,
      errors: [] as string[]
    };

    try {
      const localHistory = this.getLocalChatHistory();
      if (!localHistory || localHistory.conversations.length === 0) {
        result.success = true;
        return result;
      }

      console.log(`🚀 开始迁移 ${localHistory.conversations.length} 个对话到云端...`);

      // 逐个迁移对话
      for (const conversation of localHistory.conversations) {
        try {
          const cloudConversationId = await cloudChatHistory.saveConversation(
            conversation.title,
            conversation.messages.map(msg => ({
              id: msg.id,
              content: msg.content,
              role: msg.role,
              timestamp: msg.timestamp,
              metadata: msg.metadata
            })),
            conversation.workflowState,
            conversation.id // 使用原始ID作为dify_conversation_id
          );

          result.migratedConversations++;
          result.migratedMessages += conversation.messages.length;
          
          console.log(`✅ 迁移对话: ${conversation.title} (${conversation.messages.length} 条消息)`);
        } catch (error) {
          const errorMsg = `Failed to migrate conversation "${conversation.title}": ${error}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // 如果没有严重错误，标记为成功
      if (result.migratedConversations > 0 || result.errors.length === 0) {
        result.success = true;
      }

      console.log(`📊 迁移完成: ${result.migratedConversations} 个对话, ${result.migratedMessages} 条消息`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ ${result.errors.length} 个错误:`, result.errors);
      }

      return result;
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      console.error('迁移过程中发生致命错误:', error);
      return result;
    }
  }

  /**
   * 备份localStorage数据
   */
  async backupLocalData(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const localHistory = this.getLocalChatHistory();
      if (!localHistory) return true; // 没有数据需要备份

      const backup = {
        timestamp: new Date().toISOString(),
        device_id: cloudChatHistory.getDeviceId(),
        data: localHistory
      };

      localStorage.setItem('dify_chat_history_backup', JSON.stringify(backup));
      console.log('✅ 本地数据已备份到 dify_chat_history_backup');
      return true;
    } catch (error) {
      console.error('备份本地数据失败:', error);
      return false;
    }
  }

  /**
   * 清理localStorage数据（在成功迁移后）
   */
  async cleanupLocalData(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // 先备份
      await this.backupLocalData();
      
      // 清理主要的历史数据
      localStorage.removeItem('dify_chat_history');
      
      // 保留备份和迁移标记
      localStorage.setItem('dify_chat_migrated_to_cloud', new Date().toISOString());
      
      console.log('✅ 本地数据清理完成，已迁移到云端');
      return true;
    } catch (error) {
      console.error('清理本地数据失败:', error);
      return false;
    }
  }

  /**
   * 检查是否已经迁移过
   */
  hasMigratedToCloud(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dify_chat_migrated_to_cloud') !== null;
  }

  /**
   * 恢复本地数据（紧急情况下使用）
   */
  async restoreFromBackup(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const backup = localStorage.getItem('dify_chat_history_backup');
      if (!backup) {
        console.warn('没有找到备份数据');
        return false;
      }

      const backupData = JSON.parse(backup);
      localStorage.setItem('dify_chat_history', JSON.stringify(backupData.data));
      localStorage.removeItem('dify_chat_migrated_to_cloud');
      
      console.log('✅ 从备份恢复本地数据成功');
      return true;
    } catch (error) {
      console.error('恢复备份数据失败:', error);
      return false;
    }
  }

  /**
   * 获取迁移状态摘要
   */
  async getMigrationStatus(): Promise<{
    hasLocalData: boolean;
    hasMigrated: boolean;
    cloudConversationCount: number;
    localDataInfo: { conversationCount: number; totalMessages: number };
  }> {
    const localDataInfo = await this.checkForLocalData();
    const hasMigrated = this.hasMigratedToCloud();
    
    let cloudConversationCount = 0;
    try {
      const cloudConversations = await cloudChatHistory.getConversations();
      cloudConversationCount = cloudConversations.length;
    } catch (error) {
      console.warn('Failed to get cloud conversation count:', error);
    }

    return {
      hasLocalData: localDataInfo.hasLocalData,
      hasMigrated,
      cloudConversationCount,
      localDataInfo
    };
  }
}

// 导出单例实例
export const chatHistoryMigration = new ChatHistoryMigration();
export default chatHistoryMigration;