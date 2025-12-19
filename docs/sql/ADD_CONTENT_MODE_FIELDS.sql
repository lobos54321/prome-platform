-- =============================================
-- Supabase Migration: Content Mode Configuration
-- =============================================
-- 
-- 此迁移添加内容形式配置相关的字段和 Storage bucket
-- 
-- 运行方式：在 Supabase SQL Editor 中执行
-- =============================================

-- 1. 添加 xhs_user_profiles 新字段
ALTER TABLE xhs_user_profiles
ADD COLUMN IF NOT EXISTS content_mode_preference TEXT DEFAULT 'IMAGE_TEXT',
ADD COLUMN IF NOT EXISTS avatar_photo_url TEXT,
ADD COLUMN IF NOT EXISTS voice_sample_url TEXT,
ADD COLUMN IF NOT EXISTS ugc_gender TEXT DEFAULT 'female',
ADD COLUMN IF NOT EXISTS ugc_language TEXT DEFAULT 'zh-CN',
ADD COLUMN IF NOT EXISTS ugc_duration INTEGER DEFAULT 60;

-- 2. 添加列注释
COMMENT ON COLUMN xhs_user_profiles.content_mode_preference IS '内容形式偏好: IMAGE_TEXT, UGC_VIDEO, AVATAR_VIDEO';
COMMENT ON COLUMN xhs_user_profiles.avatar_photo_url IS '数字人照片 URL (AVATAR_VIDEO 模式需要)';
COMMENT ON COLUMN xhs_user_profiles.voice_sample_url IS '语音样本 URL (AVATAR_VIDEO 模式需要)';
COMMENT ON COLUMN xhs_user_profiles.ugc_gender IS 'UGC 视频角色性别: male 或 female';
COMMENT ON COLUMN xhs_user_profiles.ugc_language IS 'UGC 视频语言: zh-CN, en-US, ja-JP, ko-KR';
COMMENT ON COLUMN xhs_user_profiles.ugc_duration IS 'UGC 视频时长（秒）: 15, 30, 45, 60';

-- 3. 创建 Storage Bucket: avatar-photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatar-photos',
  'avatar-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 4. 创建 Storage Bucket: voice-samples
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-samples',
  'voice-samples',
  true,
  10485760, -- 10MB
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/aac']
)
ON CONFLICT (id) DO NOTHING;

-- 5. 创建 Storage Bucket: product-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS 策略 - avatar-photos
CREATE POLICY "Users can upload their own avatar photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own avatar photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatar-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view avatar photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatar-photos');

-- 7. Storage RLS 策略 - voice-samples
CREATE POLICY "Users can upload their own voice samples"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-samples' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own voice samples"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-samples' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view voice samples"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'voice-samples');

-- 8. Storage RLS 策略 - product-images
CREATE POLICY "Users can upload their own product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own product images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- =============================================
-- 完成
-- =============================================
SELECT 'Migration completed successfully!' AS status;
