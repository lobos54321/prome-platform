// Xiaohongshu Database Service Layer
// Handles all database operations for Xiaohongshu automation system

import { supabase } from './supabase';

export interface XHSUserMapping {
  supabase_uuid: string;
  xhs_user_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface XHSUserProfile {
  id?: string;
  supabase_uuid: string;
  xhs_user_id: string;
  product_name: string;
  target_audience?: string;
  marketing_goal?: string;
  post_frequency?: string;
  brand_style?: string;
  review_mode?: string;
  created_at?: string;
  updated_at?: string;
}

export interface XHSAutomationStatus {
  supabase_uuid: string;
  xhs_user_id: string;
  is_running?: boolean;
  is_logged_in?: boolean;
  has_config?: boolean;
  last_activity?: string;
  uptime_seconds?: number;
  next_scheduled_task?: string;
  created_at?: string;
  updated_at?: string;
}

export interface XHSActivityLog {
  id?: string;
  supabase_uuid: string;
  xhs_user_id: string;
  activity_type: string;
  message: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

class XiaohongshuDatabaseService {
  /**
   * Get or create user mapping between Supabase UUID and XHS user ID
   */
  async getOrCreateUserMapping(supabaseUuid: string, xhsUserId: string): Promise<XHSUserMapping> {
    // Try to get existing mapping
    const { data: existing, error: fetchError } = await supabase
      .from('xhs_user_mapping')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (existing && !fetchError) {
      return existing;
    }

    // Create new mapping
    const { data, error } = await supabase
      .from('xhs_user_mapping')
      .insert({
        supabase_uuid: supabaseUuid,
        xhs_user_id: xhsUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user mapping:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get user profile by Supabase UUID
   */
  async getUserProfile(supabaseUuid: string): Promise<XHSUserProfile | null> {
    const { data, error } = await supabase
      .from('xhs_user_profiles')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create or update user profile
   */
  async upsertUserProfile(profile: XHSUserProfile): Promise<XHSUserProfile> {
    const { data, error } = await supabase
      .from('xhs_user_profiles')
      .upsert(profile, {
        onConflict: 'supabase_uuid',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting user profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get automation status for user
   */
  async getAutomationStatus(supabaseUuid: string): Promise<XHSAutomationStatus | null> {
    const { data, error } = await supabase
      .from('xhs_automation_status')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching automation status:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update automation status
   */
  async upsertAutomationStatus(status: XHSAutomationStatus): Promise<XHSAutomationStatus> {
    const { data, error } = await supabase
      .from('xhs_automation_status')
      .upsert(status, {
        onConflict: 'supabase_uuid',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting automation status:', error);
      throw error;
    }

    return data;
  }

  /**
   * Log activity
   */
  async logActivity(log: XHSActivityLog): Promise<void> {
    const { error } = await supabase
      .from('xhs_activity_logs')
      .insert(log);

    if (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(supabaseUuid: string, limit = 20): Promise<XHSActivityLog[]> {
    const { data, error } = await supabase
      .from('xhs_activity_logs')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get daily tasks
   */
  async getDailyTasks(supabaseUuid: string, date?: Date): Promise<any[]> {
    let query = supabase
      .from('xhs_daily_tasks')
      .select('*')
      .eq('supabase_uuid', supabaseUuid);

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('scheduled_time', startOfDay.toISOString())
        .lte('scheduled_time', endOfDay.toISOString());
    }

    const { data, error } = await query.order('scheduled_time', { ascending: true });

    if (error) {
      console.error('Error fetching daily tasks:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get weekly plan
   */
  async getWeeklyPlan(supabaseUuid: string, weekStartDate: Date): Promise<any | null> {
    const { data, error } = await supabase
      .from('xhs_weekly_plans')
      .select('*')
      .eq('supabase_uuid', supabaseUuid)
      .eq('week_start_date', weekStartDate.toISOString().split('T')[0])
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching weekly plan:', error);
      throw error;
    }

    return data;
  }
}

// Export singleton instance
export const xiaohongshuDb = new XiaohongshuDatabaseService();
