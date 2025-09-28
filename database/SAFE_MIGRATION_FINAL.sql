-- ✅ 安全的数据库迁移脚本
-- 目的：为 chat_conversations 表添加 user_id 列，修复对话记录无法保存的问题
-- 日期：2025-09-27

-- 第一步：检查当前表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
ORDER BY ordinal_position;

-- 第二步：添加 user_id 列（如果不存在）
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 第三步：创建外键约束（如果 users 表存在）
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE chat_conversations 
        ADD CONSTRAINT fk_chat_conversations_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 第四步：创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id 
ON chat_conversations(user_id);

-- 第五步：添加注释
COMMENT ON COLUMN chat_conversations.user_id IS 'User ID for authenticated conversations (NULL for anonymous)';

-- 第六步：验证迁移结果
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
AND column_name = 'user_id';