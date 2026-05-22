-- =====================================================================
-- Challenge Mode foundation (idempotent — safe to run multiple times):
--   * user_mastered_answers : terminal state, never asked again.
--   * user_passed_answers   : right-but-not-mastered, asked LAST in pool.
--   * user_wrong_answers    : (existing) only asked in Review tab.
--   * user_stats streak cols: daily streak + highest streak.
--   * RPCs for atomic state transitions and pool reads.
--
-- The three state tables are mutually exclusive for a given (user, question).
-- A question with no row in any of them is "Unseen".
-- User-facing "Unmastered" = Unseen + Passed.
-- =====================================================================


-- =====================================================================
-- 1. user_mastered_answers
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_mastered_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions (id) ON DELETE CASCADE,
  mastered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_mastered_answers_user_question_unique UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS user_mastered_answers_user_idx
  ON public.user_mastered_answers (user_id);

CREATE INDEX IF NOT EXISTS user_mastered_answers_question_idx
  ON public.user_mastered_answers (question_id);

COMMENT ON TABLE public.user_mastered_answers IS
  'Per-user mastered questions (terminal state). Mutually exclusive with user_wrong_answers and user_passed_answers.';

ALTER TABLE public.user_mastered_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_mastered_answers_select_own ON public.user_mastered_answers;
CREATE POLICY user_mastered_answers_select_own
  ON public.user_mastered_answers
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_mastered_answers_insert_own ON public.user_mastered_answers;
CREATE POLICY user_mastered_answers_insert_own
  ON public.user_mastered_answers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_mastered_answers_delete_own ON public.user_mastered_answers;
CREATE POLICY user_mastered_answers_delete_own
  ON public.user_mastered_answers
  FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================================
-- 2. user_passed_answers
--    A "passed" question is one the user has answered correctly but
--    has not yet mastered. It re-enters the Challenge pool LAST.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_passed_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions (id) ON DELETE CASCADE,
  passed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pass_count INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT user_passed_answers_user_question_unique UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS user_passed_answers_user_idx
  ON public.user_passed_answers (user_id);

CREATE INDEX IF NOT EXISTS user_passed_answers_user_passed_at_idx
  ON public.user_passed_answers (user_id, passed_at);

COMMENT ON TABLE public.user_passed_answers IS
  'Per-user right-but-not-mastered questions. Drives persistent re-queue in Challenge Mode.';

ALTER TABLE public.user_passed_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_passed_answers_select_own ON public.user_passed_answers;
CREATE POLICY user_passed_answers_select_own
  ON public.user_passed_answers
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_passed_answers_insert_own ON public.user_passed_answers;
CREATE POLICY user_passed_answers_insert_own
  ON public.user_passed_answers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_passed_answers_update_own ON public.user_passed_answers;
CREATE POLICY user_passed_answers_update_own
  ON public.user_passed_answers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_passed_answers_delete_own ON public.user_passed_answers;
CREATE POLICY user_passed_answers_delete_own
  ON public.user_passed_answers
  FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================================
-- 3. user_stats: streak columns
-- =====================================================================
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS highest_streak INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS last_activity_date DATE;

COMMENT ON COLUMN public.user_stats.current_streak IS
  'Daily streak count. Increments first time the user takes any action on a new calendar day; resets to 1 if a day was skipped.';

COMMENT ON COLUMN public.user_stats.highest_streak IS
  'All-time longest streak the user has reached. Never decreases.';


-- =====================================================================
-- 4. bump_user_streak
--    Idempotent: first action of the day -> +1 (or reset to 1 if a day was skipped).
--    Same-day repeat calls do nothing. highest_streak updated when current exceeds it.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.bump_user_streak(p_user_id UUID)
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
  v_today DATE := CURRENT_DATE;
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
  ELSIF v_last = v_today THEN
    NULL; -- already counted today
  ELSIF v_last = v_today - INTERVAL '1 day' THEN
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
      last_activity_date = v_today
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_streak, v_high, v_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_user_streak(UUID) TO authenticated;


-- =====================================================================
-- 5. decay_user_streaks
--    Call once per day (cron / scheduled edge function).
--    Resets current_streak to 0 for users whose last_activity_date is older than yesterday.
--    highest_streak is preserved.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.decay_user_streaks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE public.user_stats
    SET current_streak = 0
    WHERE current_streak > 0
      AND (last_activity_date IS NULL OR last_activity_date < CURRENT_DATE - INTERVAL '1 day')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM decayed;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decay_user_streaks() TO service_role;


-- =====================================================================
-- 6. master_question
--    Atomic: removes from wrong + passed, inserts (or no-ops) into mastered.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.master_question(p_user_id UUID, p_question_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_wrong_answers
    WHERE user_id = p_user_id AND question_id = p_question_id;

  DELETE FROM public.user_passed_answers
    WHERE user_id = p_user_id AND question_id = p_question_id;

  INSERT INTO public.user_mastered_answers (user_id, question_id)
  VALUES (p_user_id, p_question_id)
  ON CONFLICT (user_id, question_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.master_question(UUID, UUID) TO authenticated;


-- =====================================================================
-- 7. mark_wrong_question
--    Atomic: removes from mastered + passed, upserts into wrong with counters bumped.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mark_wrong_question(p_user_id UUID, p_question_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_mastered_answers
    WHERE user_id = p_user_id AND question_id = p_question_id;

  DELETE FROM public.user_passed_answers
    WHERE user_id = p_user_id AND question_id = p_question_id;

  INSERT INTO public.user_wrong_answers (user_id, question_id, times_wrong, times_attempted, last_wrong_at)
  VALUES (p_user_id, p_question_id, 1, 1, NOW())
  ON CONFLICT (user_id, question_id) DO UPDATE
    SET times_wrong = public.user_wrong_answers.times_wrong + 1,
        times_attempted = public.user_wrong_answers.times_attempted + 1,
        last_wrong_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_wrong_question(UUID, UUID) TO authenticated;


-- =====================================================================
-- 8. record_passed_question
--    Atomic: removes from mastered + wrong (defensive), upserts into passed
--    with passed_at = NOW() so it queues to the BACK of the unmastered pool.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.record_passed_question(p_user_id UUID, p_question_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_mastered_answers
    WHERE user_id = p_user_id AND question_id = p_question_id;

  DELETE FROM public.user_wrong_answers
    WHERE user_id = p_user_id AND question_id = p_question_id;

  INSERT INTO public.user_passed_answers (user_id, question_id, passed_at, pass_count)
  VALUES (p_user_id, p_question_id, NOW(), 1)
  ON CONFLICT (user_id, question_id) DO UPDATE
    SET passed_at = NOW(),
        pass_count = public.user_passed_answers.pass_count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_passed_question(UUID, UUID) TO authenticated;


-- =====================================================================
-- 9. get_difficulty_stats
--    Per-difficulty counts: total / mastered / wrong / unmastered (= total - mastered - wrong).
--    Unmastered here is the USER-FACING count and includes both Unseen and Passed.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_difficulty_stats(p_user_id UUID)
RETURNS TABLE (
  difficulty TEXT,
  total_questions BIGINT,
  mastered BIGINT,
  wrong BIGINT,
  unmastered BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH totals AS (
    SELECT q.difficulty AS difficulty, COUNT(*)::BIGINT AS total
    FROM public.questions q
    GROUP BY q.difficulty
  ),
  mastered_counts AS (
    SELECT q.difficulty AS difficulty, COUNT(*)::BIGINT AS cnt
    FROM public.user_mastered_answers uma
    JOIN public.questions q ON q.id = uma.question_id
    WHERE uma.user_id = p_user_id
    GROUP BY q.difficulty
  ),
  wrong_counts AS (
    SELECT q.difficulty AS difficulty, COUNT(*)::BIGINT AS cnt
    FROM public.user_wrong_answers uwa
    JOIN public.questions q ON q.id = uwa.question_id
    WHERE uwa.user_id = p_user_id
    GROUP BY q.difficulty
  )
  SELECT
    t.difficulty::TEXT,
    t.total,
    COALESCE(mc.cnt, 0) AS mastered,
    COALESCE(wc.cnt, 0) AS wrong,
    GREATEST(t.total - COALESCE(mc.cnt, 0) - COALESCE(wc.cnt, 0), 0) AS unmastered
  FROM totals t
  LEFT JOIN mastered_counts mc ON mc.difficulty = t.difficulty
  LEFT JOIN wrong_counts wc ON wc.difficulty = t.difficulty;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_difficulty_stats(UUID) TO authenticated;


-- =====================================================================
-- 10. get_unmastered_questions
--     Pulls Challenge Mode pool for a given difficulty.
--     ORDER: Unseen first (random), then Passed by oldest passed_at first
--            (so the right-but-not-mastered question only re-appears after every other
--             unmastered question in this difficulty has been served).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_unmastered_questions(
  p_user_id UUID,
  p_difficulty TEXT,
  p_limit INTEGER
)
RETURNS SETOF public.questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM public.questions q
  LEFT JOIN public.user_passed_answers upa
    ON upa.user_id = p_user_id AND upa.question_id = q.id
  WHERE q.difficulty = p_difficulty
    AND NOT EXISTS (
      SELECT 1 FROM public.user_mastered_answers uma
       WHERE uma.user_id = p_user_id AND uma.question_id = q.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_wrong_answers uwa
       WHERE uwa.user_id = p_user_id AND uwa.question_id = q.id
    )
  ORDER BY
    upa.passed_at ASC NULLS FIRST, -- Unseen (NULL) come first, then Passed oldest-first
    RANDOM()                       -- random tiebreak within each group
  LIMIT GREATEST(p_limit, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unmastered_questions(UUID, TEXT, INTEGER) TO authenticated;
