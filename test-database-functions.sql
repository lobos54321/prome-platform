-- =====================================================
-- Test Database Functions
-- 验证新创建的视频积分系统函数
-- 在Supabase SQL编辑器中运行这些测试
-- =====================================================

-- 测试1: 检查表是否创建成功
SELECT 'Testing table creation...' AS test_status;
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_name = 'video_generations';

-- 测试2: 检查函数是否创建成功
SELECT 'Testing function creation...' AS test_status;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'check_user_credits_for_video', 
    'reserve_credits_for_video', 
    'complete_video_generation'
);

-- 测试3: 测试用户积分检查函数
-- 注意：替换 'your-real-user-id' 为您的实际用户ID
SELECT 'Testing credit check function...' AS test_status;
SELECT public.check_user_credits_for_video(
    'your-real-user-id'::UUID,  -- 替换为真实的用户ID
    1764  -- 8秒视频的积分成本
) AS has_enough_credits;

-- 测试4: 查看现有用户余额（用于验证）
SELECT 'Current user balances...' AS test_status;
SELECT 
    id,
    email,
    balance,
    created_at
FROM public.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 测试5: 检查video_generations表结构
SELECT 'Video generations table structure...' AS test_status;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'video_generations'
ORDER BY ordinal_position;

-- 测试6: 检查索引是否创建
SELECT 'Testing indexes...' AS test_status;
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'video_generations';

-- 测试7: 检查RLS策略
SELECT 'Testing RLS policies...' AS test_status;
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'video_generations';

-- 最终状态总结
SELECT 'Migration verification complete!' AS final_status;
SELECT 
    'Tables: ' || COUNT(CASE WHEN table_name = 'video_generations' THEN 1 END) ||
    ', Functions: ' || (
        SELECT COUNT(*) 
        FROM information_schema.routines 
        WHERE routine_name IN ('check_user_credits_for_video', 'reserve_credits_for_video', 'complete_video_generation')
    ) AS summary
FROM information_schema.tables;