-- Supabase Setup for Digital Human Video System
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create storage bucket for digital human videos (temporary storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'digital-human-videos',
  'digital-human-videos',
  true,
  104857600, -- 100MB limit
  '{"video/mp4","video/avi","video/mov","video/wmv","video/mkv"}'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create storage policy for public access (for A2E API to access video URLs)
CREATE POLICY "Allow public access to digital human videos" ON storage.objects
FOR SELECT USING (bucket_id = 'digital-human-videos');

-- 3. Create policy for authenticated uploads
CREATE POLICY "Allow authenticated uploads to digital human videos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'digital-human-videos' AND auth.role() = 'authenticated');

-- 4. Create policy for service role operations (for cleanup)
CREATE POLICY "Allow service role operations on digital human videos" ON storage.objects
FOR ALL USING (bucket_id = 'digital-human-videos' AND auth.role() = 'service_role');

-- 5. Create digital human training records table (optional - for tracking)
CREATE TABLE IF NOT EXISTS digital_human_training (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  training_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  status TEXT DEFAULT 'pending',
  image_url TEXT,
  video_url TEXT,
  background_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- 6. Create digital human video generation records table (optional - for tracking)
CREATE TABLE IF NOT EXISTS digital_human_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  training_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  text_script TEXT NOT NULL,
  language TEXT DEFAULT 'zh-CN',
  emotion TEXT DEFAULT 'neutral',
  voice_model TEXT,
  status TEXT DEFAULT 'pending',
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_digital_human_training_user_id ON digital_human_training(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_human_training_status ON digital_human_training(status);
CREATE INDEX IF NOT EXISTS idx_digital_human_videos_user_id ON digital_human_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_human_videos_task_id ON digital_human_videos(task_id);
CREATE INDEX IF NOT EXISTS idx_digital_human_videos_status ON digital_human_videos(status);

-- 8. Create RLS policies for the tables
ALTER TABLE digital_human_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_human_videos ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their own training records
CREATE POLICY "Users can view their own training records" ON digital_human_training
FOR SELECT USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

-- Policy for users to insert their own training records
CREATE POLICY "Users can insert their own training records" ON digital_human_training
FOR INSERT WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'service_role');

-- Policy for service role to update training records
CREATE POLICY "Service role can update training records" ON digital_human_training
FOR UPDATE USING (auth.role() = 'service_role');

-- Similar policies for video records
CREATE POLICY "Users can view their own video records" ON digital_human_videos
FOR SELECT USING (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own video records" ON digital_human_videos
FOR INSERT WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can update video records" ON digital_human_videos
FOR UPDATE USING (auth.role() = 'service_role');

-- 9. Create functions for automatic cleanup (optional)
CREATE OR REPLACE FUNCTION cleanup_old_temp_videos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete video files older than 1 hour from storage
  DELETE FROM storage.objects
  WHERE bucket_id = 'digital-human-videos'
    AND name LIKE 'temp-%'
    AND created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- 10. Create a scheduled function to run cleanup (requires pg_cron extension)
-- Uncomment the following line if you have pg_cron enabled:
-- SELECT cron.schedule('cleanup-temp-videos', '*/30 * * * *', 'SELECT cleanup_old_temp_videos();');

COMMENT ON TABLE digital_human_training IS 'Tracks digital human training sessions with A2E API';
COMMENT ON TABLE digital_human_videos IS 'Tracks digital human video generation tasks';
COMMENT ON FUNCTION cleanup_old_temp_videos() IS 'Automatically removes temporary video files older than 1 hour';