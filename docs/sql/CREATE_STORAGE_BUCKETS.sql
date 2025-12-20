-- =====================================================
-- 创建 Supabase Storage Buckets
-- 用于存储用户上传的素材
-- =====================================================

-- 1. 创建语音样本 bucket (支持更多音频格式)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voice-samples',
    'voice-samples',
    true,
    20971520,
    ARRAY[
        'audio/mpeg', 'audio/mp3', 'audio/mp4', 
        'audio/wav', 'audio/wave', 'audio/x-wav',
        'audio/m4a', 'audio/x-m4a', 'audio/aac',
        'audio/ogg', 'audio/webm', 'audio/flac',
        'video/mp4', 'video/quicktime'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
        'audio/mpeg', 'audio/mp3', 'audio/mp4', 
        'audio/wav', 'audio/wave', 'audio/x-wav',
        'audio/m4a', 'audio/x-m4a', 'audio/aac',
        'audio/ogg', 'audio/webm', 'audio/flac',
        'video/mp4', 'video/quicktime'
    ]::text[];

-- 2. 创建头像照片 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatar-photos',
    'avatar-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']::text[];

-- 3. 创建产品图片 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']::text[];

-- 4. 删除旧策略再创建新策略 (避免重复错误)

-- voice-samples 策略
DROP POLICY IF EXISTS "Allow public read access for voice-samples" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload for voice-samples" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update for voice-samples" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload for voice-samples" ON storage.objects;

CREATE POLICY "Allow public read access for voice-samples"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-samples');

CREATE POLICY "Allow anon upload for voice-samples"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-samples');

CREATE POLICY "Allow authenticated update for voice-samples"
ON storage.objects FOR UPDATE
USING (bucket_id = 'voice-samples');

-- avatar-photos 策略
DROP POLICY IF EXISTS "Allow public read access for avatar-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload for avatar-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update for avatar-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload for avatar-photos" ON storage.objects;

CREATE POLICY "Allow public read access for avatar-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatar-photos');

CREATE POLICY "Allow anon upload for avatar-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatar-photos');

CREATE POLICY "Allow authenticated update for avatar-photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatar-photos');

-- product-images 策略
DROP POLICY IF EXISTS "Allow public read access for product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload for product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update for product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload for product-images" ON storage.objects;

CREATE POLICY "Allow public read access for product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Allow anon upload for product-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow authenticated update for product-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

