-- ==================== Publish Tasks 表 ====================
-- 用于管理多平台发布任务
-- 在 Supabase SQL Editor 中执行此脚本

-- 创建 publish_tasks 表
CREATE TABLE IF NOT EXISTS publish_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content_id UUID,
    content_type VARCHAR(20) NOT NULL DEFAULT 'image_text',
    title TEXT NOT NULL,
    content TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    platform VARCHAR(20) NOT NULL,
    method VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    platform_post_id TEXT,
    published_url TEXT,
    skyvern_task_id TEXT,
    skyvern_run_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_publish_tasks_user_id ON publish_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_platform ON publish_tasks(platform);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_created_at ON publish_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_scheduled_at ON publish_tasks(scheduled_at);

-- 添加 updated_at 触发器
CREATE OR REPLACE FUNCTION update_publish_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_publish_tasks_updated_at ON publish_tasks;
CREATE TRIGGER trigger_update_publish_tasks_updated_at
    BEFORE UPDATE ON publish_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_publish_tasks_updated_at();

-- 添加 RLS 策略 (可选，根据需要启用)
-- ALTER TABLE publish_tasks ENABLE ROW LEVEL SECURITY;

-- 允许用户只能查看自己的任务
-- CREATE POLICY "Users can view own publish tasks"
--     ON publish_tasks FOR SELECT
--     USING (auth.uid() = user_id);

-- 允许用户创建自己的任务
-- CREATE POLICY "Users can create own publish tasks"
--     ON publish_tasks FOR INSERT
--     WITH CHECK (auth.uid() = user_id);

-- 允许用户更新自己的任务
-- CREATE POLICY "Users can update own publish tasks"
--     ON publish_tasks FOR UPDATE
--     USING (auth.uid() = user_id);

-- ==================== xhs_task_steps 表添加 platform 字段 ====================
-- 如果已有 xhs_task_steps 表，添加 platform 字段

ALTER TABLE xhs_task_steps
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'xiaohongshu';

-- 创建平台索引
CREATE INDEX IF NOT EXISTS idx_xhs_task_steps_platform ON xhs_task_steps(platform);

-- ==================== 验证 ====================
-- 检查表是否创建成功
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'publish_tasks'
ORDER BY ordinal_position;
