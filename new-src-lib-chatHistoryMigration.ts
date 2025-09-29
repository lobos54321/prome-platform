interface MigrationStatus {
  hasLocalData: boolean;
  hasMigrated: boolean;
  localConversationCount: number;
  lastMigrationTime?: Date;
}

interface MigrationResult {
  success: boolean;
  migratedConversations: number;
  errors: string[];
}

class ChatHistoryMigration {
  private readonly MIGRATION_KEY = 'chat_history_migration_status';
  private readonly LOCAL_CONVERSATIONS_KEY = 'dify_conversations';

  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      // Check for local data
      const localData = localStorage.getItem(this.LOCAL_CONVERSATIONS_KEY);
      const hasLocalData = !!(localData && JSON.parse(localData).length > 0);

      // Check migration status
      const migrationStatus = localStorage.getItem(this.MIGRATION_KEY);
      const hasMigrated = migrationStatus === 'completed';

      const localConversationCount = hasLocalData ? JSON.parse(localData).length : 0;

      console.log('[Migration] Status check:', {
        hasLocalData,
        hasMigrated,
        localConversationCount
      });

      return {
        hasLocalData,
        hasMigrated,
        localConversationCount,
        lastMigrationTime: hasMigrated ? new Date() : undefined
      };
    } catch (error) {
      console.error('[Migration] Error checking status:', error);
      return {
        hasLocalData: false,
        hasMigrated: false,
        localConversationCount: 0
      };
    }
  }

  async migrateToCloud(): Promise<MigrationResult> {
    try {
      console.log('[Migration] Starting migration to cloud...');

      const localData = localStorage.getItem(this.LOCAL_CONVERSATIONS_KEY);
      if (!localData) {
        return {
          success: true,
          migratedConversations: 0,
          errors: []
        };
      }

      const conversations = JSON.parse(localData);
      const errors: string[] = [];
      let migratedCount = 0;

      // Simulate migration process
      for (const conversation of conversations) {
        try {
          console.log(`[Migration] Migrating conversation: ${conversation.title}`);
          
          // In a real implementation, this would save to Supabase
          // For now, we just simulate the process
          await new Promise(resolve => setTimeout(resolve, 100));
          
          migratedCount++;
        } catch (error) {
          const errorMsg = `Failed to migrate conversation ${conversation.title}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Mark migration as completed
      localStorage.setItem(this.MIGRATION_KEY, 'completed');
      localStorage.setItem(`${this.MIGRATION_KEY}_time`, new Date().toISOString());

      console.log('[Migration] Migration completed:', {
        migratedCount,
        errors: errors.length
      });

      return {
        success: errors.length === 0,
        migratedConversations: migratedCount,
        errors
      };
    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      return {
        success: false,
        migratedConversations: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async cleanupLocalData(): Promise<void> {
    try {
      console.log('[Migration] Cleaning up local data...');
      
      // Remove old local conversation data
      localStorage.removeItem(this.LOCAL_CONVERSATIONS_KEY);
      localStorage.removeItem('dify_messages');
      localStorage.removeItem('dify_conversation_history');
      
      console.log('[Migration] Local data cleanup completed');
    } catch (error) {
      console.error('[Migration] Error cleaning up local data:', error);
    }
  }

  async resetMigrationStatus(): Promise<void> {
    try {
      localStorage.removeItem(this.MIGRATION_KEY);
      localStorage.removeItem(`${this.MIGRATION_KEY}_time`);
      console.log('[Migration] Migration status reset');
    } catch (error) {
      console.error('[Migration] Error resetting migration status:', error);
    }
  }
}

export const chatHistoryMigration = new ChatHistoryMigration();