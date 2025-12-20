-- =====================================================
-- 创建全局产品配置表
-- 产品信息全平台共享，每个用户一份
-- =====================================================

-- 1. 创建 global_product_profiles 表
CREATE TABLE IF NOT EXISTS global_product_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_uuid UUID NOT NULL UNIQUE,  -- 一个用户只有一个全局产品配置
    
    -- 产品基本信息
    product_name TEXT NOT NULL,
    product_description TEXT,
    target_audience TEXT,
    
    -- 产品素材
    material_images TEXT[] DEFAULT '{}',
    material_documents TEXT[] DEFAULT '{}',
    material_analysis TEXT,
    
    -- 地区 (用于舆情分析)
    region TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_global_product_supabase_uuid 
    ON global_product_profiles(supabase_uuid);

-- 2. 从现有 xhs_user_profiles 迁移数据到 global_product_profiles
-- (只迁移每个 supabase_uuid 的第一条记录)
INSERT INTO global_product_profiles (
    supabase_uuid,
    product_name,
    product_description,
    target_audience,
    material_images,
    material_documents,
    material_analysis,
    region,
    created_at,
    updated_at
)
SELECT DISTINCT ON (supabase_uuid)
    supabase_uuid,
    product_name,
    '',  -- product_description (新字段)
    target_audience,
    COALESCE(material_images, '{}'),
    COALESCE(material_documents, '{}'),
    material_analysis,
    region,
    created_at,
    updated_at
FROM xhs_user_profiles
WHERE product_name IS NOT NULL
ON CONFLICT (supabase_uuid) DO NOTHING;

-- 3. 为 xhs_user_profiles 添加关联字段 (保持向后兼容)
-- 不删除旧字段，只添加注释表明已迁移
COMMENT ON TABLE global_product_profiles IS '全局产品配置，每个用户一份，所有平台共享';
COMMENT ON COLUMN global_product_profiles.supabase_uuid IS '用户 ID (唯一)';
COMMENT ON COLUMN global_product_profiles.product_name IS '产品/服务名称';
COMMENT ON COLUMN global_product_profiles.product_description IS '产品详细描述';
COMMENT ON COLUMN global_product_profiles.material_images IS '产品图片 URL 列表';
COMMENT ON COLUMN global_product_profiles.material_documents IS '产品文档 URL 列表';

-- 4. RLS 策略
ALTER TABLE global_product_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on global_product_profiles"
    ON global_product_profiles FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_global_product_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_global_product_updated_at ON global_product_profiles;
CREATE TRIGGER trigger_global_product_updated_at
    BEFORE UPDATE ON global_product_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_global_product_updated_at();
