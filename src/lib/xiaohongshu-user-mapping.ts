// ============================================
// 用户ID映射服务
// ============================================

import { xiaohongshuSupabase } from './xiaohongshu-supabase';

/**
 * 用户映射服务
 * 负责 Supabase UUID 与 xhs_user_id 的转换
 */
export class UserMappingService {
  
  /**
   * 生成小红书用户ID
   * 格式：user_{前14位UUID}_prome
   * 注意：使用14位是为了与后端历史数据保持一致
   */
  private generateXhsUserId(supabaseUuid: string): string {
    const cleanId = supabaseUuid.replace(/-/g, '').substring(0, 14);
    return `user_${cleanId}_prome`;
  }

  /**
   * 获取或创建用户映射
   * 如果不存在则自动创建
   */
  async getOrCreateMapping(supabaseUuid: string): Promise<string> {
    console.log('🔍 [UserMapping] 开始获取或创建映射, UUID:', supabaseUuid);

    try {
      // 1. 尝试从数据库获取
      console.log('🔍 [UserMapping] 检查数据库中是否已存在映射...');
      const existing = await xiaohongshuSupabase.getUserMapping(supabaseUuid);

      if (existing) {
        console.log('✅ [UserMapping] 找到现有映射:', existing.xhs_user_id);
        return existing.xhs_user_id;
      }

      console.log('⚠️ [UserMapping] 未找到现有映射，准备创建新映射');

      // 2. 生成新的映射
      const xhsUserId = this.generateXhsUserId(supabaseUuid);
      console.log('🔑 [UserMapping] 生成的xhs_user_id:', xhsUserId);

      // 3. 保存到数据库
      console.log('💾 [UserMapping] 准备保存映射到数据库...');
      await xiaohongshuSupabase.createUserMapping({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId
      });
      console.log('✅ [UserMapping] 映射已成功保存到数据库');

      return xhsUserId;
    } catch (error) {
      console.error('❌ [UserMapping] 获取或创建映射时出错:', error);
      throw error;
    }
  }

  /**
   * 验证映射是否存在
   */
  async validateMapping(supabaseUuid: string): Promise<boolean> {
    try {
      const mapping = await xiaohongshuSupabase.getUserMapping(supabaseUuid);
      return mapping !== null;
    } catch (error) {
      console.error('Error validating mapping:', error);
      return false;
    }
  }
}

// 导出单例
export const userMappingService = new UserMappingService();
