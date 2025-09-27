-- Manual Migration for Credits System
-- Execute this SQL in Supabase SQL Editor

-- Step 1: Add credits column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 50000;

-- Step 2: Migrate existing balance to credits (50 USD = 50000 credits)
UPDATE public.users 
SET credits = COALESCE(balance * 1000, 50000)
WHERE credits IS NULL;

-- Step 3: Create credits_transactions table
CREATE TABLE IF NOT EXISTS public.credits_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('video_generation', 'top_up', 'refund', 'admin_adjustment')),
    description TEXT,
    session_id TEXT,
    video_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create video_generations table
CREATE TABLE IF NOT EXISTS public.video_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    duration INTEGER NOT NULL,
    credits_cost INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    video_url TEXT,
    n8n_workflow_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_type ON public.credits_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_session_id ON public.credits_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON public.video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_session_id ON public.video_generations(session_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON public.video_generations(status);

-- Step 6: Enable RLS
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies
CREATE POLICY IF NOT EXISTS "Users can view own credit transactions" ON public.credits_transactions 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view own video generations" ON public.video_generations 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage video generations" ON public.video_generations 
FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Service can manage credit transactions" ON public.credits_transactions 
FOR ALL USING (true);

-- Step 8: Create functions
CREATE OR REPLACE FUNCTION public.check_user_credits(user_uuid UUID, required_credits INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    SELECT credits INTO current_credits FROM public.users WHERE id = user_uuid;
    RETURN COALESCE(current_credits, 0) >= required_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.deduct_credits(
    user_uuid UUID, 
    credits_amount INTEGER, 
    transaction_type_param TEXT DEFAULT 'video_generation',
    description_param TEXT DEFAULT NULL,
    session_id_param TEXT DEFAULT NULL,
    video_url_param TEXT DEFAULT NULL,
    metadata_param JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
    new_credits INTEGER;
BEGIN
    -- Get current credits
    SELECT credits INTO current_credits FROM public.users WHERE id = user_uuid;
    
    -- Check if user has enough credits
    IF COALESCE(current_credits, 0) < credits_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate new credits
    new_credits := current_credits - credits_amount;
    
    -- Update user credits
    UPDATE public.users SET 
        credits = new_credits,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Create transaction record
    INSERT INTO public.credits_transactions (
        user_id, 
        amount, 
        transaction_type, 
        description,
        session_id,
        video_url,
        metadata
    ) VALUES (
        user_uuid, 
        -credits_amount, 
        transaction_type_param, 
        description_param,
        session_id_param,
        video_url_param,
        metadata_param
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_credits(
    user_uuid UUID, 
    credits_amount INTEGER, 
    transaction_type_param TEXT DEFAULT 'top_up',
    description_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
    new_credits INTEGER;
BEGIN
    -- Get current credits
    SELECT credits INTO current_credits FROM public.users WHERE id = user_uuid;
    
    -- Calculate new credits
    new_credits := COALESCE(current_credits, 0) + credits_amount;
    
    -- Update user credits
    UPDATE public.users SET 
        credits = new_credits,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Create transaction record
    INSERT INTO public.credits_transactions (
        user_id, 
        amount, 
        transaction_type, 
        description
    ) VALUES (
        user_uuid, 
        credits_amount, 
        transaction_type_param, 
        description_param
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.credits_transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.video_generations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_credits TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits TO anon, authenticated;