-- 创建 xhs_cookies 表用于持久化存储登录 cookies
CREATE TABLE IF NOT EXISTS xhs_cookies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supabase_uuid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    xhs_user_id TEXT NOT NULL,
    cookies JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_xhs_cookies_user ON xhs_cookies(supabase_uuid);

-- 启用 RLS
ALTER TABLE xhs_cookies ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can manage their own cookies"
ON xhs_cookies
FOR ALL
USING (auth.uid() = supabase_uuid)
WITH CHECK (auth.uid() = supabase_uuid);

-- 添加注释
COMMENT ON TABLE xhs_cookies IS '小红书登录 cookies 存储表';
COMMENT ON COLUMN xhs_cookies.supabase_uuid IS 'Supabase 用户 UUID';
COMMENT ON COLUMN xhs_cookies.xhs_user_id IS '小红书用户 ID';
COMMENT ON COLUMN xhs_cookies.cookies IS 'JSON 格式的 cookies 数据';
