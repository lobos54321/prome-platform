-- 为 chat_conversations 表添加 user_id 列以支持用户数据隔离
-- 执行日期: 2025-10-03

-- 1. 检查并添加 user_id 列
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_conversations' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chat_conversations ADD COLUMN user_id UUID;
        RAISE NOTICE 'user_id column added to chat_conversations';
    ELSE
        RAISE NOTICE 'user_id column already exists in chat_conversations';
    END IF;
END $$;

-- 2. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id 
ON chat_conversations(user_id);

-- 3. 创建外键约束（可选，如果有 users 表）
-- ALTER TABLE chat_conversations 
-- ADD CONSTRAINT fk_chat_conversations_user_id 
-- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. 添加注释
COMMENT ON COLUMN chat_conversations.user_id IS 'User ID for authenticated conversations (NULL for anonymous)';

-- 5. 验证结果
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
AND column_name IN ('user_id', 'device_id')
ORDER BY column_name;

-- 6. 显示表结构
SELECT 
    'chat_conversations' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(device_id) as records_with_device_id
FROM chat_conversations;
