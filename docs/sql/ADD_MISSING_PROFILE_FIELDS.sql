-- =============================================
-- Supabase Migration: Missing Profile Fields
-- =============================================
--
-- 此迁移添加缺失的 xhs_user_profiles 字段
-- 修复 400 Bad Request 错误
--
-- 运行方式：在 Supabase SQL Editor 中执行
-- =============================================

-- 1. 添加缺失字段到 xhs_user_profiles
ALTER TABLE xhs_user_profiles
ADD COLUMN IF NOT EXISTS avatar_video_duration INTEGER DEFAULT 150,
ADD COLUMN IF NOT EXISTS ugc_age_range TEXT DEFAULT 'young',
ADD COLUMN IF NOT EXISTS target_platforms TEXT[] DEFAULT ARRAY['xiaohongshu']::TEXT[];

-- 2. 添加列注释
COMMENT ON COLUMN xhs_user_profiles.avatar_video_duration IS '数字人视频时长（秒），默认150秒(2.5分钟)';
COMMENT ON COLUMN xhs_user_profiles.ugc_age_range IS 'UGC 视频角色年龄段: young, middle, senior';
COMMENT ON COLUMN xhs_user_profiles.target_platforms IS '目标发布平台: xiaohongshu, x, tiktok, instagram, youtube';

-- =============================================
-- 完成
-- =============================================
SELECT 'Migration completed: Added avatar_video_duration, ugc_age_range, target_platforms columns' AS status;
