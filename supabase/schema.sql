-- Additional tables needed for token consumption management system

-- Model configurations table
CREATE TABLE IF NOT EXISTS model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL UNIQUE,
  input_token_price DECIMAL(10, 6) NOT NULL, -- USD per 1000 tokens
  output_token_price DECIMAL(10, 6) NOT NULL, -- USD per 1000 tokens
  service_type TEXT DEFAULT 'ai_model' CHECK (service_type IN ('ai_model', 'digital_human', 'workflow', 'custom')),
  workflow_cost DECIMAL(10, 6) DEFAULT NULL, -- Fixed cost per workflow execution (for non-token services)
  is_active BOOLEAN DEFAULT true,
  auto_created BOOLEAN DEFAULT false, -- Indicates if this was auto-created by the system
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate INTEGER NOT NULL, -- points per USD (e.g., 10000 points = 1 USD)
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchange rate history table
CREATE TABLE IF NOT EXISTS exchange_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_rate INTEGER NOT NULL,
  new_rate INTEGER NOT NULL,
  admin_id UUID REFERENCES users(id),
  reason TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced token_usage table (add columns if they don't exist)
ALTER TABLE token_usage 
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS input_cost DECIMAL(10, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_cost DECIMAL(10, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Add new columns to model_configs table if they don't exist
ALTER TABLE model_configs
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'ai_model',
ADD COLUMN IF NOT EXISTS workflow_cost DECIMAL(10, 6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;

-- Add constraint for service_type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'model_configs' AND constraint_name = 'model_configs_service_type_check'
    ) THEN
        ALTER TABLE model_configs ADD CONSTRAINT model_configs_service_type_check 
        CHECK (service_type IN ('ai_model', 'digital_human', 'workflow', 'custom'));
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_model_configs_active ON model_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_timestamp ON token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);

-- Insert default exchange rate if none exists
INSERT INTO exchange_rates (rate, is_active, created_at, updated_at)
SELECT 10000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM exchange_rates WHERE is_active = true);

-- Insert some default model configurations
INSERT INTO model_configs (model_name, input_token_price, output_token_price, is_active, created_at, updated_at)
VALUES 
  ('gpt-4', 0.060, 0.120, true, NOW(), NOW()),
  ('gpt-4-turbo', 0.030, 0.060, true, NOW(), NOW()),
  ('gpt-3.5-turbo', 0.0015, 0.002, true, NOW(), NOW()),
  ('claude-3-sonnet', 0.015, 0.075, true, NOW(), NOW()),
  ('claude-3-haiku', 0.00025, 0.00125, true, NOW(), NOW())
ON CONFLICT (model_name) DO NOTHING;