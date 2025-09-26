// 一次性迁移localStorage数据到Supabase
import { VideoHistoryManager } from './videoHistory';
import { SupabaseVideoHistoryManager } from './supabaseVideoHistory';

export class DataMigration {
  private static migrationKey = 'video_history_migrated_to_supabase';

  // 检查是否需要迁移
  static needsMigration(): boolean {
    const migrated = localStorage.getItem(this.migrationKey);
    const localRecords = VideoHistoryManager.getHistory();
    
    return migrated !== 'true' && localRecords.length > 0;
  }

  // 执行迁移
  static async migrateToSupabase(): Promise<{
    success: boolean;
    migratedCount: number;
    totalCount: number;
    errors: string[];
  }> {
    const localRecords = VideoHistoryManager.getHistory();
    const errors: string[] = [];
    let migratedCount = 0;

    console.log(`🔄 开始迁移 ${localRecords.length} 条记录到Supabase...`);

    for (const record of localRecords) {
      try {
        const supabaseRecord = await SupabaseVideoHistoryManager.addRecord({
          videoUrl: record.videoUrl,
          imageUrl: record.imageUrl,
          productDescription: record.productDescription,
          characterGender: record.characterGender,
          duration: record.duration,
          title: record.title
        });

        if (supabaseRecord) {
          migratedCount++;
          console.log(`✅ 迁移成功: ${record.title}`);
        } else {
          errors.push(`迁移失败: ${record.title}`);
        }
      } catch (error) {
        const errorMsg = `迁移失败: ${record.title} - ${error.message}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }
    }

    // 如果大部分记录迁移成功，标记为已迁移
    const successRate = migratedCount / localRecords.length;
    if (successRate >= 0.8) { // 80%成功率
      localStorage.setItem(this.migrationKey, 'true');
      console.log(`✅ 迁移完成: ${migratedCount}/${localRecords.length} 条记录`);
    } else {
      console.log(`⚠️ 迁移成功率较低: ${migratedCount}/${localRecords.length} 条记录`);
    }

    return {
      success: successRate >= 0.8,
      migratedCount,
      totalCount: localRecords.length,
      errors
    };
  }

  // 清除迁移标记（用于重新迁移）
  static resetMigration(): void {
    localStorage.removeItem(this.migrationKey);
    console.log('🔄 迁移标记已重置');
  }
}