-- Streak days follow the user's device calendar (client passes local YYYY-MM-DD).

DROP FUNCTION IF EXISTS public.bump_user_streak(UUID);

CREATE OR REPLACE FUNCTION public.bump_user_streak(
  p_user_id UUID,
  p_today DATE
)
RETURNS TABLE (
  current_streak INTEGER,
  highest_streak INTEGER,
  last_activity_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last DATE;
  v_streak INTEGER;
  v_high INTEGER;
BEGIN
  SELECT us.last_activity_date, us.current_streak, us.highest_streak
    INTO v_last, v_streak, v_high
  FROM public.user_stats us
  WHERE us.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_streak := COALESCE(v_streak, 0);
  v_high := COALESCE(v_high, 0);

  IF v_last IS NULL THEN
    v_streak := 1;
  ELSIF v_last = p_today THEN
    NULL; -- already counted today
  ELSIF v_last = p_today - INTERVAL '1 day' THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  IF v_streak > v_high THEN
    v_high := v_streak;
  END IF;

  UPDATE public.user_stats
  SET current_streak = v_streak,
      highest_streak = v_high,
      last_activity_date = p_today
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_streak, v_high, p_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_user_streak(UUID, DATE) TO authenticated;
