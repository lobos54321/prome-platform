-- Video Tracking System Migration
-- This extends your existing balance-based billing system for video generation
-- Execute this in Supabase SQL Editor

-- Create video_generations table for tracking video creation
CREATE TABLE IF NOT EXISTS public.video_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    duration INTEGER NOT NULL,
    cost_usd DECIMAL(10,4) NOT NULL, -- Cost in USD (like your existing system)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    video_url TEXT,
    n8n_workflow_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON public.video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_session_id ON public.video_generations(session_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON public.video_generations(status);

-- Enable RLS for security
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Users can view own video generations" ON public.video_generations 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage video generations" ON public.video_generations 
FOR ALL USING (true);

-- Function to check if user has enough balance for video generation
CREATE OR REPLACE FUNCTION public.check_user_balance_for_video(user_uuid UUID, required_usd DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL;
BEGIN
    SELECT balance INTO current_balance FROM public.users WHERE id = user_uuid;
    RETURN COALESCE(current_balance, 0) >= required_usd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reserve balance for video generation (deduct upfront like your existing system)
CREATE OR REPLACE FUNCTION public.reserve_balance_for_video(
    user_uuid UUID, 
    cost_usd DECIMAL,
    session_id_param TEXT,
    duration_param INTEGER,
    metadata_param JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL;
    new_balance DECIMAL;
BEGIN
    -- Get current balance
    SELECT balance INTO current_balance FROM public.users WHERE id = user_uuid;
    
    -- Check if user has enough balance
    IF COALESCE(current_balance, 0) < cost_usd THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate new balance
    new_balance := current_balance - cost_usd;
    
    -- Update user balance (like your existing system)
    UPDATE public.users SET 
        balance = new_balance,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Create video generation record
    INSERT INTO public.video_generations (
        user_id,
        session_id,
        duration,
        cost_usd,
        status,
        n8n_workflow_data
    ) VALUES (
        user_uuid,
        session_id_param,
        duration_param,
        cost_usd,
        'pending',
        metadata_param
    );
    
    -- Create billing record (consistent with your existing system)
    INSERT INTO public.billing_records (
        user_id,
        amount,
        type,
        description,
        status,
        created_at
    ) VALUES (
        user_uuid,
        cost_usd,
        'usage',
        CONCAT('Video generation - ', duration_param, 's duration, session: ', session_id_param),
        'completed',
        NOW()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle video completion (success or failure)
CREATE OR REPLACE FUNCTION public.complete_video_generation(
    session_id_param TEXT,
    final_status TEXT,
    video_url_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    video_record RECORD;
BEGIN
    -- Get the video generation record
    SELECT * INTO video_record FROM public.video_generations WHERE session_id = session_id_param;
    
    IF video_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update video generation status
    UPDATE public.video_generations SET
        status = final_status,
        video_url = video_url_param,
        updated_at = NOW()
    WHERE session_id = session_id_param;
    
    -- If video generation failed, refund the balance
    IF final_status = 'failed' THEN
        UPDATE public.users SET
            balance = balance + video_record.cost_usd,
            updated_at = NOW()
        WHERE id = video_record.user_id;
        
        -- Add refund billing record
        INSERT INTO public.billing_records (
            user_id,
            amount,
            type,
            description,
            status,
            created_at
        ) VALUES (
            video_record.user_id,
            video_record.cost_usd,
            'charge',
            CONCAT('Refund for failed video generation - session: ', session_id_param),
            'completed',
            NOW()
        );
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.video_generations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_balance_for_video TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_balance_for_video TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_video_generation TO anon, authenticated;