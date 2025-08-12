-- 更新RLS策略以修复403 Forbidden错误
-- 执行这个SQL脚本来修复云端聊天历史的权限问题

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

-- 可选：如果需要更严格的安全策略，可以启用以下策略并执行set_config函数
/*
CREATE OR REPLACE FUNCTION set_config(setting_name text, setting_value text)
RETURNS void AS $$
BEGIN
    PERFORM set_config(setting_name, setting_value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION set_config(text, text) TO anon, authenticated;

-- 更严格的策略（需要先创建上面的函数）
DROP POLICY "Allow anonymous access" ON chat_devices;
DROP POLICY "Allow anonymous conversations" ON chat_conversations;
DROP POLICY "Allow anonymous messages" ON chat_messages;

CREATE POLICY "Users can access their own device data" ON chat_devices
    FOR ALL USING (device_id = current_setting('app.current_device_id', true));

CREATE POLICY "Users can access their own conversations" ON chat_conversations
    FOR ALL USING (device_id = current_setting('app.current_device_id', true));

CREATE POLICY "Users can access their own messages" ON chat_messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM chat_conversations 
            WHERE device_id = current_setting('app.current_device_id', true)
        )
    );
*/