-- ============================================
-- 修复 400 错误的补充脚本
-- 请在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 1. 确保表存在
CREATE TABLE IF NOT EXISTS xhs_user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(supabase_uuid)
);

-- 2. 补全所有可能缺失的字段 (防 400 的关键)
-- 即使前端发送了 posts_per_day (旧代码)，数据库也要能接住
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS marketing_goal TEXT;
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS brand_style TEXT;
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS post_frequency TEXT;
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS review_mode TEXT;

-- 兼容旧前端代码的字段 (防止 "column does not exist" 导致的 400)
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS posts_per_day INTEGER; 

-- 素材字段
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS material_images TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS material_documents TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE xhs_user_profiles ADD COLUMN IF NOT EXISTS material_analysis TEXT;

-- 3. 确保 RLS 策略存在
ALTER TABLE xhs_user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'xhs_user_profiles' AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" ON xhs_user_profiles FOR SELECT USING (auth.uid() = supabase_uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'xhs_user_profiles' AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile" ON xhs_user_profiles FOR INSERT WITH CHECK (auth.uid() = supabase_uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'xhs_user_profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON xhs_user_profiles FOR UPDATE USING (auth.uid() = supabase_uuid);
    END IF;
END $$;

-- 4. 提示
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库字段已补全，现在兼容所有版本的前端代码。';
END $$;
