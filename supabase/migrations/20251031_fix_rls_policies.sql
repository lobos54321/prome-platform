-- ============================================
-- 修复 RLS 策略 - 添加所有必需的操作权限
-- ============================================

-- xhs_user_mapping - 完整权限
DROP POLICY IF EXISTS "xhs_user_mapping_select" ON xhs_user_mapping;
DROP POLICY IF EXISTS "xhs_user_mapping_insert" ON xhs_user_mapping;
DROP POLICY IF EXISTS "xhs_user_mapping_update" ON xhs_user_mapping;
DROP POLICY IF EXISTS "xhs_user_mapping_all" ON xhs_user_mapping;

CREATE POLICY "xhs_user_mapping_all" ON xhs_user_mapping
    FOR ALL USING (supabase_uuid = auth.uid());

-- xhs_user_profiles - 完整权限
DROP POLICY IF EXISTS "xhs_user_profiles_select" ON xhs_user_profiles;
DROP POLICY IF EXISTS "xhs_user_profiles_insert" ON xhs_user_profiles;
DROP POLICY IF EXISTS "xhs_user_profiles_update" ON xhs_user_profiles;
DROP POLICY IF EXISTS "xhs_user_profiles_all" ON xhs_user_profiles;

CREATE POLICY "xhs_user_profiles_all" ON xhs_user_profiles
    FOR ALL USING (supabase_uuid = auth.uid());

-- xhs_content_strategies - 完整权限
DROP POLICY IF EXISTS "xhs_content_strategies_select" ON xhs_content_strategies;
DROP POLICY IF EXISTS "xhs_content_strategies_insert" ON xhs_content_strategies;
DROP POLICY IF EXISTS "xhs_content_strategies_update" ON xhs_content_strategies;
DROP POLICY IF EXISTS "xhs_content_strategies_all" ON xhs_content_strategies;

CREATE POLICY "xhs_content_strategies_all" ON xhs_content_strategies
    FOR ALL USING (supabase_uuid = auth.uid());

-- xhs_daily_tasks - 完整权限
DROP POLICY IF EXISTS "xhs_daily_tasks_select" ON xhs_daily_tasks;
DROP POLICY IF EXISTS "xhs_daily_tasks_insert" ON xhs_daily_tasks;
DROP POLICY IF EXISTS "xhs_daily_tasks_update" ON xhs_daily_tasks;
DROP POLICY IF EXISTS "xhs_daily_tasks_delete" ON xhs_daily_tasks;
DROP POLICY IF EXISTS "xhs_daily_tasks_all" ON xhs_daily_tasks;

CREATE POLICY "xhs_daily_tasks_all" ON xhs_daily_tasks
    FOR ALL USING (supabase_uuid = auth.uid());

-- xhs_weekly_plans - 完整权限
DROP POLICY IF EXISTS "xhs_weekly_plans_select" ON xhs_weekly_plans;
DROP POLICY IF EXISTS "xhs_weekly_plans_insert" ON xhs_weekly_plans;
DROP POLICY IF EXISTS "xhs_weekly_plans_update" ON xhs_weekly_plans;
DROP POLICY IF EXISTS "xhs_weekly_plans_all" ON xhs_weekly_plans;

CREATE POLICY "xhs_weekly_plans_all" ON xhs_weekly_plans
    FOR ALL USING (supabase_uuid = auth.uid());

-- xhs_activity_logs - 完整权限
DROP POLICY IF EXISTS "xhs_activity_logs_select" ON xhs_activity_logs;
DROP POLICY IF EXISTS "xhs_activity_logs_insert" ON xhs_activity_logs;
DROP POLICY IF EXISTS "xhs_activity_logs_all" ON xhs_activity_logs;

CREATE POLICY "xhs_activity_logs_all" ON xhs_activity_logs
    FOR ALL USING (supabase_uuid = auth.uid());

-- xhs_automation_status - 完整权限
DROP POLICY IF EXISTS "xhs_automation_status_select" ON xhs_automation_status;
DROP POLICY IF EXISTS "xhs_automation_status_insert" ON xhs_automation_status;
DROP POLICY IF EXISTS "xhs_automation_status_update" ON xhs_automation_status;
DROP POLICY IF EXISTS "xhs_automation_status_all" ON xhs_automation_status;

CREATE POLICY "xhs_automation_status_all" ON xhs_automation_status
    FOR ALL USING (supabase_uuid = auth.uid());

-- 验证策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename LIKE 'xhs_%'
ORDER BY tablename, policyname;
