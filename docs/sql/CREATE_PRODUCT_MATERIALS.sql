-- 产品素材表 - 为每个素材单独存储AI分析
-- 每张图片/文档都有独立的描述和元数据，便于AI精准检索

CREATE TABLE IF NOT EXISTS product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uuid TEXT NOT NULL,
  
  -- 文件信息
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'document')),
  file_name TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  
  -- AI 分析结果
  ai_description TEXT,           -- AI 对该素材的详细描述
  ai_tags TEXT[],               -- AI 识别的标签数组
  ai_category TEXT,             -- AI 分类: 产品图/包装图/使用场景/文档等
  
  -- 时间戳
  uploaded_at TIMESTAMP DEFAULT NOW(),
  analyzed_at TIMESTAMP,
  
  -- 索引
  UNIQUE(supabase_uuid, file_url)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_product_materials_uuid ON product_materials(supabase_uuid);
CREATE INDEX IF NOT EXISTS idx_product_materials_type ON product_materials(file_type);
CREATE INDEX IF NOT EXISTS idx_product_materials_category ON product_materials(ai_category);

-- RLS 策略
ALTER TABLE product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own materials" ON product_materials
  FOR SELECT USING (supabase_uuid = auth.uid()::text);

CREATE POLICY "Users can insert own materials" ON product_materials
  FOR INSERT WITH CHECK (supabase_uuid = auth.uid()::text);

CREATE POLICY "Users can update own materials" ON product_materials
  FOR UPDATE USING (supabase_uuid = auth.uid()::text);

CREATE POLICY "Users can delete own materials" ON product_materials
  FOR DELETE USING (supabase_uuid = auth.uid()::text);

-- 服务角色完全访问
CREATE POLICY "Service role full access" ON product_materials
  FOR ALL USING (auth.role() = 'service_role');

-- 注释
COMMENT ON TABLE product_materials IS '产品素材表 - 每个图片/文档独立存储AI分析结果';
COMMENT ON COLUMN product_materials.ai_description IS 'AI对该素材的详细描述，用于后续内容生成';
COMMENT ON COLUMN product_materials.ai_tags IS 'AI识别的标签，如: 产品、包装、细节、场景';
COMMENT ON COLUMN product_materials.ai_category IS 'AI分类: product_photo/packaging/usage_scene/document/certificate';
