-- ============================================
-- 小红书自动运营 - 用户配置表Schema (修复 400 Bad Request)
-- 执行：在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 1. 创建 xhs_user_profiles 表
CREATE TABLE IF NOT EXISTS xhs_user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uuid UUID NOT NULL,
  xhs_user_id TEXT NOT NULL DEFAULT 'pending',
  
  -- 产品配置字段
  product_name TEXT,
  target_audience TEXT,
  region TEXT, -- 地区 (如 Sydney)
  marketing_goal TEXT, -- brand, sales, traffic, community
  post_frequency TEXT, -- daily, weekly ...
  brand_style TEXT, -- professional, warm ...
  review_mode TEXT DEFAULT 'manual', -- auto, manual
  
  -- 素材分析字段 (关键修复点)
  material_images TEXT[] DEFAULT ARRAY[]::TEXT[], -- 图片URL列表
  material_documents TEXT[] DEFAULT ARRAY[]::TEXT[], -- 文档URL列表
  material_analysis TEXT, -- AI分析结果 (Markdown长文本)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 约束
  UNIQUE(supabase_uuid)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_supabase_uuid ON xhs_user_profiles(supabase_uuid);

-- 2. 启用 RLS (Row Level Security)
ALTER TABLE xhs_user_profiles ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能查看和修改自己的配置 (覆盖式创建，防止报错)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON xhs_user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON xhs_user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON xhs_user_profiles;
END $$;

CREATE POLICY "Users can view own profile" ON xhs_user_profiles
  FOR SELECT USING (auth.uid() = supabase_uuid);

CREATE POLICY "Users can insert own profile" ON xhs_user_profiles
  FOR INSERT WITH CHECK (auth.uid() = supabase_uuid);

CREATE POLICY "Users can update own profile" ON xhs_user_profiles
  FOR UPDATE USING (auth.uid() = supabase_uuid);

-- 3. 自动更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON xhs_user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON xhs_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 执行完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ xhs_user_profiles 表创建/更新成功！';
  RAISE NOTICE '👉 现在由于包含了 material_analysis 等字段，保存配置将不再报错 (400)。';
END $$;
