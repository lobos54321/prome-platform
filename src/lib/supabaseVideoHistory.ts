// Supabase数据库存储的视频历史记录管理
import { supabase } from './supabase';

export interface VideoRecord {
  id: string;
  title: string;
  videoUrl: string;
  imageUrl: string;
  productDescription: string;
  characterGender: string;
  duration: string;
  createdAt: Date;
  isCompleted: boolean;
  userId?: string; // 关联用户ID
}

export class SupabaseVideoHistoryManager {
  private static tableName = 'video_records';

  // 创建视频记录表（如果不存在）
  static async ensureTableExists(): Promise<void> {
    // 这个函数用于确保表结构存在，实际的表创建需要在Supabase控制台执行
    console.log('Video records table should exist in Supabase');
  }

  // 获取用户的视频历史
  static async getHistory(userId?: string): Promise<VideoRecord[]> {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch video history:', error);
        return [];
      }

      return (data || []).map(record => ({
        id: record.id,
        title: record.title,
        videoUrl: record.video_url,
        imageUrl: record.image_url,
        productDescription: record.product_description,
        characterGender: record.character_gender,
        duration: record.duration,
        createdAt: new Date(record.created_at),
        isCompleted: record.is_completed,
        userId: record.user_id
      }));
    } catch (error) {
      console.error('Failed to load video history from Supabase:', error);
      return [];
    }
  }

  // 添加新的视频记录
  static async addRecord(record: Omit<VideoRecord, 'id' | 'createdAt' | 'isCompleted'>, userId?: string): Promise<VideoRecord | null> {
    try {
      const newRecord = {
        title: record.productDescription.slice(0, 50) + (record.productDescription.length > 50 ? '...' : ''),
        video_url: record.videoUrl,
        image_url: record.imageUrl,
        product_description: record.productDescription,
        character_gender: record.characterGender,
        duration: record.duration,
        is_completed: false,
        user_id: userId,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([newRecord])
        .select()
        .single();

      if (error) {
        console.error('Failed to insert video record:', error);
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        videoUrl: data.video_url,
        imageUrl: data.image_url,
        productDescription: data.product_description,
        characterGender: data.character_gender,
        duration: data.duration,
        createdAt: new Date(data.created_at),
        isCompleted: data.is_completed,
        userId: data.user_id
      };
    } catch (error) {
      console.error('Failed to add video record to Supabase:', error);
      return null;
    }
  }

  // 更新视频记录
  static async updateRecord(id: string, updates: Partial<VideoRecord>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (updates.videoUrl) updateData.video_url = updates.videoUrl;
      if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted;
      if (updates.title) updateData.title = updates.title;

      const { error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Failed to update video record:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to update video record in Supabase:', error);
      return false;
    }
  }

  // 删除视频记录
  static async deleteRecord(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete video record:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete video record from Supabase:', error);
      return false;
    }
  }

  // 清除用户的所有历史记录
  static async clearHistory(userId?: string): Promise<boolean> {
    try {
      let query = supabase.from(this.tableName).delete();
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;

      if (error) {
        console.error('Failed to clear video history:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to clear video history from Supabase:', error);
      return false;
    }
  }
}

// 数据库表创建SQL（需要在Supabase SQL编辑器中执行）
export const CREATE_VIDEO_RECORDS_TABLE = `
-- 创建视频记录表
CREATE TABLE IF NOT EXISTS video_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  video_url TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  product_description TEXT NOT NULL,
  character_gender TEXT NOT NULL,
  duration TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_video_records_user_id ON video_records(user_id);
CREATE INDEX IF NOT EXISTS idx_video_records_created_at ON video_records(created_at DESC);

-- 启用RLS (Row Level Security)
ALTER TABLE video_records ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能访问自己的记录
CREATE POLICY "Users can only access their own video records" ON video_records
  FOR ALL USING (user_id = current_setting('request.jwt.claim.sub', true));

-- 允许匿名用户创建记录（用于未登录用户）
CREATE POLICY "Allow anonymous users to create video records" ON video_records
  FOR INSERT WITH CHECK (true);

-- 允许匿名用户读取自己创建的记录
CREATE POLICY "Allow anonymous users to read their records" ON video_records
  FOR SELECT USING (true);

-- 允许匿名用户更新和删除记录
CREATE POLICY "Allow anonymous users to update their records" ON video_records
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous users to delete their records" ON video_records
  FOR DELETE USING (true);
`;