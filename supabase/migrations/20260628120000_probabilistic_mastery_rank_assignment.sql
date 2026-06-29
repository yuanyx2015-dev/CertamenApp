-- =====================================================================
-- Difficulty-weighted mastery-rank assignment
--
-- Replaces the old deterministic "first 1,100 questions sorted by
-- difficulty then category, 100 per rank" scheme (which clustered
-- categories alphabetically and stranded any question past 1,100).
--
-- New model: each question belongs to ONE of the 11 ranks
-- (0 = Miles .. 10 = Legatus Legionis). Difficulty decides the spread
-- of ranks a question can land in; category is never considered, so
-- categories mix evenly within every rank.
--
--   easy   -> ranks 0..5  (Miles..Aquilifer), weighted toward Miles
--   hard   -> ranks 5..10 (Aquilifer..Legatus), weighted toward Legatus
--   medium -> any rank, sized to keep every rank ~equal (~109 each)
--
-- Two assignment paths share ONE weight definition
-- (mastery_rank_weights):
--   * New questions: a BEFORE-INSERT trigger rolls a rank ONCE via a
--     weighted RANDOM draw, then never touches it again (editing a
--     question later does not move it).
--   * Existing questions: a one-time, DETERMINISTIC backfill (bottom of
--     file) places exactly the target count in each rank (no random
--     size variance, so no outliers) while still randomizing WHICH
--     question lands where (categories stay mixed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Single source of truth for the per-rank weights, by difficulty.
--    Array position i corresponds to rank (i - 1); ranks 0..10.
--
--    Weights are sized so that, given the current difficulty mix, every
--    rank holds ~109 questions (1,197 / 11 = 108.8) while preserving the
--    difficulty ramp. To re-tune after the mix shifts a lot: keep easy
--    monotonically decreasing, hard monotonically increasing, and set
--    medium ~ (avg - easy - hard) per rank.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mastery_rank_weights(p_difficulty text)
RETURNS int[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_difficulty, ''))
    WHEN 'easy' THEN ARRAY[90,78,67,55,44,34, 0, 0, 0, 0,  0]
    WHEN 'hard' THEN ARRAY[ 0, 0, 0, 0, 0,40,53,67,80,93,107]
    ELSE              ARRAY[19,31,42,54,64,35,55,42,29,16,  2]  -- medium / other
  END;
$$;

-- ---------------------------------------------------------------------
-- 2a. Weighted RANDOM pick — used by the insert trigger for new
--     questions. One independent draw per question.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_mastery_rank(p_difficulty text)
RETURNS smallint
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  w     int[] := public.mastery_rank_weights(p_difficulty);
  total bigint;
  draw  double precision;
  acc   bigint := 0;
  i     int;
BEGIN
  SELECT sum(x) INTO total FROM unnest(w) AS x;
  draw := random() * total;
  FOR i IN 1 .. array_length(w, 1) LOOP
    acc := acc + w[i];
    IF draw < acc THEN
      RETURN (i - 1)::smallint;
    END IF;
  END LOOP;
  RETURN (array_length(w, 1) - 1)::smallint;  -- rounding fallback
END;
$$;

-- ---------------------------------------------------------------------
-- 2b. DETERMINISTIC rank at a fraction in [0,1) — used by the backfill.
--     Mapping a question's evenly-spaced position through the weight
--     CDF yields exact per-rank counts (no random size variance).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mastery_rank_at_fraction(
  p_difficulty text,
  p_fraction   double precision
)
RETURNS smallint
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  w      int[] := public.mastery_rank_weights(p_difficulty);
  total  bigint;
  target double precision;
  acc    bigint := 0;
  i      int;
BEGIN
  SELECT sum(x) INTO total FROM unnest(w) AS x;
  target := greatest(0.0, least(p_fraction, 0.9999999)) * total;
  FOR i IN 1 .. array_length(w, 1) LOOP
    acc := acc + w[i];
    IF target < acc THEN
      RETURN (i - 1)::smallint;
    END IF;
  END LOOP;
  RETURN (array_length(w, 1) - 1)::smallint;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Trigger: assign a rank ONCE, on insert, then leave it alone.
--    Only fills mastery_rank / pool_order when they aren't already set,
--    so a caller may pre-set them, and later edits never move a question.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_mastery_rank_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mastery_rank IS NULL THEN
    NEW.mastery_rank := public.pick_mastery_rank(NEW.difficulty);
  END IF;
  IF NEW.pool_order IS NULL THEN
    NEW.pool_order := (floor(random() * 32767))::smallint;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_mastery_rank ON public.questions;
CREATE TRIGGER trg_assign_mastery_rank
  BEFORE INSERT ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_mastery_rank_on_insert();

-- ---------------------------------------------------------------------
-- 4. pool_order is now a random per-rank serving order (not a fixed
--    1..100 slot), so its values are no longer unique within a rank.
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS public.questions_mastery_rank_pool_order_unique;

COMMENT ON COLUMN public.questions.mastery_rank IS
  'Challenge rank 0..10 (Miles..Legatus Legionis), assigned by difficulty (see mastery_rank_weights). Every question is assigned.';
COMMENT ON COLUMN public.questions.pool_order IS
  'Random serving order within a mastery_rank (lower served first while unseen). No longer a fixed 1..100 slot.';

-- ---------------------------------------------------------------------
-- 5. One-time DETERMINISTIC baseline backfill.
--    Within each difficulty, shuffle the questions (ORDER BY random()),
--    give each an evenly-spaced fraction, and map it through the weight
--    CDF. Result: exact per-rank counts (~109 each, no outliers),
--    random categories, and EVERY question assigned regardless of the
--    actual difficulty counts. Runs once; the trigger above is
--    INSERT-only so this UPDATE won't fire it. User mastery/wrong rows
--    are keyed by question id, so progress is preserved.
--
--    Delete this block if you'd rather leave existing questions in their
--    current ranks and only apply the new scheme to future inserts.
-- ---------------------------------------------------------------------
WITH q AS (
  SELECT
    id,
    difficulty,
    (row_number() OVER (PARTITION BY lower(difficulty) ORDER BY random()) - 0.5)
      / NULLIF(count(*) OVER (PARTITION BY lower(difficulty)), 0) AS fraction
  FROM public.questions
)
UPDATE public.questions t
SET mastery_rank = public.mastery_rank_at_fraction(t.difficulty, q.fraction),
    pool_order   = (floor(random() * 32767))::smallint
FROM q
WHERE t.id = q.id;
