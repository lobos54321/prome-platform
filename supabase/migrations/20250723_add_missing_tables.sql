-- Add missing tables for enhanced token monitoring and model management
-- This migration adds model_configs and exchange_rates tables

-- Create model_configs table (enhanced version of pricing_rules)
CREATE TABLE IF NOT EXISTS public.model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name TEXT NOT NULL UNIQUE,
    input_token_price DECIMAL(10,6) NOT NULL DEFAULT 0.002,
    output_token_price DECIMAL(10,6) NOT NULL DEFAULT 0.006,
    service_type TEXT NOT NULL DEFAULT 'ai_model',
    workflow_cost DECIMAL(10,4),
    is_active BOOLEAN DEFAULT true,
    auto_created BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate INTEGER NOT NULL DEFAULT 10000, -- points per USD
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add additional columns to token_usage table if they don't exist
DO $$
BEGIN
    -- Add input_tokens column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'input_tokens') THEN
        ALTER TABLE public.token_usage ADD COLUMN input_tokens INTEGER DEFAULT 0;
    END IF;
    
    -- Add output_tokens column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'output_tokens') THEN
        ALTER TABLE public.token_usage ADD COLUMN output_tokens INTEGER DEFAULT 0;
    END IF;
    
    -- Add input_cost column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'input_cost') THEN
        ALTER TABLE public.token_usage ADD COLUMN input_cost DECIMAL(10,6) DEFAULT 0;
    END IF;
    
    -- Add output_cost column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'output_cost') THEN
        ALTER TABLE public.token_usage ADD COLUMN output_cost DECIMAL(10,6) DEFAULT 0;
    END IF;
    
    -- Add conversation_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'conversation_id') THEN
        ALTER TABLE public.token_usage ADD COLUMN conversation_id TEXT;
    END IF;
    
    -- Add message_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'message_id') THEN
        ALTER TABLE public.token_usage ADD COLUMN message_id TEXT;
    END IF;
    
    -- Add timestamp column if it doesn't exist (alternative name for created_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' AND column_name = 'timestamp') THEN
        ALTER TABLE public.token_usage ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
    END IF;
END$$;

-- Insert default model configurations from existing pricing_rules
INSERT INTO public.model_configs (model_name, input_token_price, output_token_price, service_type, is_active, auto_created)
SELECT 
    model,
    prompt_token_price,
    completion_token_price,
    'ai_model',
    is_active,
    false
FROM public.pricing_rules
ON CONFLICT (model_name) DO UPDATE SET
    input_token_price = EXCLUDED.input_token_price,
    output_token_price = EXCLUDED.output_token_price,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insert default exchange rate
INSERT INTO public.exchange_rates (rate, is_active, created_at)
VALUES (10000, true, NOW())
ON CONFLICT DO NOTHING;

-- Add policies for new tables
CREATE POLICY "Model configs are viewable by authenticated users" ON public.model_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Exchange rates are viewable by authenticated users" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

-- Add admin policies (assuming admin role exists)
CREATE POLICY "Admins can manage model configs" ON public.model_configs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage exchange rates" ON public.exchange_rates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_model_configs_model_name ON public.model_configs(model_name);
CREATE INDEX IF NOT EXISTS idx_model_configs_is_active ON public.model_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_is_active ON public.exchange_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON public.token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON public.token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_conversation_id ON public.token_usage(conversation_id);

-- Grant permissions
GRANT SELECT ON public.model_configs TO authenticated, anon;
GRANT SELECT ON public.exchange_rates TO authenticated, anon;