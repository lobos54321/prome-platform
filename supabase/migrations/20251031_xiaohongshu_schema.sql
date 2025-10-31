-- ============================================
-- 小红书自动化系统数据库 Schema (终极修复版)
-- ============================================

-- 确保 UUID 扩展可用
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 创建表
-- ============================================

-- 1. 用户ID映射表
DROP TABLE IF EXISTS xhs_user_mapping CASCADE;
CREATE TABLE xhs_user_mapping (
  supabase_uuid UUID PRIMARY KEY,
  xhs_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户配置表
DROP TABLE IF EXISTS xhs_user_profiles CASCADE;
CREATE TABLE xhs_user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  target_audience TEXT,
  marketing_goal TEXT DEFAULT 'brand',
  post_frequency TEXT DEFAULT 'daily',
  brand_style TEXT DEFAULT 'warm',
  review_mode TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supabase_uuid)
);

-- 3. 内容策略表
DROP TABLE IF EXISTS xhs_content_strategies CASCADE;
CREATE TABLE xhs_content_strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL,
  key_themes JSONB DEFAULT '[]',
  trending_topics JSONB DEFAULT '[]',
  hashtags JSONB DEFAULT '[]',
  optimal_times JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 每日任务表
DROP TABLE IF EXISTS xhs_daily_tasks CASCADE;
CREATE TABLE xhs_daily_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  title TEXT,
  content TEXT,
  scheduled_time TIMESTAMPTZ,
  status TEXT DEFAULT 'planned',
  image_urls JSONB DEFAULT '[]',
  cover_image_url TEXT,
  post_url TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 周计划表
DROP TABLE IF EXISTS xhs_weekly_plans CASCADE;
CREATE TABLE xhs_weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  plan_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supabase_uuid, week_start_date)
);

-- 6. 活动日志表
DROP TABLE IF EXISTS xhs_activity_logs CASCADE;
CREATE TABLE xhs_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 自动化状态表
DROP TABLE IF EXISTS xhs_automation_status CASCADE;
CREATE TABLE xhs_automation_status (
  supabase_uuid UUID PRIMARY KEY,
  xhs_user_id TEXT NOT NULL UNIQUE,
  is_running BOOLEAN DEFAULT false,
  is_logged_in BOOLEAN DEFAULT false,
  has_config BOOLEAN DEFAULT false,
  last_activity TIMESTAMPTZ,
  uptime_seconds INTEGER DEFAULT 0,
  next_scheduled_task TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 创建索引
-- ============================================

CREATE INDEX idx_xhs_user_mapping_xhs_user_id ON xhs_user_mapping(xhs_user_id);
CREATE INDEX idx_xhs_user_profiles_supabase_uuid ON xhs_user_profiles(supabase_uuid);
CREATE INDEX idx_xhs_user_profiles_xhs_user_id ON xhs_user_profiles(xhs_user_id);
CREATE INDEX idx_xhs_content_strategies_supabase_uuid ON xhs_content_strategies(supabase_uuid);
CREATE INDEX idx_xhs_content_strategies_xhs_user_id ON xhs_content_strategies(xhs_user_id);
CREATE INDEX idx_xhs_daily_tasks_supabase_uuid ON xhs_daily_tasks(supabase_uuid);
CREATE INDEX idx_xhs_daily_tasks_xhs_user_id ON xhs_daily_tasks(xhs_user_id);
CREATE INDEX idx_xhs_daily_tasks_status ON xhs_daily_tasks(status);
CREATE INDEX idx_xhs_daily_tasks_scheduled_time ON xhs_daily_tasks(scheduled_time);
CREATE INDEX idx_xhs_weekly_plans_supabase_uuid ON xhs_weekly_plans(supabase_uuid);
CREATE INDEX idx_xhs_weekly_plans_xhs_user_id ON xhs_weekly_plans(xhs_user_id);
CREATE INDEX idx_xhs_weekly_plans_week_start_date ON xhs_weekly_plans(week_start_date);
CREATE INDEX idx_xhs_activity_logs_supabase_uuid ON xhs_activity_logs(supabase_uuid);
CREATE INDEX idx_xhs_activity_logs_xhs_user_id ON xhs_activity_logs(xhs_user_id);
CREATE INDEX idx_xhs_activity_logs_created_at ON xhs_activity_logs(created_at DESC);
CREATE INDEX idx_xhs_activity_logs_activity_type ON xhs_activity_logs(activity_type);
CREATE INDEX idx_xhs_automation_status_xhs_user_id ON xhs_automation_status(xhs_user_id);
CREATE INDEX idx_xhs_automation_status_is_running ON xhs_automation_status(is_running);

-- ============================================
-- 触发器
-- ============================================

CREATE OR REPLACE FUNCTION update_xhs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_xhs_user_mapping_updated_at
    BEFORE UPDATE ON xhs_user_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_updated_at();

CREATE TRIGGER trg_xhs_user_profiles_updated_at
    BEFORE UPDATE ON xhs_user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_updated_at();

CREATE TRIGGER trg_xhs_content_strategies_updated_at
    BEFORE UPDATE ON xhs_content_strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_updated_at();

CREATE TRIGGER trg_xhs_daily_tasks_updated_at
    BEFORE UPDATE ON xhs_daily_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_updated_at();

CREATE TRIGGER trg_xhs_weekly_plans_updated_at
    BEFORE UPDATE ON xhs_weekly_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_updated_at();

CREATE TRIGGER trg_xhs_automation_status_updated_at
    BEFORE UPDATE ON xhs_automation_status
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_updated_at();

-- ============================================
-- RLS 策略 - 使用简单的列名（不带表前缀）
-- ============================================

ALTER TABLE xhs_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_content_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE xhs_automation_status ENABLE ROW LEVEL SECURITY;

-- xhs_user_mapping
CREATE POLICY "xhs_user_mapping_select" ON xhs_user_mapping
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_user_mapping_insert" ON xhs_user_mapping
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

-- xhs_user_profiles
CREATE POLICY "xhs_user_profiles_select" ON xhs_user_profiles
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_user_profiles_insert" ON xhs_user_profiles
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

CREATE POLICY "xhs_user_profiles_update" ON xhs_user_profiles
    FOR UPDATE USING (supabase_uuid = auth.uid());

-- xhs_content_strategies
CREATE POLICY "xhs_content_strategies_select" ON xhs_content_strategies
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_content_strategies_insert" ON xhs_content_strategies
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

CREATE POLICY "xhs_content_strategies_update" ON xhs_content_strategies
    FOR UPDATE USING (supabase_uuid = auth.uid());

-- xhs_daily_tasks
CREATE POLICY "xhs_daily_tasks_select" ON xhs_daily_tasks
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_daily_tasks_insert" ON xhs_daily_tasks
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

CREATE POLICY "xhs_daily_tasks_update" ON xhs_daily_tasks
    FOR UPDATE USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_daily_tasks_delete" ON xhs_daily_tasks
    FOR DELETE USING (supabase_uuid = auth.uid());

-- xhs_weekly_plans
CREATE POLICY "xhs_weekly_plans_select" ON xhs_weekly_plans
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_weekly_plans_insert" ON xhs_weekly_plans
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

CREATE POLICY "xhs_weekly_plans_update" ON xhs_weekly_plans
    FOR UPDATE USING (supabase_uuid = auth.uid());

-- xhs_activity_logs
CREATE POLICY "xhs_activity_logs_select" ON xhs_activity_logs
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_activity_logs_insert" ON xhs_activity_logs
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

-- xhs_automation_status
CREATE POLICY "xhs_automation_status_select" ON xhs_automation_status
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "xhs_automation_status_insert" ON xhs_automation_status
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

CREATE POLICY "xhs_automation_status_update" ON xhs_automation_status
    FOR UPDATE USING (supabase_uuid = auth.uid());