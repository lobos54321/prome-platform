-- Fix session_id column constraint in token_usage table
-- This migration resolves the NOT NULL constraint issue with session_id

-- Check if session_id column exists and handle the constraint
DO $$
BEGIN
    -- Check if session_id column exists in token_usage table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'token_usage' 
               AND column_name = 'session_id') THEN
        
        -- Make session_id nullable to fix the constraint error
        ALTER TABLE public.token_usage ALTER COLUMN session_id DROP NOT NULL;
        
        -- Set a default value for existing NULL session_id records
        UPDATE public.token_usage 
        SET session_id = COALESCE(conversation_id, 'session_' || id::text) 
        WHERE session_id IS NULL;
        
        RAISE NOTICE 'Updated session_id column to be nullable and filled NULL values';
    ELSE
        -- If session_id column doesn't exist, add it as nullable with default
        ALTER TABLE public.token_usage ADD COLUMN session_id TEXT;
        
        -- Set session_id for all existing records
        UPDATE public.token_usage 
        SET session_id = COALESCE(conversation_id, 'session_' || id::text) 
        WHERE session_id IS NULL;
        
        RAISE NOTICE 'Added session_id column as nullable';
    END IF;
END$$;

-- Add index for session_id for better query performance
CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON public.token_usage(session_id);

-- Update any existing rows that might have NULL session_id
UPDATE public.token_usage 
SET session_id = COALESCE(conversation_id, 'session_' || id::text) 
WHERE session_id IS NULL OR session_id = '';