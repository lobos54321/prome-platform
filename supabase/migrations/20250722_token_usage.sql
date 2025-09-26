-- Token Usage Detailed Tracking SQL Migration
-- This migration extends the token_usage table to support more detailed tracking of Dify API token usage

-- Add new columns to token_usage table for detailed metrics
ALTER TABLE public.token_usage 
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER, 
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS endpoint TEXT,
  ADD COLUMN IF NOT EXISTS prompt_price DECIMAL(10,6),
  ADD COLUMN IF NOT EXISTS completion_price DECIMAL(10,6),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS latency DECIMAL(10,6);

-- Create function for token usage analytics
CREATE OR REPLACE FUNCTION get_token_usage_summary(
  user_id_param UUID,
  start_date_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
) 
RETURNS TABLE (
  total_prompt_tokens BIGINT,
  total_completion_tokens BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL(10,6),
  average_tokens_per_request NUMERIC,
  request_count BIGINT,
  currency TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(COALESCE(prompt_tokens, 0))::BIGINT AS total_prompt_tokens,
    SUM(COALESCE(completion_tokens, 0))::BIGINT AS total_completion_tokens,
    SUM(tokens_used)::BIGINT AS total_tokens,
    SUM(cost)::DECIMAL(10,6) AS total_cost,
    (SUM(tokens_used) / COUNT(*))::NUMERIC AS average_tokens_per_request,
    COUNT(*)::BIGINT AS request_count,
    MAX(currency) AS currency
  FROM
    public.token_usage
  WHERE
    user_id = user_id_param
    AND (start_date_param IS NULL OR timestamp >= start_date_param)
    AND (end_date_param IS NULL OR timestamp <= end_date_param);
END;
$$;

-- Create function to get token usage by service
CREATE OR REPLACE FUNCTION get_token_usage_by_service(
  user_id_param UUID,
  start_date_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
) 
RETURNS TABLE (
  service_id TEXT,
  service_name TEXT,
  total_tokens BIGINT,
  total_cost DECIMAL(10,6),
  request_count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tu.service_id,
    s.name AS service_name,
    SUM(tu.tokens_used)::BIGINT AS total_tokens,
    SUM(tu.cost)::DECIMAL(10,6) AS total_cost,
    COUNT(*)::BIGINT AS request_count
  FROM
    public.token_usage tu
  JOIN
    public.services s ON tu.service_id = s.id
  WHERE
    tu.user_id = user_id_param
    AND (start_date_param IS NULL OR tu.timestamp >= start_date_param)
    AND (end_date_param IS NULL OR tu.timestamp <= end_date_param)
  GROUP BY
    tu.service_id, s.name;
END;
$$;

-- Create function to get token usage by model
CREATE OR REPLACE FUNCTION get_token_usage_by_model(
  user_id_param UUID,
  start_date_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
) 
RETURNS TABLE (
  model TEXT,
  total_tokens BIGINT,
  total_cost DECIMAL(10,6),
  request_count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(tu.model, 'unknown') AS model,
    SUM(tu.tokens_used)::BIGINT AS total_tokens,
    SUM(tu.cost)::DECIMAL(10,6) AS total_cost,
    COUNT(*)::BIGINT AS request_count
  FROM
    public.token_usage tu
  WHERE
    tu.user_id = user_id_param
    AND (start_date_param IS NULL OR tu.timestamp >= start_date_param)
    AND (end_date_param IS NULL OR tu.timestamp <= end_date_param)
  GROUP BY
    tu.model;
END;
$$;

-- Update token usage policies
CREATE POLICY "Users can insert their own token usage" ON public.token_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);