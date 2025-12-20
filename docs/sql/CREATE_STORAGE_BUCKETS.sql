-- =====================================================
-- 创建 Supabase Storage Buckets
-- 用于存储用户上传的素材
-- =====================================================

-- 1. 创建语音样本 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voice-samples',
    'voice-samples',
    true,  -- 公开访问
    20971520,  -- 20MB 限制 (1-2分钟高质量音频)
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav']::text[];

-- 2. 创建头像照片 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatar-photos',
    'avatar-photos',
    true,
    5242880,  -- 5MB 限制
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- 3. 创建产品图片 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    10485760,  -- 10MB 限制
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- 4. 设置 Storage RLS 策略 - 允许所有用户上传和读取

-- voice-samples 策略
CREATE POLICY "Allow public read access for voice-samples"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-samples');

CREATE POLICY "Allow authenticated upload for voice-samples"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-samples');

CREATE POLICY "Allow authenticated update for voice-samples"
ON storage.objects FOR UPDATE
USING (bucket_id = 'voice-samples');

-- avatar-photos 策略
CREATE POLICY "Allow public read access for avatar-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatar-photos');

CREATE POLICY "Allow authenticated upload for avatar-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatar-photos');

CREATE POLICY "Allow authenticated update for avatar-photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatar-photos');

-- product-images 策略
CREATE POLICY "Allow public read access for product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Allow authenticated upload for product-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow authenticated update for product-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');
