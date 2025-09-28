-- Fix user registration trigger and permissions

-- Step 1: Check current trigger
SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';

-- Step 2: Recreate trigger with proper permissions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.users (id, name, email, role, balance)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
        NEW.email,
        'user',
        50
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

-- Step 3: Fix RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user creation during registration" ON public.users;
DROP POLICY IF EXISTS "Allow user registration" ON public.users;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;

CREATE POLICY "Users can access own data" ON public.users
FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable insert for registration" ON public.users
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Step 4: Verify setup
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users';