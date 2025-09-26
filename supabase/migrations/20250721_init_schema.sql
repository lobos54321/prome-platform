-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    balance DECIMAL(10,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price DECIMAL(10,4) NOT NULL,
    price_unit TEXT DEFAULT 'per token',
    is_active BOOLEAN DEFAULT true,
    features JSONB DEFAULT '[]',
    model_supported JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create token_usage table
CREATE TABLE IF NOT EXISTS public.token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    tokens_used INTEGER NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10,4) NOT NULL,
    model TEXT NOT NULL,
    latency INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create billing_records table
CREATE TABLE IF NOT EXISTS public.billing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pricing_rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model TEXT NOT NULL UNIQUE,
    prompt_token_price DECIMAL(10,6) NOT NULL,
    completion_token_price DECIMAL(10,6) NOT NULL,
    currency TEXT DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample services
INSERT INTO public.services (name, description, category, price, features, model_supported) VALUES
('智能写作助手', '基于AI的内容创作和文案生成服务', '内容创作', 0.02, '["智能文案生成", "多风格适配", "SEO优化"]', '["GPT-4", "GPT-3.5-turbo"]'),
('代码生成助手', '智能代码生成和调试服务', '开发工具', 0.03, '["代码生成", "错误检测", "性能优化建议"]', '["GPT-4", "Claude-2"]'),
('翻译服务', '多语言智能翻译服务', '语言处理', 0.015, '["多语言支持", "语境理解", "专业术语识别"]', '["GPT-4", "GPT-3.5-turbo"]'),
('数据分析助手', '智能数据分析和可视化', '数据分析', 0.025, '["数据清洗", "统计分析", "图表生成"]', '["GPT-4", "Claude-2"]')
ON CONFLICT (id) DO NOTHING;

-- Insert sample pricing rules
INSERT INTO public.pricing_rules (model, prompt_token_price, completion_token_price) VALUES
('gpt-4', 0.00003, 0.00006),
('gpt-3.5-turbo', 0.0000015, 0.000002),
('claude-2', 0.000008, 0.000024),
('llama-2-70b', 0.0000007, 0.0000009)
ON CONFLICT (model) DO NOTHING;

-- Insert initial API key
INSERT INTO public.api_keys (name, key) VALUES
('Default Webhook Key', 'prome_wh_key_123456')
ON CONFLICT (key) DO NOTHING;

-- Set up Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own token usage" ON public.token_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own billing records" ON public.billing_records FOR SELECT USING (auth.uid() = user_id);

-- Services table should be readable by all authenticated users
CREATE POLICY "Services are viewable by authenticated users" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pricing rules are viewable by authenticated users" ON public.pricing_rules FOR SELECT TO authenticated USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, role, balance)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        50
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
