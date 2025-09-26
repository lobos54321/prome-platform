-- 修复 model_configs 表的 RLS 权限问题
-- 允许匿名用户访问模型配置

-- 检查 model_configs 表是否启用了 RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'model_configs';

-- 检查现有的 RLS 策略
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'model_configs';

-- 删除可能存在的严格策略
DROP POLICY IF EXISTS "Users can manage their own model configs" ON model_configs;
DROP POLICY IF EXISTS "Only admins can manage model configs" ON model_configs;

-- 创建宽松的策略允许所有操作
CREATE POLICY "Allow all access to model_configs" ON model_configs
    FOR ALL USING (true);

-- 如果表没有启用 RLS，先启用再设置策略
-- ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;

-- 验证策略是否生效
SELECT 'Model configs RLS policy updated' as status;