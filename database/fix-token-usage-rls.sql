-- 修复 token_usage 和 billing_records 表的 RLS 权限问题
-- 允许系统插入新的token使用记录和账单记录

-- 检查现有的 RLS 策略
SELECT 'Current token_usage policies:' as info;
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'token_usage';

SELECT 'Current billing_records policies:' as info;
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'billing_records';

-- 为 token_usage 表添加 INSERT 权限
CREATE POLICY "Allow system to insert token usage" ON public.token_usage
    FOR INSERT WITH CHECK (true);

-- 为 billing_records 表添加 INSERT 权限  
CREATE POLICY "Allow system to insert billing records" ON public.billing_records
    FOR INSERT WITH CHECK (true);

-- 验证策略是否生效
SELECT 'Token usage and billing records RLS policies updated' as status;

-- 显示所有相关表的策略
SELECT 'Final token_usage policies:' as info;
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('token_usage', 'billing_records');