-- Fix timestamp columns for token_usage and billing_records tables
-- This migration ensures that both tables have proper created_at columns

-- Ensure token_usage table has created_at column
DO $$
BEGIN
    -- Check if created_at column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'token_usage' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.token_usage ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Update any existing records that have NULL created_at
    UPDATE public.token_usage SET created_at = NOW() WHERE created_at IS NULL;
END$$;

-- Ensure billing_records table has created_at column
DO $$
BEGIN
    -- Check if created_at column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'billing_records' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.billing_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Update any existing records that have NULL created_at
    UPDATE public.billing_records SET created_at = NOW() WHERE created_at IS NULL;
END$$;

-- Make sure the columns are not null going forward
ALTER TABLE public.token_usage ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.billing_records ALTER COLUMN created_at SET NOT NULL;

-- Add indexes for better performance on timestamp queries
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON public.token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_records_created_at ON public.billing_records(created_at);

-- Ensure proper default values for new records
ALTER TABLE public.token_usage ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.billing_records ALTER COLUMN created_at SET DEFAULT NOW();