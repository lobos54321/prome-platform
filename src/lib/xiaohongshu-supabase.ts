// ============================================
// Supabase 数据库操作服务
// ============================================

import { supabase } from './supabase';
import type { 
  UserMapping, 
  UserProfile, 
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
    const { data, error } = await supabase
      .from('xhs_user_mapping')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user mapping:', error);
      throw new Error('Failed to fetch user mapping');
    }

    return data;
  }

  async createUserMapping(mapping: Omit<UserMapping, 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase
      .from('xhs_user_mapping')
      .insert(mapping);

    if (error) {
      console.error('Error creating user mapping:', error);
      throw new Error('Failed to create user mapping');
    }
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
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching content strategy:', error);
      throw new Error('Failed to fetch content strategy');
    }

    return data;
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
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching current week plan:', error);
      throw new Error('Failed to fetch current week plan');
    }

    return data;
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

  async clearUserData(supabaseUuid: string): Promise<void> {
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

      console.log('✅ User data cleared successfully');
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw new Error('Failed to clear user data');
    }
  }
}

// 导出单例
export const xiaohongshuSupabase = new XiaohongshuSupabaseService();
