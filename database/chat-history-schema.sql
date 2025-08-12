-- 云端Chat History数据库表结构
-- 执行这个SQL在你的Supabase项目中创建所需的表

-- 1. 设备/用户标识表（用于匿名用户管理）
CREATE TABLE IF NOT EXISTS chat_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL, -- 客户端生成的设备唯一标识
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}' -- 存储设备信息、偏好设置等
);

-- 2. 对话表
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES chat_devices(device_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  dify_conversation_id TEXT, -- 关联Dify的对话ID
  message_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  workflow_state JSONB DEFAULT '{}', -- 存储工作流状态
  metadata JSONB DEFAULT '{}' -- 存储额外的对话元数据
);

-- 3. 消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id TEXT, -- Dify消息ID（如果有）
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  metadata JSONB DEFAULT '{}' -- 存储token使用、工作流信息等
);

-- 4. 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_chat_conversations_device_id ON chat_conversations(device_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_devices_device_id ON chat_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_chat_devices_last_active ON chat_devices(last_active DESC);

-- 5. 创建更新时间自动更新函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 6. 创建触发器自动更新updated_at字段
DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 创建RLS (Row Level Security) 策略
ALTER TABLE chat_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 删除旧的RLS策略
DROP POLICY IF EXISTS "Users can access their own device data" ON chat_devices;
DROP POLICY IF EXISTS "Users can access their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can access their own messages" ON chat_messages;

-- 临时策略：允许匿名用户访问所有数据（基于应用层device_id过滤）
-- 注意：这要求应用层确保正确的device_id过滤
CREATE POLICY "Allow anonymous access" ON chat_devices
    FOR ALL TO anon USING (true);

CREATE POLICY "Allow anonymous conversations" ON chat_conversations  
    FOR ALL TO anon USING (true);

CREATE POLICY "Allow anonymous messages" ON chat_messages
    FOR ALL TO anon USING (true);

-- 如果启用了认证用户，可以添加更严格的策略
-- CREATE POLICY "Authenticated users access own data" ON chat_devices
--     FOR ALL TO authenticated USING (device_id = current_setting('app.current_device_id', true));

-- 8. 创建用于会话管理的辅助函数
CREATE OR REPLACE FUNCTION set_config(setting_name text, setting_value text)
RETURNS void AS $$
BEGIN
    -- 设置会话级别的配置参数
    PERFORM set_config(setting_name, setting_value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予使用权限
GRANT EXECUTE ON FUNCTION set_config(text, text) TO anon, authenticated;

-- 9. 创建便捷的视图
CREATE OR REPLACE VIEW chat_conversation_summaries AS
SELECT 
    c.id,
    c.device_id,
    c.title,
    c.message_count,
    c.last_message,
    c.last_message_time,
    c.created_at,
    c.updated_at,
    c.workflow_state,
    d.user_agent,
    (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) as actual_message_count
FROM chat_conversations c
LEFT JOIN chat_devices d ON c.device_id = d.device_id
ORDER BY c.updated_at DESC;

-- 10. 插入说明注释
COMMENT ON TABLE chat_devices IS '设备标识表，用于匿名用户的设备识别';
COMMENT ON TABLE chat_conversations IS '对话表，存储聊天对话的基本信息';
COMMENT ON TABLE chat_messages IS '消息表，存储对话中的具体消息内容';
COMMENT ON VIEW chat_conversation_summaries IS '对话摘要视图，包含设备信息和消息统计';