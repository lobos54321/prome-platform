-- Fix model_configs RLS policies for authenticated users
-- Execute this in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "model_configs_select_policy" ON model_configs;
DROP POLICY IF EXISTS "model_configs_insert_policy" ON model_configs;
DROP POLICY IF EXISTS "model_configs_update_policy" ON model_configs;
DROP POLICY IF EXISTS "model_configs_delete_policy" ON model_configs;

-- Create new permissive policies for authenticated users
CREATE POLICY "model_configs_select_policy" 
  ON model_configs FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "model_configs_insert_policy" 
  ON model_configs FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "model_configs_update_policy" 
  ON model_configs FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "model_configs_delete_policy" 
  ON model_configs FOR DELETE 
  TO authenticated 
  USING (true);

-- Also allow anonymous users (device-based auth)
CREATE POLICY "model_configs_anon_select" 
  ON model_configs FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "model_configs_anon_insert" 
  ON model_configs FOR INSERT 
  TO anon 
  WITH CHECK (true);

CREATE POLICY "model_configs_anon_update" 
  ON model_configs FOR UPDATE 
  TO anon 
  USING (true) 
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'model_configs';