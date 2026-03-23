-- Create table to track AI tutor usage per user per day
CREATE TABLE IF NOT EXISTS public.ai_tutor_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  question_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS ai_tutor_usage_user_date_idx ON public.ai_tutor_usage(user_id, usage_date);

-- Enable Row Level Security
ALTER TABLE public.ai_tutor_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own usage
CREATE POLICY "Users can view own usage" ON public.ai_tutor_usage
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- RLS Policy: Users can insert their own usage
CREATE POLICY "Users can insert own usage" ON public.ai_tutor_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- RLS Policy: Users can update their own usage
CREATE POLICY "Users can update own usage" ON public.ai_tutor_usage
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Function to get or create today's usage record
CREATE OR REPLACE FUNCTION public.get_ai_tutor_usage(p_user_id TEXT)
RETURNS TABLE (
  question_count INTEGER,
  remaining_questions INTEGER
) AS $$
DECLARE
  v_count INTEGER;
  v_max_questions INTEGER := 2; -- Daily limit for custom questions
BEGIN
  -- Get today's usage count
  SELECT COALESCE(usg.question_count, 0)
  INTO v_count
  FROM public.ai_tutor_usage usg
  WHERE usg.user_id = p_user_id
    AND usg.usage_date = CURRENT_DATE;
  
  -- If no record exists, return 0
  IF v_count IS NULL THEN
    v_count := 0;
  END IF;
  
  RETURN QUERY SELECT 
    v_count,
    GREATEST(0, v_max_questions - v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION public.increment_ai_tutor_usage(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_max_questions INTEGER := 2; -- Daily limit for custom questions
BEGIN
  -- Get current count
  SELECT question_count INTO v_current_count
  FROM public.ai_tutor_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE;
  
  -- Check if limit reached
  IF v_current_count >= v_max_questions THEN
    RETURN FALSE;
  END IF;
  
  -- Insert or update usage
  INSERT INTO public.ai_tutor_usage (user_id, usage_date, question_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET 
    question_count = public.ai_tutor_usage.question_count + 1,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_ai_tutor_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_tutor_usage(TEXT) TO authenticated;
