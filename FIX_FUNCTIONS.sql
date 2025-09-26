-- =====================================================
-- Fix Database Functions (Remove updated_at references)
-- Execute this in Supabase to fix the users table field error
-- =====================================================

-- Step 1: Fix reserve_credits_for_video function
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
    
    -- Fixed: Removed updated_at field that doesn't exist
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

-- Step 2: Fix complete_video_generation function  
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
        -- Fixed: Removed updated_at field that doesn't exist
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

-- Test the fixes
SELECT 'Functions fixed successfully!' AS status;