-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')) DEFAULT 'user',
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  features TEXT[] NOT NULL,
  price_per_token DECIMAL(10,6) NOT NULL,
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  dify_url TEXT NOT NULL
);

-- Create token_usage table
CREATE TABLE IF NOT EXISTS public.token_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  service_id TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost DECIMAL(10,6) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  session_id TEXT NOT NULL
);

-- Create billing_records table
CREATE TABLE IF NOT EXISTS public.billing_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'usage')),
  description TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'failed'))
);

-- Create pricing_rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL UNIQUE,
  input_token_price DECIMAL(10,6) NOT NULL,
  output_token_price DECIMAL(10,6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create scripts table
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  service_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  test_mode BOOLEAN NOT NULL DEFAULT FALSE,
  model TEXT NOT NULL,
  tags TEXT[]
);

-- Create API keys table for webhook authentication
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Insert default API key for webhooks
INSERT INTO public.api_keys (name, key) VALUES ('Default Webhook Key', 'prome_wh_key_123456')
ON CONFLICT DO NOTHING;

-- Create Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can view all user profiles" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Services table policies
CREATE POLICY "Anyone can view services" ON public.services
  FOR SELECT USING (TRUE);

CREATE POLICY "Only admins can modify services" ON public.services
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Token usage policies
CREATE POLICY "Users can view their own token usage" ON public.token_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all token usage" ON public.token_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Billing records policies
CREATE POLICY "Users can view their own billing records" ON public.billing_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all billing records" ON public.billing_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Pricing rules policies
CREATE POLICY "Anyone can view pricing rules" ON public.pricing_rules
  FOR SELECT USING (TRUE);

CREATE POLICY "Only admins can modify pricing rules" ON public.pricing_rules
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Scripts policies
CREATE POLICY "Users can view their own scripts" ON public.scripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all scripts" ON public.scripts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- API keys policies
CREATE POLICY "Only admins can view and modify API keys" ON public.api_keys
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Create seed data for services
INSERT INTO public.services (id, name, description, category, features, price_per_token, popular, dify_url) VALUES
  ('broadcast-script', '口播文案创作', '专业的AI口播文案生成助手，打造流畅自然的播报内容', '口播文案', ARRAY['广告口播', '产品介绍', '新闻播报', '视频解说'], 0.0002, TRUE, 'https://example.com/embed/broadcast-script'),
  ('voice-optimization', '播音优化助手', '针对口播稿件进行节奏、停顿和语调优化，提升播报效果', '口播文案', ARRAY['语气优化', '节奏调整', '停顿标记', '语调建议'], 0.0003, TRUE, 'https://example.com/embed/voice-optimization'),
  ('script-translation', '口播稿翻译', '专业的口播文案多语言翻译，保留原文风格和语气', '翻译服务', ARRAY['多语言翻译', '文化本地化', '术语一致性', '语气保留'], 0.0004, FALSE, 'https://example.com/embed/script-translation'),
  ('ad-script-generator', '广告脚本生成器', '创建引人入胜的广告口播脚本，增强产品吸引力', '广告文案', ARRAY['产品推广', '促销广告', '品牌宣传', '电台广告'], 0.0002, TRUE, 'https://example.com/embed/ad-script-generator'),
  ('narration-expert', '旁白专家', '为视频、纪录片和教育内容创建专业旁白脚本', '视频内容', ARRAY['视频旁白', '纪录片解说', '教学内容', '故事讲述'], 0.0003, FALSE, 'https://example.com/embed/narration-expert'),
  ('style-adapter', '风格适配器', '将已有文本调整为适合口播的风格和节奏', '内容改写', ARRAY['风格调整', '口语化处理', '语句简化', '韵律优化'], 0.0002, FALSE, 'https://example.com/embed/style-adapter')
ON CONFLICT DO NOTHING;

-- Create seed data for pricing rules
INSERT INTO public.pricing_rules (model_name, input_token_price, output_token_price, is_active) VALUES
  ('GPT-4', 0.0003, 0.0006, TRUE),
  ('GPT-3.5', 0.0001, 0.0002, TRUE),
  ('Claude 3 Opus', 0.0003, 0.0015, TRUE),
  ('Claude 3 Sonnet', 0.0002, 0.0008, TRUE),
  ('Claude 3 Haiku', 0.00025, 0.00125, TRUE),
  ('DeepSeek R1', 0.00015, 0.0005, TRUE),
  ('火山方舟 V3', 0.0001, 0.0003, TRUE),
  ('GPT-4o', 0.00025, 0.0005, TRUE),
  ('default', 0.0001, 0.0002, TRUE)
ON CONFLICT DO NOTHING;