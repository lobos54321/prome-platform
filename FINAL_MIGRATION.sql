-- =====================================================
-- Video Credits System Migration (FINAL VERSION)
-- Compatible with existing Deep Copywriting system
-- Safe to execute - adds new functionality without modifying existing
-- =====================================================

-- Step 1: Create video_generations table
CREATE TABLE IF NOT EXISTS public.video_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    duration INTEGER NOT NULL,
    cost_credits INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    video_url TEXT,
    n8n_workflow_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON public.video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_session_id ON public.video_generations(session_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON public.video_generations(status);

-- Step 3: Enable Row Level Security
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
DROP POLICY IF EXISTS "Users can view own video generations" ON public.video_generations;
CREATE POLICY "Users can view own video generations" ON public.video_generations 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage video generations" ON public.video_generations;
CREATE POLICY "Service can manage video generations" ON public.video_generations 
FOR ALL USING (true);

-- Step 5: Create function to check user credits for video
CREATE OR REPLACE FUNCTION public.check_user_credits_for_video(user_uuid UUID, required_credits INTEGER)
RETURNS BOOLEAN AS $func$
DECLARE
    current_credits INTEGER;
BEGIN
    SELECT balance INTO current_credits FROM public.users WHERE id = user_uuid;
    RETURN COALESCE(current_credits, 0) >= required_credits;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create function to reserve credits for video generation
CREATE OR REPLACE FUNCTION public.reserve_credits_for_video(
    user_uuid UUID, 
    credits_amount INTEGER,
    session_id_param TEXT,
    duration_param INTEGER,
    metadata_param JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $func2$
DECLARE
    current_credits INTEGER;
    new_credits INTEGER;
BEGIN
    SELECT balance INTO current_credits FROM public.users WHERE id = user_uuid;
    
    IF COALESCE(current_credits, 0) < credits_amount THEN
        RETURN FALSE;
    END IF;
    
    new_credits := current_credits - credits_amount;
    
    UPDATE public.users SET 
        balance = new_credits
    WHERE id = user_uuid;
    
    INSERT INTO public.video_generations (
        user_id,
        session_id,
        duration,
        cost_credits,
        status,
        n8n_workflow_data
    ) VALUES (
        user_uuid,
        session_id_param,
        duration_param,
        credits_amount,
        'pending',
        metadata_param
    );
    
    INSERT INTO public.billing_records (
        user_id,
        amount,
        type,
        description,
        status,
        created_at
    ) VALUES (
        user_uuid,
        credits_amount,
        'usage',
        CONCAT('Auto-video generation - ', duration_param, 's duration, session: ', session_id_param),
        'completed',
        NOW()
    );
    
    RETURN TRUE;
END;
$func2$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create function to handle video completion
CREATE OR REPLACE FUNCTION public.complete_video_generation(
    session_id_param TEXT,
    final_status TEXT,
    video_url_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $func3$
DECLARE
    video_record RECORD;
BEGIN
    SELECT * INTO video_record FROM public.video_generations WHERE session_id = session_id_param;
    
    IF video_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    UPDATE public.video_generations SET
        status = final_status,
        video_url = video_url_param,
        updated_at = NOW()
    WHERE session_id = session_id_param;
    
    IF final_status = 'failed' THEN
        UPDATE public.users SET
            balance = balance + video_record.cost_credits
        WHERE id = video_record.user_id;
        
        INSERT INTO public.billing_records (
            user_id,
            amount,
            type,
            description,
            status,
            created_at
        ) VALUES (
            video_record.user_id,
            video_record.cost_credits,
            'charge',
            CONCAT('Auto-video refund for failed generation - session: ', session_id_param),
            'completed',
            NOW()
        );
    END IF;
    
    RETURN TRUE;
END;
$func3$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.video_generations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_credits_for_video TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_for_video TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_video_generation TO anon, authenticated;

-- Step 9: Test the migration
SELECT 'Video credits system migration completed successfully!' AS status;
SELECT COUNT(*) as video_generations_table_ready FROM information_schema.tables WHERE table_name = 'video_generations';
SELECT 'Functions created:' AS status;
SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('check_user_credits_for_video', 'reserve_credits_for_video', 'complete_video_generation');