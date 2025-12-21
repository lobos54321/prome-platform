-- 添加数字人视频时长字段到 xhs_user_profiles 表
-- 执行此迁移以支持数字人视频时长配置功能

ALTER TABLE xhs_user_profiles 
ADD COLUMN IF NOT EXISTS avatar_video_duration INTEGER DEFAULT 150;

COMMENT ON COLUMN xhs_user_profiles.avatar_video_duration IS '数字人视频时长（秒），默认150秒(2.5分钟)，范围60-300秒';
