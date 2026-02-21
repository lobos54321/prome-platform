// ============================================
// Supabase 数据库操作服务
// ============================================

import { supabase } from './supabase';
import type {
  UserMapping,
  UserProfile,
  GlobalProductProfile,
  ProductMaterial,
  AutomationStatus,
  ContentStrategy,
  WeeklyPlan,
  ActivityLog
} from '@/types/xiaohongshu';

/**
 * Supabase 数据库服务
 */
export class XiaohongshuSupabaseService {

  // ============================================
  // 用户映射管理
  // ============================================

  async getUserMapping(supabaseUuid: string): Promise<UserMapping | null> {
    console.log('🔍 [Supabase] 查询用户映射, UUID:', supabaseUuid);

    const { data, error } = await supabase
      .from('xhs_user_mapping')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [Supabase] 查询用户映射失败:', error);
      throw new Error('Failed to fetch user mapping');
    }

    if (error?.code === 'PGRST116') {
      console.log('⚠️ [Supabase] 未找到用户映射 (PGRST116 - No rows)');
    } else if (data) {
      console.log('✅ [Supabase] 找到用户映射:', data);
    }

    return data;
  }

  async createUserMapping(mapping: Omit<UserMapping, 'created_at' | 'updated_at'>): Promise<void> {
    console.log('💾 [Supabase] 准备插入用户映射:', mapping);

    const { data, error } = await supabase
      .from('xhs_user_mapping')
      .insert(mapping)
      .select();

    if (error) {
      console.error('❌ [Supabase] 插入用户映射失败:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to create user mapping: ${error.message}`);
    }

    console.log('✅ [Supabase] 用户映射插入成功:', data);
  }

  // ============================================
  // 用户配置管理
  // ============================================

  async getUserProfile(supabaseUuid: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('xhs_user_profiles')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }

    return data;
  }

  async saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase
      .from('xhs_user_profiles')
      .upsert(profile, {
        onConflict: 'supabase_uuid'
      });

    if (error) {
      console.error('Error saving user profile:', error);
      throw new Error('Failed to save user profile');
    }
  }

  // ============================================
  // 全局产品配置管理 (Global Product Profile)
  // ============================================

  async getGlobalProductProfile(supabaseUuid: string): Promise<GlobalProductProfile | null> {
    const { data, error } = await supabase
      .from('global_product_profiles')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching global product profile:', error);
      throw new Error('Failed to fetch global product profile');
    }

    return data;
  }

  async saveGlobalProductProfile(profile: Partial<GlobalProductProfile>): Promise<void> {
    const { error } = await supabase
      .from('global_product_profiles')
      .upsert(profile, {
        onConflict: 'supabase_uuid'
      });

    if (error) {
      console.error('Error saving global product profile:', error);
      throw new Error('Failed to save global product profile');
    }
  }

  // ============================================
  // 产品素材管理 (每个图片/文档独立存储)
  // ============================================

  async getProductMaterials(supabaseUuid: string): Promise<ProductMaterial[]> {
    const { data, error } = await supabase
      .from('product_materials')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching product materials:', error);
      return [];
    }
    return data || [];
  }

  async addProductMaterial(material: Omit<ProductMaterial, 'id' | 'uploaded_at'>): Promise<ProductMaterial | null> {
    const { data, error } = await supabase
      .from('product_materials')
      .upsert({
        ...material,
        uploaded_at: new Date().toISOString()
      }, {
        onConflict: 'supabase_uuid,file_url'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding product material:', error);
      return null;
    }
    return data;
  }

  async updateMaterialAnalysis(
    supabaseUuid: string,
    fileUrl: string,
    analysis: { ai_description: string; ai_tags?: string[]; ai_category?: string }
  ): Promise<void> {
    const { error } = await supabase
      .from('product_materials')
      .update({
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
        ai_category: analysis.ai_category,
        analyzed_at: new Date().toISOString()
      })
      .eq('supabase_uuid', supabaseUuid)
      .eq('file_url', fileUrl);

    if (error) {
      console.error('Error updating material analysis:', error);
      throw new Error('Failed to update material analysis');
    }
  }

  async deleteProductMaterial(supabaseUuid: string, fileUrl: string): Promise<void> {
    const { error } = await supabase
      .from('product_materials')
      .delete()
      .eq('supabase_uuid', supabaseUuid)
      .eq('file_url', fileUrl);

    if (error) {
      console.error('Error deleting product material:', error);
      throw new Error('Failed to delete product material');
    }
  }

  // 获取素材摘要 (用于传入 AI context)
  async getMaterialsSummary(supabaseUuid: string): Promise<string> {
    const materials = await this.getProductMaterials(supabaseUuid);

    if (materials.length === 0) {
      return '暂无产品素材';
    }

    const images = materials.filter(m => m.file_type === 'image');
    const documents = materials.filter(m => m.file_type === 'document');

    let summary = `## 产品素材概览\n\n`;

    if (images.length > 0) {
      summary += `### 图片素材 (${images.length}张)\n`;
      images.forEach((img, i) => {
        summary += `${i + 1}. ${img.file_name || '图片'}: ${img.ai_description || '未分析'}\n`;
        if (img.ai_tags?.length) {
          summary += `   标签: ${img.ai_tags.join(', ')}\n`;
        }
      });
      summary += '\n';
    }

    if (documents.length > 0) {
      summary += `### 文档素材 (${documents.length}个)\n`;
      documents.forEach((doc, i) => {
        summary += `${i + 1}. ${doc.file_name || '文档'}: ${doc.ai_description || '未分析'}\n`;
      });
    }

    return summary;
  }

  // ============================================
  // 自动化状态管理
  // ============================================

  async getAutomationStatus(supabaseUuid: string): Promise<AutomationStatus | null> {
    const { data, error } = await supabase
      .from('xhs_automation_status')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching automation status:', error);
      throw new Error('Failed to fetch automation status');
    }

    return data;
  }

  async saveAutomationStatus(status: Partial<AutomationStatus>): Promise<void> {
    const { error } = await supabase
      .from('xhs_automation_status')
      .upsert(status, {
        onConflict: 'supabase_uuid'
      });

    if (error) {
      console.error('Error saving automation status:', error);
      throw new Error('Failed to save automation status');
    }
  }

  // ============================================
  // 内容策略管理
  // ============================================

  async getContentStrategy(supabaseUuid: string): Promise<ContentStrategy | null> {
    const { data, error } = await supabase
      .from('xhs_content_strategies')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching content strategy:', error);
      throw new Error('Failed to fetch content strategy');
    }

    return data && data.length > 0 ? data[0] : null;
  }

  async saveContentStrategy(strategy: Partial<ContentStrategy>): Promise<void> {
    const { error } = await supabase
      .from('xhs_content_strategies')
      .insert(strategy);

    if (error) {
      console.error('Error saving content strategy:', error);
      throw new Error('Failed to save content strategy');
    }
  }

  // ============================================
  // 周计划管理
  // ============================================

  async getWeeklyPlan(supabaseUuid: string, weekStartDate: string): Promise<WeeklyPlan | null> {
    const { data, error } = await supabase
      .from('xhs_weekly_plans')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .eq('week_start_date', weekStartDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching weekly plan:', error);
      throw new Error('Failed to fetch weekly plan');
    }

    return data;
  }

  async getCurrentWeekPlan(supabaseUuid: string): Promise<WeeklyPlan | null> {
    const { data, error } = await supabase
      .from('xhs_weekly_plans')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .order('week_start_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching current week plan:', error);
      throw new Error('Failed to fetch current week plan');
    }

    return data && data.length > 0 ? data[0] : null;
  }

  async saveWeeklyPlan(plan: Partial<WeeklyPlan>): Promise<void> {
    const { error } = await supabase
      .from('xhs_weekly_plans')
      .upsert(plan, {
        onConflict: 'supabase_uuid,week_start_date'
      });

    if (error) {
      console.error('Error saving weekly plan:', error);
      throw new Error('Failed to save weekly plan');
    }
  }

  // ============================================
  // 活动日志管理
  // ============================================

  async addActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('xhs_activity_logs')
      .insert(log);

    if (error) {
      console.error('Error adding activity log:', error);
      throw new Error('Failed to add activity log');
    }
  }

  async getActivityLogs(supabaseUuid: string, limit: number = 50): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('xhs_activity_logs')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activity logs:', error);
      throw new Error('Failed to fetch activity logs');
    }

    return data || [];
  }

  // ============================================
  // 数据清除
  // ============================================

  async clearUserData(supabaseUuid: string, clearMapping: boolean = true): Promise<void> {
    try {
      // 清除自动化状态
      await supabase
        .from('xhs_automation_status')
        .delete()
        .eq('supabase_uuid', supabaseUuid);

      // 清除内容策略
      await supabase
        .from('xhs_content_strategies')
        .delete()
        .eq('supabase_uuid', supabaseUuid);

      // 清除周计划
      await supabase
        .from('xhs_weekly_plans')
        .delete()
        .eq('supabase_uuid', supabaseUuid);

      // 清除活动日志
      await supabase
        .from('xhs_activity_logs')
        .delete()
        .eq('supabase_uuid', supabaseUuid);

      // 清除用户配置
      await supabase
        .from('xhs_user_profiles')
        .delete()
        .eq('supabase_uuid', supabaseUuid);

      // 清除用户映射（完全退出时）
      if (clearMapping) {
        await supabase
          .from('xhs_user_mapping')
          .delete()
          .eq('supabase_uuid', supabaseUuid);
      }

      // 清除保存的 cookies（如果有这个表）
      try {
        await supabase
          .from('xhs_cookies')
          .delete()
          .eq('supabase_uuid', supabaseUuid);
      } catch (e) {
        // 表可能不存在，忽略错误
        console.log('xhs_cookies table might not exist, skipping...');
      }

      console.log('✅ User data cleared successfully (including mapping and profiles)');
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw new Error('Failed to clear user data');
    }
  }

  // ============================================
  // Cookie 存储管理
  // ============================================

  /**
   * 保存登录 cookies 到数据库
   */
  async saveCookies(supabaseUuid: string, xhsUserId: string, cookies: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from('xhs_cookies')
      .upsert({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
        cookies: cookies,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'supabase_uuid'
      });

    if (error) {
      console.error('Error saving cookies:', error);
      // 不抛出错误，因为表可能不存在
    }
  }

  /**
   * 获取保存的 cookies
   */
  async getCookies(supabaseUuid: string): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await supabase
        .from('xhs_cookies')
        .select('cookies')
        .eq('supabase_uuid', supabaseUuid)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching cookies:', error);
        return null;
      }

      return data?.cookies || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 清除保存的 cookies
   */
  async clearCookies(supabaseUuid: string): Promise<void> {
    try {
      await supabase
        .from('xhs_cookies')
        .delete()
        .eq('supabase_uuid', supabaseUuid);
    } catch (e) {
      // 表可能不存在，忽略
    }
  }
}

// 导出单例
export const xiaohongshuSupabase = new XiaohongshuSupabaseService();
