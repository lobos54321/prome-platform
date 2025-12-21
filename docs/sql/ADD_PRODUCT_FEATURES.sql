-- 添加产品特色字段到 global_product_profiles 表
-- 执行此迁移以支持新的产品特色功能

ALTER TABLE global_product_profiles 
ADD COLUMN IF NOT EXISTS product_features TEXT;

COMMENT ON COLUMN global_product_profiles.product_features IS '产品特色：核心卖点、差异化优势、独特价值主张';
