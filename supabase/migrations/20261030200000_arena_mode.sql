-- Arena (live 1v1).
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Also turn on Authentication → Providers → Anonymous sign-ins, or guests
-- cannot enter a match.
--
-- Record:
--   win    → wins + 1, games_played + 1
--   loss   → games_played + 1
--   tie    → ties + 1 only (wins and games_played stay put)
--   forfeit → forfeiter: games_played + 1, forfeits + 1, and a notice
--             opponent: a normal win
-- Anonymous accounts never change those numbers. A forfeit notice can still
-- be stored for them so the app can explain it on the next open.
--
-- Clients may read a match they are in. Points, buzzes, and the question
-- draw change only through these functions.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.arena_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  ties integer NOT NULL DEFAULT 0 CHECK (ties >= 0),
  forfeits integer NOT NULL DEFAULT 0 CHECK (forfeits >= 0),
  pending_forfeit_notice boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.arena_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  host_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  guest_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  host_name text NOT NULL,
  guest_name text,
  is_random boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'countdown', 'live', 'finished')),
  phase text NOT NULL DEFAULT 'lobby'
    CHECK (phase IN (
      'lobby', 'countdown', 'reading', 'answering', 'rebound',
      'reveal', 'scoreboard', 'final'
    )),
  settings jsonb NOT NULL,
  q_index integer NOT NULL DEFAULT 0 CHECK (q_index >= 0),
  q_count integer NOT NULL DEFAULT 0 CHECK (q_count >= 0),
  stream_anchor timestamptz,
  stream_from integer NOT NULL DEFAULT 0 CHECK (stream_from >= 0),
  stream_ms integer NOT NULL DEFAULT 50 CHECK (stream_ms >= 8),
  pre_buzz_seconds integer NOT NULL DEFAULT 10 CHECK (pre_buzz_seconds BETWEEN 3 AND 60),
  answer_seconds integer NOT NULL DEFAULT 5 CHECK (answer_seconds BETWEEN 3 AND 30),
  buzz_user uuid,
  buzz_at timestamptz,
  buzz_char integer,
  first_buzz_user uuid,
  host_score integer NOT NULL DEFAULT 0 CHECK (host_score >= 0),
  guest_score integer NOT NULL DEFAULT 0 CHECK (guest_score >= 0),
  host_answered boolean NOT NULL DEFAULT false,
  guest_answered boolean NOT NULL DEFAULT false,
  host_next boolean NOT NULL DEFAULT false,
  guest_next boolean NOT NULL DEFAULT false,
  next_deadline timestamptz,
  host_rematch boolean NOT NULL DEFAULT false,
  guest_rematch boolean NOT NULL DEFAULT false,
  host_here boolean NOT NULL DEFAULT true,
  guest_here boolean NOT NULL DEFAULT false,
  countdown_at timestamptz,
  result text CHECK (result IS NULL OR result IN (
    'host_win', 'guest_win', 'tie', 'host_forfeit', 'guest_forfeit', 'double_forfeit'
  )),
  stats_applied boolean NOT NULL DEFAULT false,
  last_resolution jsonb,
  state_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  CONSTRAINT arena_matches_host_name_len CHECK (char_length(host_name) BETWEEN 1 AND 32),
  CONSTRAINT arena_matches_guest_name_len CHECK (
    guest_name IS NULL OR char_length(guest_name) BETWEEN 1 AND 32
  )
);

-- Question ids and the current choice order. Hidden from the client API.
CREATE TABLE IF NOT EXISTS public.arena_match_secrets (
  match_id uuid PRIMARY KEY REFERENCES public.arena_matches (id) ON DELETE CASCADE,
  question_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  options text[],
  correct_index integer
);

CREATE TABLE IF NOT EXISTS public.arena_presence (
  match_id uuid NOT NULL REFERENCES public.arena_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.arena_queue (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  enqueued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT arena_queue_name_len CHECK (char_length(display_name) BETWEEN 1 AND 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS arena_matches_open_code_uidx
  ON public.arena_matches (code)
  WHERE status IN ('lobby', 'countdown', 'live');

CREATE INDEX IF NOT EXISTS arena_matches_host_idx ON public.arena_matches (host_id);
CREATE INDEX IF NOT EXISTS arena_matches_guest_idx ON public.arena_matches (guest_id);
CREATE INDEX IF NOT EXISTS arena_queue_enqueued_idx ON public.arena_queue (enqueued_at);

CREATE OR REPLACE FUNCTION public.arena_bump_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.state_version := COALESCE(OLD.state_version, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arena_matches_bump_version ON public.arena_matches;
CREATE TRIGGER arena_matches_bump_version
  BEFORE UPDATE ON public.arena_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.arena_bump_version();

ALTER TABLE public.arena_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_match_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arena_stats_select_own ON public.arena_stats;
CREATE POLICY arena_stats_select_own
  ON public.arena_stats
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS arena_matches_select_participant ON public.arena_matches;
CREATE POLICY arena_matches_select_participant
  ON public.arena_matches
  FOR SELECT
  TO authenticated
  USING (host_id = auth.uid() OR guest_id = auth.uid());

REVOKE ALL ON TABLE public.arena_stats FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.arena_matches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.arena_match_secrets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.arena_presence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.arena_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.arena_stats TO authenticated;
GRANT SELECT ON TABLE public.arena_matches TO authenticated;

ALTER TABLE public.arena_matches REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'arena_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_matches;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Names, guests, Roman codes, settings, question draw
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.arena_clean_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := trim(COALESCE(p_name, ''));
BEGIN
  IF char_length(v) < 1 OR char_length(v) > 32 THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_is_guest(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v boolean;
BEGIN
  IF p_uid IS NULL THEN
    RETURN true;
  END IF;
  SELECT COALESCE(u.is_anonymous, false)
    INTO v
  FROM auth.users u
  WHERE u.id = p_uid;
  RETURN COALESCE(v, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_roman_value(p_ch text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(p_ch)
    WHEN 'I' THEN 1
    WHEN 'V' THEN 5
    WHEN 'X' THEN 10
    WHEN 'L' THEN 50
    WHEN 'C' THEN 100
    WHEN 'D' THEN 500
    WHEN 'M' THEN 1000
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.arena_to_roman(p_n integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  vals integer[] := ARRAY[1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  syms text[] := ARRAY['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  i integer;
  v integer := p_n;
  res text := '';
BEGIN
  IF p_n IS NULL OR p_n < 1 OR p_n > 3999 THEN
    RETURN NULL;
  END IF;
  FOR i IN 1..array_length(vals, 1) LOOP
    WHILE v >= vals[i] LOOP
      res := res || syms[i];
      v := v - vals[i];
    END LOOP;
  END LOOP;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_from_roman(p_text text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := upper(trim(COALESCE(p_text, '')));
  i integer := 1;
  n integer := char_length(s);
  total integer := 0;
  cur integer;
  nxt integer;
BEGIN
  IF n < 1 THEN
    RETURN NULL;
  END IF;
  WHILE i <= n LOOP
    cur := public.arena_roman_value(substr(s, i, 1));
    IF cur IS NULL THEN
      RETURN NULL;
    END IF;
    IF i < n THEN
      nxt := public.arena_roman_value(substr(s, i + 1, 1));
      IF nxt IS NULL THEN
        RETURN NULL;
      END IF;
      IF nxt > cur THEN
        total := total + (nxt - cur);
        i := i + 2;
        CONTINUE;
      END IF;
    END IF;
    total := total + cur;
    i := i + 1;
  END LOOP;
  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_valid_code(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := upper(trim(COALESCE(p_text, '')));
  n integer;
BEGIN
  IF char_length(s) <> 7 THEN
    RETURN NULL;
  END IF;
  n := public.arena_from_roman(s);
  IF n IS NULL OR public.arena_to_roman(n) IS DISTINCT FROM s THEN
    RETURN NULL;
  END IF;
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_new_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_code text;
  v_try integer := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    IF v_try > 40 THEN
      RETURN NULL;
    END IF;
    SELECT public.arena_to_roman(g.n)
      INTO v_code
    FROM generate_series(1, 3999) AS g(n)
    WHERE char_length(public.arena_to_roman(g.n)) = 7
    ORDER BY random()
    LIMIT 1;

    IF v_code IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.arena_matches m
      WHERE m.code = v_code
        AND m.status IN ('lobby', 'countdown', 'live')
    ) THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_text_list(p_value jsonb, p_allowed text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT item ORDER BY item), ARRAY[]::text[])
  FROM jsonb_array_elements_text(COALESCE(p_value, '[]'::jsonb)) AS t(item)
  WHERE item = ANY (p_allowed);
$$;

CREATE OR REPLACE FUNCTION public.arena_normalize_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count integer;
  v_pre integer;
  v_answer integer;
  v_speed numeric;
  v_snapped numeric;
  v_diffs text[];
  v_cats text[];
  v_diff_in integer;
  v_cat_in integer;
BEGIN
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Match settings are missing.');
  END IF;

  BEGIN
    v_count := (p_settings->>'question_count')::integer;
    v_pre := (p_settings->>'pre_buzz_seconds')::integer;
    v_answer := (p_settings->>'answer_seconds')::integer;
    v_speed := (p_settings->>'reading_speed')::numeric;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Match settings are not valid numbers.');
  END;

  IF v_count IS NULL OR v_count < 5 OR v_count > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A round is 5 to 50 questions.');
  END IF;
  IF v_pre IS NULL OR v_pre < 3 OR v_pre > 60 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The buzz timer is 3 to 60 seconds.');
  END IF;
  IF v_answer IS NULL OR v_answer < 3 OR v_answer > 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The answer timer is 3 to 30 seconds.');
  END IF;

  SELECT s
    INTO v_snapped
  FROM unnest(ARRAY[0.25, 0.5, 0.75, 1, 1.5, 2, 2.5]::numeric[]) AS s
  WHERE abs(s - v_speed) < 0.001
  LIMIT 1;
  IF v_snapped IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reading speed is not one of the allowed steps.');
  END IF;

  v_diffs := public.arena_text_list(
    p_settings->'difficulties',
    ARRAY['easy', 'medium', 'hard']
  );
  v_cats := public.arena_text_list(
    p_settings->'categories',
    ARRAY['mythology', 'history', 'language', 'literature', 'culture-life', 'living-latin']
  );
  v_diff_in := jsonb_array_length(COALESCE(p_settings->'difficulties', '[]'::jsonb));
  v_cat_in := jsonb_array_length(COALESCE(p_settings->'categories', '[]'::jsonb));
  IF v_diff_in < 1 OR cardinality(v_diffs) <> v_diff_in THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick at least one real difficulty.');
  END IF;
  IF v_cat_in < 1 OR cardinality(v_cats) <> v_cat_in THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick at least one real category.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'settings', jsonb_build_object(
      'question_count', v_count,
      'reading_speed', v_snapped,
      'pre_buzz_seconds', v_pre,
      'answer_seconds', v_answer,
      'difficulties', to_jsonb(v_diffs),
      'categories', to_jsonb(v_cats)
    ),
    'stream_ms', greatest(8, round(50.0 / v_snapped)::integer)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_playable_ids(p_cats text[], p_diffs text[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id
  FROM public.questions q
  WHERE q.category = ANY (p_cats)
    AND lower(q.difficulty) = ANY (p_diffs)
    AND q.question_text IS NOT NULL
    AND char_length(trim(q.question_text)) > 0
    AND q.correct_answer IS NOT NULL
    AND char_length(trim(q.correct_answer)) > 0
    AND q.wrong_answers IS NOT NULL
    AND cardinality(q.wrong_answers) >= 3
    AND char_length(trim(q.wrong_answers[1])) > 0
    AND char_length(trim(q.wrong_answers[2])) > 0
    AND char_length(trim(q.wrong_answers[3])) > 0;
$$;

CREATE OR REPLACE FUNCTION public.arena_available(p_settings jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cats text[];
  v_diffs text[];
  v_n integer;
BEGIN
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO v_cats
  FROM jsonb_array_elements_text(p_settings->'categories') AS t(value);
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO v_diffs
  FROM jsonb_array_elements_text(p_settings->'difficulties') AS t(value);
  SELECT count(*)::integer
    INTO v_n
  FROM public.arena_playable_ids(v_cats, v_diffs) AS id;
  RETURN COALESCE(v_n, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_pick_questions(p_settings jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cats text[];
  v_diffs text[];
  v_want integer;
  v_available integer;
  v_n integer;
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO v_cats
  FROM jsonb_array_elements_text(p_settings->'categories') AS t(value);
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
    INTO v_diffs
  FROM jsonb_array_elements_text(p_settings->'difficulties') AS t(value);
  v_want := (p_settings->>'question_count')::integer;
  SELECT count(*)::integer INTO v_available FROM public.arena_playable_ids(v_cats, v_diffs) AS id;
  IF v_available < 5 OR v_want IS NULL OR v_want < 5 THEN
    RETURN NULL;
  END IF;
  v_n := least(v_want, 50, v_available);
  SELECT COALESCE(array_agg(s.id ORDER BY s.ord), ARRAY[]::uuid[])
    INTO v_ids
  FROM (
    SELECT shuffled.id, row_number() OVER () AS ord
    FROM (
      SELECT playable.id
      FROM public.arena_playable_ids(v_cats, v_diffs) AS playable(id)
      ORDER BY random()
      LIMIT v_n
    ) AS shuffled
  ) AS s;
  IF cardinality(v_ids) < 5 THEN
    RETURN NULL;
  END IF;
  RETURN v_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_default_settings()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "question_count": 20,
    "reading_speed": 1,
    "pre_buzz_seconds": 10,
    "answer_seconds": 5,
    "difficulties": ["easy", "medium", "hard"],
    "categories": ["mythology", "history", "language", "literature", "culture-life", "living-latin"]
  }'::jsonb;
$$;

-- ---------------------------------------------------------------------
-- Match mutations
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.arena_add_stat(
  p_uid uuid,
  p_wins integer,
  p_games integer,
  p_ties integer,
  p_forfeits integer,
  p_notice boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RETURN;
  END IF;
  IF public.arena_is_guest(p_uid) THEN
    IF p_notice THEN
      INSERT INTO public.arena_stats (user_id, pending_forfeit_notice)
      VALUES (p_uid, true)
      ON CONFLICT (user_id) DO UPDATE
        SET pending_forfeit_notice = true,
            updated_at = clock_timestamp();
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.arena_stats AS s (
    user_id, wins, games_played, ties, forfeits, pending_forfeit_notice
  )
  VALUES (
    p_uid,
    GREATEST(p_wins, 0),
    GREATEST(p_games, 0),
    GREATEST(p_ties, 0),
    GREATEST(p_forfeits, 0),
    COALESCE(p_notice, false)
  )
  ON CONFLICT (user_id) DO UPDATE
    SET wins = s.wins + GREATEST(p_wins, 0),
        games_played = s.games_played + GREATEST(p_games, 0),
        ties = s.ties + GREATEST(p_ties, 0),
        forfeits = s.forfeits + GREATEST(p_forfeits, 0),
        pending_forfeit_notice = s.pending_forfeit_notice OR COALESCE(p_notice, false),
        updated_at = clock_timestamp();
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_finish(p_match_id uuid, p_result text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
BEGIN
  SELECT * INTO m
  FROM public.arena_matches
  WHERE id = p_match_id
  FOR UPDATE;
  IF NOT FOUND OR m.stats_applied OR m.status = 'finished' THEN
    RETURN;
  END IF;
  IF m.status NOT IN ('countdown', 'live') THEN
    RETURN;
  END IF;

  IF p_result = 'host_win' THEN
    PERFORM public.arena_add_stat(m.host_id, 1, 1, 0, 0, false);
    PERFORM public.arena_add_stat(m.guest_id, 0, 1, 0, 0, false);
  ELSIF p_result = 'guest_win' THEN
    PERFORM public.arena_add_stat(m.guest_id, 1, 1, 0, 0, false);
    PERFORM public.arena_add_stat(m.host_id, 0, 1, 0, 0, false);
  ELSIF p_result = 'tie' THEN
    PERFORM public.arena_add_stat(m.host_id, 0, 0, 1, 0, false);
    PERFORM public.arena_add_stat(m.guest_id, 0, 0, 1, 0, false);
  ELSIF p_result = 'host_forfeit' THEN
    PERFORM public.arena_add_stat(m.host_id, 0, 1, 0, 1, true);
    PERFORM public.arena_add_stat(m.guest_id, 1, 1, 0, 0, false);
  ELSIF p_result = 'guest_forfeit' THEN
    PERFORM public.arena_add_stat(m.guest_id, 0, 1, 0, 1, true);
    PERFORM public.arena_add_stat(m.host_id, 1, 1, 0, 0, false);
  ELSIF p_result = 'double_forfeit' THEN
    PERFORM public.arena_add_stat(m.host_id, 0, 1, 0, 1, true);
    PERFORM public.arena_add_stat(m.guest_id, 0, 1, 0, 1, true);
  ELSE
    RETURN;
  END IF;

  UPDATE public.arena_matches
  SET status = 'finished',
      phase = 'final',
      result = p_result,
      stats_applied = true,
      finished_at = clock_timestamp(),
      host_here = CASE WHEN p_result IN ('host_forfeit', 'double_forfeit') THEN false ELSE host_here END,
      guest_here = CASE WHEN p_result IN ('guest_forfeit', 'double_forfeit') THEN false ELSE guest_here END,
      host_rematch = false,
      guest_rematch = false,
      next_deadline = NULL
  WHERE id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_prepare_question(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
  s public.arena_match_secrets;
  q public.questions;
  items text[] := ARRAY[NULL, NULL, NULL, NULL];
  flags boolean[] := ARRAY[true, false, false, false];
  i integer;
  j integer;
  tmp_text text;
  tmp_flag boolean;
  v_correct integer := 0;
BEGIN
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  SELECT * INTO s FROM public.arena_match_secrets WHERE match_id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF m.q_index < 0 OR m.q_index >= cardinality(s.question_ids) THEN
    RETURN;
  END IF;

  SELECT * INTO q FROM public.questions WHERE id = s.question_ids[m.q_index + 1];
  IF NOT FOUND THEN
    RETURN;
  END IF;

  items := ARRAY[
    trim(q.correct_answer),
    trim(q.wrong_answers[1]),
    trim(q.wrong_answers[2]),
    trim(q.wrong_answers[3])
  ];
  flags := ARRAY[true, false, false, false];
  FOR i IN REVERSE 4..2 LOOP
    j := 1 + floor(random() * i)::integer;
    tmp_text := items[i];
    items[i] := items[j];
    items[j] := tmp_text;
    tmp_flag := flags[i];
    flags[i] := flags[j];
    flags[j] := tmp_flag;
  END LOOP;
  FOR i IN 1..4 LOOP
    IF flags[i] THEN
      v_correct := i - 1;
    END IF;
  END LOOP;

  UPDATE public.arena_match_secrets
  SET options = items,
      correct_index = v_correct
  WHERE match_id = p_match_id;

  UPDATE public.arena_matches
  SET phase = 'reading',
      stream_anchor = clock_timestamp(),
      stream_from = 0,
      buzz_user = NULL,
      buzz_at = NULL,
      buzz_char = NULL,
      first_buzz_user = NULL,
      host_answered = false,
      guest_answered = false,
      host_next = false,
      guest_next = false,
      next_deadline = NULL,
      last_resolution = NULL
  WHERE id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_advance(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
  v_result text;
BEGIN
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'live' OR m.phase <> 'scoreboard' THEN
    RETURN;
  END IF;

  IF m.q_index + 1 >= m.q_count THEN
    IF m.host_score > m.guest_score THEN
      v_result := 'host_win';
    ELSIF m.guest_score > m.host_score THEN
      v_result := 'guest_win';
    ELSE
      v_result := 'tie';
    END IF;
    PERFORM public.arena_finish(p_match_id, v_result);
    RETURN;
  END IF;

  UPDATE public.arena_matches
  SET q_index = m.q_index + 1
  WHERE id = p_match_id;
  PERFORM public.arena_prepare_question(p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_maybe_advance(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
BEGIN
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.phase <> 'scoreboard' THEN
    RETURN;
  END IF;
  IF m.host_next AND m.guest_next THEN
    PERFORM public.arena_advance(p_match_id);
  ELSIF (m.host_next OR m.guest_next)
    AND m.next_deadline IS NOT NULL
    AND clock_timestamp() >= m.next_deadline
  THEN
    PERFORM public.arena_advance(p_match_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_release_for_new(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
BEGIN
  SELECT * INTO m
  FROM public.arena_matches
  WHERE status IN ('lobby', 'countdown', 'live')
    AND (host_id = p_uid OR guest_id = p_uid)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF m.status IN ('countdown', 'live') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You are already in a match.');
    END IF;
    IF m.host_id = p_uid AND m.guest_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Leave your open lobby before starting another.');
    END IF;
    IF m.host_id = p_uid THEN
      DELETE FROM public.arena_matches WHERE id = m.id;
    ELSE
      UPDATE public.arena_matches
      SET guest_id = NULL,
          guest_name = NULL,
          guest_here = false
      WHERE id = m.id;
      DELETE FROM public.arena_presence
      WHERE match_id = m.id AND user_id = p_uid;
    END IF;
  END IF;

  UPDATE public.arena_matches
  SET host_here = CASE WHEN host_id = p_uid THEN false ELSE host_here END,
      guest_here = CASE WHEN guest_id = p_uid THEN false ELSE guest_here END,
      host_rematch = CASE WHEN host_id = p_uid THEN false ELSE host_rematch END,
      guest_rematch = CASE WHEN guest_id = p_uid THEN false ELSE guest_rematch END
  WHERE status = 'finished'
    AND (host_id = p_uid OR guest_id = p_uid);

  DELETE FROM public.arena_queue WHERE user_id = p_uid;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_see(p_match_id uuid, p_uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.arena_presence (match_id, user_id, seen_at)
  VALUES (p_match_id, p_uid, clock_timestamp())
  ON CONFLICT (match_id, user_id) DO UPDATE
    SET seen_at = clock_timestamp();
$$;

CREATE OR REPLACE FUNCTION public.arena_opponent_stale(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.seen_at < clock_timestamp() - interval '20 seconds'
      FROM public.arena_presence p
      WHERE p.match_id = p_match_id
        AND p.user_id = p_uid
    ),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.arena_question_len(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_len integer;
BEGIN
  SELECT char_length(q.question_text)
    INTO v_len
  FROM public.arena_matches m
  JOIN public.arena_match_secrets s ON s.match_id = m.id
  JOIN public.questions q ON q.id = s.question_ids[m.q_index + 1]
  WHERE m.id = p_match_id;
  RETURN COALESCE(v_len, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_read_deadline(p_match_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
  v_remaining integer;
BEGIN
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id;
  IF NOT FOUND OR m.stream_anchor IS NULL THEN
    RETURN NULL;
  END IF;
  v_remaining := greatest(public.arena_question_len(p_match_id) - m.stream_from, 0);
  RETURN m.stream_anchor
    + (v_remaining * m.stream_ms) * interval '1 millisecond'
    + make_interval(secs => m.pre_buzz_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_miss_question(p_match_id uuid, p_outcome text, p_actor text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.arena_match_secrets;
BEGIN
  SELECT * INTO s FROM public.arena_match_secrets WHERE match_id = p_match_id;
  UPDATE public.arena_matches
  SET phase = 'reveal',
      buzz_user = NULL,
      buzz_at = NULL,
      last_resolution = jsonb_build_object(
        'outcome', p_outcome,
        'actor', p_actor,
        'options', to_jsonb(s.options),
        'correct_index', s.correct_index,
        'points', 0
      )
  WHERE id = p_match_id
    AND status = 'live'
    AND phase IN ('reading', 'rebound', 'answering');
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_mark_wrong_rebound(p_match_id uuid, p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
  v_actor text;
BEGIN
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  v_actor := CASE WHEN m.host_id = p_uid THEN 'host' ELSE 'guest' END;
  UPDATE public.arena_matches
  SET phase = 'rebound',
      first_buzz_user = p_uid,
      host_answered = host_answered OR host_id = p_uid,
      guest_answered = guest_answered OR guest_id = p_uid,
      stream_from = COALESCE(buzz_char, stream_from),
      stream_anchor = clock_timestamp(),
      buzz_user = NULL,
      buzz_at = NULL,
      last_resolution = jsonb_build_object(
        'outcome', 'wrong',
        'actor', v_actor,
        'points', 0
      )
  WHERE id = p_match_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Client calls
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.arena_pool_count(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm jsonb;
  v_settings jsonb;
  v_available integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_norm := public.arena_normalize_settings(p_settings);
  IF COALESCE((v_norm->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_norm;
  END IF;
  v_settings := v_norm->'settings';
  v_available := public.arena_available(v_settings);
  RETURN jsonb_build_object(
    'ok', v_available >= 5,
    'available', v_available,
    'min', 5,
    'max', least(50, v_available),
    'error', CASE WHEN v_available >= 5 THEN NULL ELSE 'Not enough questions for that selection.' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_my_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  s public.arena_stats;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO s FROM public.arena_stats WHERE user_id = v_uid;
  IF public.arena_is_guest(v_uid) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'guest', true,
      'pending_forfeit_notice', COALESCE(s.pending_forfeit_notice, false)
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'guest', false,
    'wins', COALESCE(s.wins, 0),
    'games_played', COALESCE(s.games_played, 0),
    'ties', COALESCE(s.ties, 0),
    'forfeits', COALESCE(s.forfeits, 0),
    'pending_forfeit_notice', COALESCE(s.pending_forfeit_notice, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_dismiss_forfeit_notice()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  UPDATE public.arena_stats
  SET pending_forfeit_notice = false,
      updated_at = clock_timestamp()
  WHERE user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_create_match(p_name text, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_err jsonb;
  v_norm jsonb;
  v_settings jsonb;
  v_available integer;
  v_count integer;
  v_code text;
  v_id uuid;
  v_try integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_name := public.arena_clean_name(p_name);
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a name of 1 to 32 characters.');
  END IF;
  v_norm := public.arena_normalize_settings(p_settings);
  IF COALESCE((v_norm->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_norm;
  END IF;
  v_settings := v_norm->'settings';
  v_available := public.arena_available(v_settings);
  IF v_available < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough questions for that selection.');
  END IF;
  v_count := least((v_settings->>'question_count')::integer, v_available, 50);
  v_settings := jsonb_set(v_settings, '{question_count}', to_jsonb(v_count));

  v_err := public.arena_release_for_new(v_uid);
  IF v_err IS NOT NULL THEN
    RETURN v_err;
  END IF;

  FOR v_try IN 1..5 LOOP
    v_code := public.arena_new_code();
    IF v_code IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Could not make a room code.');
    END IF;
    BEGIN
      INSERT INTO public.arena_matches (
        code, host_id, host_name, is_random, status, phase, settings,
        stream_ms, pre_buzz_seconds, answer_seconds, host_here, guest_here
      )
      VALUES (
        v_code, v_uid, v_name, false, 'lobby', 'lobby', v_settings,
        (v_norm->>'stream_ms')::integer,
        (v_settings->>'pre_buzz_seconds')::integer,
        (v_settings->>'answer_seconds')::integer,
        true, false
      )
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_id := NULL;
    END;
  END LOOP;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not make a room code.');
  END IF;

  INSERT INTO public.arena_match_secrets (match_id) VALUES (v_id);
  PERFORM public.arena_see(v_id, v_uid);
  RETURN jsonb_build_object('ok', true, 'match_id', v_id, 'code', v_code, 'question_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_join_match(p_code text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_code text;
  v_err jsonb;
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_name := public.arena_clean_name(p_name);
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a name of 1 to 32 characters.');
  END IF;
  v_code := public.arena_valid_code(p_code);
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code is not a seven-character Roman numeral.');
  END IF;

  v_err := public.arena_release_for_new(v_uid);
  IF v_err IS NOT NULL THEN
    RETURN v_err;
  END IF;

  SELECT * INTO m
  FROM public.arena_matches
  WHERE code = v_code
    AND status = 'lobby'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No open match uses that code.');
  END IF;
  IF m.host_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are already the host of that match.');
  END IF;
  IF m.guest_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That match already has two players.');
  END IF;

  UPDATE public.arena_matches
  SET guest_id = v_uid,
      guest_name = v_name,
      guest_here = true
  WHERE id = m.id;
  PERFORM public.arena_see(m.id, v_uid);
  RETURN jsonb_build_object('ok', true, 'match_id', m.id, 'code', v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_start_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_ids uuid[];
  v_settings jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.host_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the host can start this match.');
  END IF;
  IF m.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This match has already started.');
  END IF;
  IF m.guest_id IS NULL OR m.guest_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Wait for someone to join.');
  END IF;

  v_ids := public.arena_pick_questions(m.settings);
  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough questions for that selection.');
  END IF;
  v_settings := jsonb_set(m.settings, '{question_count}', to_jsonb(cardinality(v_ids)));

  UPDATE public.arena_match_secrets
  SET question_ids = v_ids,
      options = NULL,
      correct_index = NULL
  WHERE match_id = m.id;

  UPDATE public.arena_matches
  SET settings = v_settings,
      q_count = cardinality(v_ids),
      q_index = 0,
      status = 'countdown',
      phase = 'countdown',
      countdown_at = clock_timestamp(),
      host_score = 0,
      guest_score = 0,
      result = NULL,
      stats_applied = false,
      host_rematch = false,
      guest_rematch = false
  WHERE id = m.id;

  PERFORM public.arena_see(m.id, v_uid);
  RETURN jsonb_build_object('ok', true, 'match_id', m.id, 'question_count', cardinality(v_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_open_live(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.status = 'live' THEN
    RETURN jsonb_build_object('ok', true, 'match_id', m.id, 'already', true);
  END IF;
  IF m.status <> 'countdown' OR m.countdown_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The match is not counting down.');
  END IF;
  IF clock_timestamp() < m.countdown_at + interval '3 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'countdown', 'countdown_at', m.countdown_at);
  END IF;

  UPDATE public.arena_matches
  SET status = 'live',
      q_index = 0
  WHERE id = m.id;
  PERFORM public.arena_prepare_question(m.id);
  RETURN jsonb_build_object('ok', true, 'match_id', m.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_enqueue(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_err jsonb;
  v_other uuid;
  v_other_name text;
  v_norm jsonb;
  v_settings jsonb;
  v_ids uuid[];
  v_code text;
  v_id uuid;
  v_host uuid;
  v_host_name text;
  v_guest uuid;
  v_guest_name text;
  v_try integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_name := public.arena_clean_name(p_name);
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a name of 1 to 32 characters.');
  END IF;
  v_err := public.arena_release_for_new(v_uid);
  IF v_err IS NOT NULL THEN
    RETURN v_err;
  END IF;

  PERFORM pg_advisory_xact_lock(4815162342);
  INSERT INTO public.arena_queue (user_id, display_name, enqueued_at)
  VALUES (v_uid, v_name, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        enqueued_at = public.arena_queue.enqueued_at;

  SELECT q.user_id, q.display_name
    INTO v_other, v_other_name
  FROM public.arena_queue q
  WHERE q.user_id <> v_uid
  ORDER BY q.enqueued_at
  LIMIT 1
  FOR UPDATE;

  IF v_other IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'waiting', true);
  END IF;

  v_norm := public.arena_normalize_settings(public.arena_default_settings());
  v_settings := v_norm->'settings';
  v_ids := public.arena_pick_questions(v_settings);
  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough questions to start a random match.');
  END IF;
  v_settings := jsonb_set(v_settings, '{question_count}', to_jsonb(cardinality(v_ids)));

  IF v_other < v_uid THEN
    v_host := v_other;
    v_host_name := v_other_name;
    v_guest := v_uid;
    v_guest_name := v_name;
  ELSE
    v_host := v_uid;
    v_host_name := v_name;
    v_guest := v_other;
    v_guest_name := v_other_name;
  END IF;

  FOR v_try IN 1..5 LOOP
    v_code := public.arena_new_code();
    BEGIN
      INSERT INTO public.arena_matches (
        code, host_id, guest_id, host_name, guest_name, is_random,
        status, phase, settings, q_count, stream_ms, pre_buzz_seconds, answer_seconds,
        countdown_at, host_here, guest_here
      )
      VALUES (
        v_code, v_host, v_guest, v_host_name, v_guest_name, true,
        'countdown', 'countdown', v_settings, cardinality(v_ids),
        (v_norm->>'stream_ms')::integer,
        (v_settings->>'pre_buzz_seconds')::integer,
        (v_settings->>'answer_seconds')::integer,
        clock_timestamp(), true, true
      )
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_id := NULL;
    END;
  END LOOP;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not open a random match.');
  END IF;

  INSERT INTO public.arena_match_secrets (match_id, question_ids)
  VALUES (v_id, v_ids);
  DELETE FROM public.arena_queue WHERE user_id IN (v_uid, v_other);
  PERFORM public.arena_see(v_id, v_host);
  PERFORM public.arena_see(v_id, v_guest);
  RETURN jsonb_build_object(
    'ok', true,
    'waiting', false,
    'match_id', v_id,
    'code', v_code,
    'role', CASE WHEN v_host = v_uid THEN 'host' ELSE 'guest' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_poll()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO m
  FROM public.arena_matches
  WHERE status IN ('lobby', 'countdown', 'live')
    AND (host_id = v_uid OR guest_id = v_uid)
  ORDER BY created_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'waiting', false,
      'match_id', m.id,
      'status', m.status,
      'code', m.code,
      'role', CASE WHEN m.host_id = v_uid THEN 'host' ELSE 'guest' END
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.arena_queue q WHERE q.user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'waiting', true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'waiting', false, 'match_id', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_dequeue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  DELETE FROM public.arena_queue WHERE user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_heartbeat(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_opp uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;

  PERFORM public.arena_see(p_match_id, v_uid);
  v_opp := CASE WHEN m.host_id = v_uid THEN m.guest_id ELSE m.host_id END;

  IF m.status = 'lobby' AND v_opp IS NOT NULL AND public.arena_opponent_stale(m.id, v_opp) THEN
    IF m.host_id = v_uid THEN
      UPDATE public.arena_matches
      SET guest_id = NULL, guest_name = NULL, guest_here = false
      WHERE id = m.id;
      DELETE FROM public.arena_presence WHERE match_id = m.id AND user_id = v_opp;
      RETURN jsonb_build_object('ok', true, 'event', 'guest_left');
    ELSE
      DELETE FROM public.arena_matches WHERE id = m.id;
      RETURN jsonb_build_object('ok', true, 'event', 'cancelled');
    END IF;
  END IF;

  IF m.status = 'lobby' AND m.guest_id IS NULL AND m.host_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', true, 'event', 'cancelled');
  END IF;

  IF m.status IN ('countdown', 'live')
    AND v_opp IS NOT NULL
    AND public.arena_opponent_stale(m.id, v_opp)
  THEN
    PERFORM public.arena_finish(
      m.id,
      CASE WHEN m.host_id = v_opp THEN 'host_forfeit' ELSE 'guest_forfeit' END
    );
    RETURN jsonb_build_object('ok', true, 'event', 'opponent_forfeit');
  END IF;

  PERFORM public.arena_maybe_advance(m.id);
  RETURN jsonb_build_object('ok', true, 'event', 'beat', 'state_version', (
    SELECT state_version FROM public.arena_matches WHERE id = m.id
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_buzz(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  s public.arena_match_secrets;
  v_len integer;
  v_elapsed numeric;
  v_char integer;
  v_deadline timestamptz;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.status <> 'live' OR m.phase NOT IN ('reading', 'rebound') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot buzz right now.');
  END IF;
  IF m.first_buzz_user IS NOT DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'locked', true, 'error', 'You already buzzed on this question.');
  END IF;

  v_deadline := public.arena_read_deadline(m.id);
  IF v_deadline IS NOT NULL AND clock_timestamp() > v_deadline + interval '0.4 seconds' THEN
    PERFORM public.arena_miss_question(m.id, 'miss', NULL);
    RETURN jsonb_build_object('ok', true, 'expired', true);
  END IF;

  v_len := public.arena_question_len(m.id);
  v_elapsed := EXTRACT(EPOCH FROM (clock_timestamp() - m.stream_anchor)) * 1000;
  v_char := m.stream_from + floor(GREATEST(v_elapsed, 0) / m.stream_ms)::integer;
  v_char := least(greatest(v_char, m.stream_from), v_len);

  UPDATE public.arena_matches
  SET phase = 'answering',
      buzz_user = v_uid,
      buzz_at = clock_timestamp(),
      buzz_char = v_char,
      last_resolution = NULL
  WHERE id = m.id
    AND phase IN ('reading', 'rebound')
    AND buzz_user IS NULL
    AND (first_buzz_user IS NULL OR first_buzz_user IS DISTINCT FROM v_uid);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'taken', true, 'error', 'The other player buzzed first.');
  END IF;

  SELECT * INTO s FROM public.arena_match_secrets WHERE match_id = m.id;
  RETURN jsonb_build_object(
    'ok', true,
    'your_buzz', true,
    'options', to_jsonb(s.options),
    'answer_seconds', m.answer_seconds,
    'buzz_char', v_char
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_grade(p_match_id uuid, p_uid uuid, p_choice integer, p_force_wrong boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
  s public.arena_match_secrets;
  v_correct boolean;
  v_actor text;
BEGIN
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.phase <> 'answering' OR m.buzz_user IS DISTINCT FROM p_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'It is not your answer.');
  END IF;
  SELECT * INTO s FROM public.arena_match_secrets WHERE match_id = p_match_id;
  v_actor := CASE WHEN m.host_id = p_uid THEN 'host' ELSE 'guest' END;
  v_correct := (NOT p_force_wrong)
    AND p_choice IS NOT NULL
    AND p_choice = s.correct_index
    AND clock_timestamp() <= m.buzz_at + make_interval(secs => m.answer_seconds) + interval '0.75 seconds';

  IF v_correct THEN
    UPDATE public.arena_matches
    SET phase = 'reveal',
        host_score = host_score + CASE WHEN host_id = p_uid THEN 10 ELSE 0 END,
        guest_score = guest_score + CASE WHEN guest_id = p_uid THEN 10 ELSE 0 END,
        host_answered = host_answered OR host_id = p_uid,
        guest_answered = guest_answered OR guest_id = p_uid,
        last_resolution = jsonb_build_object(
          'outcome', 'correct',
          'actor', v_actor,
          'options', to_jsonb(s.options),
          'correct_index', s.correct_index,
          'points', 10
        )
    WHERE id = p_match_id;
    RETURN jsonb_build_object('ok', true, 'correct', true);
  END IF;

  IF m.first_buzz_user IS NULL THEN
    PERFORM public.arena_mark_wrong_rebound(p_match_id, p_uid);
    RETURN jsonb_build_object('ok', true, 'correct', false, 'rebound', true);
  END IF;

  UPDATE public.arena_matches
  SET phase = 'reveal',
      host_answered = host_answered OR host_id = p_uid,
      guest_answered = guest_answered OR guest_id = p_uid,
      last_resolution = jsonb_build_object(
        'outcome', 'wrong',
        'actor', v_actor,
        'options', to_jsonb(s.options),
        'correct_index', s.correct_index,
        'points', 0
      )
  WHERE id = p_match_id;
  RETURN jsonb_build_object('ok', true, 'correct', false, 'rebound', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_answer(p_match_id uuid, p_choice integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF p_choice IS NULL OR p_choice < 0 OR p_choice > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose one of the four answers.');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF clock_timestamp() > m.buzz_at + make_interval(secs => m.answer_seconds) + interval '0.75 seconds' THEN
    RETURN public.arena_grade(p_match_id, v_uid, NULL, true);
  END IF;
  RETURN public.arena_grade(p_match_id, v_uid, p_choice, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_answer_expired(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.phase <> 'answering' OR m.buzz_user IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', true, 'ignored', true);
  END IF;
  IF clock_timestamp() < m.buzz_at + make_interval(secs => m.answer_seconds) - interval '0.4 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The answer timer is still running.');
  END IF;
  RETURN public.arena_grade(p_match_id, v_uid, NULL, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_reading_expired(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_deadline timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.phase NOT IN ('reading', 'rebound') THEN
    RETURN jsonb_build_object('ok', true, 'ignored', true);
  END IF;
  v_deadline := public.arena_read_deadline(m.id);
  IF v_deadline IS NULL OR clock_timestamp() < v_deadline - interval '0.4 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The buzz window is still open.');
  END IF;
  PERFORM public.arena_miss_question(m.id, 'miss', NULL);
  RETURN jsonb_build_object('ok', true, 'expired', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_to_scoreboard(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.phase = 'scoreboard' OR m.phase = 'final' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF m.phase <> 'reveal' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The question is still open.');
  END IF;
  UPDATE public.arena_matches
  SET phase = 'scoreboard',
      host_next = false,
      guest_next = false,
      next_deadline = NULL
  WHERE id = m.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_tap_next(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.phase <> 'scoreboard' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The score page is not up.');
  END IF;

  IF m.host_id = v_uid AND NOT m.host_next THEN
    UPDATE public.arena_matches
    SET host_next = true,
        next_deadline = COALESCE(next_deadline, clock_timestamp() + interval '5 seconds')
    WHERE id = m.id;
  ELSIF m.guest_id = v_uid AND NOT m.guest_next THEN
    UPDATE public.arena_matches
    SET guest_next = true,
        next_deadline = COALESCE(next_deadline, clock_timestamp() + interval '5 seconds')
    WHERE id = m.id;
  END IF;

  PERFORM public.arena_maybe_advance(m.id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_rematch(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_ids uuid[];
  v_settings jsonb;
  v_both boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.status <> 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The match is not over.');
  END IF;
  IF m.host_id IS NULL OR m.guest_id IS NULL OR NOT m.host_here OR NOT m.guest_here THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The other player is not available.');
  END IF;

  IF m.host_id = v_uid THEN
    UPDATE public.arena_matches SET host_rematch = true WHERE id = m.id AND NOT host_rematch;
  ELSE
    UPDATE public.arena_matches SET guest_rematch = true WHERE id = m.id AND NOT guest_rematch;
  END IF;

  SELECT (host_rematch AND guest_rematch) INTO v_both
  FROM public.arena_matches
  WHERE id = m.id;
  IF NOT v_both THEN
    RETURN jsonb_build_object('ok', true, 'ready', false);
  END IF;

  v_ids := public.arena_pick_questions(m.settings);
  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough questions for another round.');
  END IF;
  v_settings := jsonb_set(m.settings, '{question_count}', to_jsonb(cardinality(v_ids)));
  UPDATE public.arena_match_secrets
  SET question_ids = v_ids, options = NULL, correct_index = NULL
  WHERE match_id = m.id;
  UPDATE public.arena_matches
  SET settings = v_settings,
      q_count = cardinality(v_ids),
      q_index = 0,
      status = 'countdown',
      phase = 'countdown',
      countdown_at = clock_timestamp(),
      host_score = 0,
      guest_score = 0,
      result = NULL,
      stats_applied = false,
      finished_at = NULL,
      host_rematch = false,
      guest_rematch = false,
      host_next = false,
      guest_next = false,
      next_deadline = NULL,
      last_resolution = NULL,
      host_answered = false,
      guest_answered = false,
      buzz_user = NULL,
      first_buzz_user = NULL
  WHERE id = m.id;
  RETURN jsonb_build_object('ok', true, 'ready', true, 'question_count', cardinality(v_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_leave(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;

  IF m.status = 'lobby' THEN
    IF m.host_id = v_uid THEN
      DELETE FROM public.arena_matches WHERE id = m.id;
      RETURN jsonb_build_object('ok', true, 'event', 'cancelled');
    END IF;
    UPDATE public.arena_matches
    SET guest_id = NULL, guest_name = NULL, guest_here = false
    WHERE id = m.id;
    DELETE FROM public.arena_presence WHERE match_id = m.id AND user_id = v_uid;
    RETURN jsonb_build_object('ok', true, 'event', 'left_lobby');
  END IF;

  IF m.status IN ('countdown', 'live') THEN
    PERFORM public.arena_finish(
      m.id,
      CASE WHEN m.host_id = v_uid THEN 'host_forfeit' ELSE 'guest_forfeit' END
    );
    RETURN jsonb_build_object('ok', true, 'event', 'forfeit');
  END IF;

  UPDATE public.arena_matches
  SET host_here = CASE WHEN host_id = v_uid THEN false ELSE host_here END,
      guest_here = CASE WHEN guest_id = v_uid THEN false ELSE guest_here END,
      host_rematch = CASE WHEN host_id = v_uid THEN false ELSE host_rematch END,
      guest_rematch = CASE WHEN guest_id = v_uid THEN false ELSE guest_rematch END
  WHERE id = m.id;
  RETURN jsonb_build_object('ok', true, 'event', 'left_final');
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_reconcile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_opp uuid;
  v_notice boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO m
  FROM public.arena_matches
  WHERE status IN ('countdown', 'live')
    AND (host_id = v_uid OR guest_id = v_uid)
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_opp := CASE WHEN m.host_id = v_uid THEN m.guest_id ELSE m.host_id END;
    IF v_opp IS NOT NULL AND public.arena_opponent_stale(m.id, v_opp) THEN
      PERFORM public.arena_finish(
        m.id,
        CASE WHEN m.host_id = v_opp THEN 'host_forfeit' ELSE 'guest_forfeit' END
      );
    ELSIF public.arena_opponent_stale(m.id, v_uid)
      AND v_opp IS NOT NULL
      AND NOT public.arena_opponent_stale(m.id, v_opp)
    THEN
      -- This player was gone while the opponent stayed.
      PERFORM public.arena_finish(
        m.id,
        CASE WHEN m.host_id = v_uid THEN 'host_forfeit' ELSE 'guest_forfeit' END
      );
    ELSIF public.arena_opponent_stale(m.id, v_uid)
      AND (v_opp IS NULL OR public.arena_opponent_stale(m.id, v_opp))
    THEN
      PERFORM public.arena_finish(m.id, 'double_forfeit');
    ELSE
      PERFORM public.arena_see(m.id, v_uid);
      RETURN jsonb_build_object('ok', true, 'match_id', m.id, 'status', m.status);
    END IF;

    SELECT pending_forfeit_notice INTO v_notice
    FROM public.arena_stats WHERE user_id = v_uid;
    UPDATE public.arena_matches
    SET host_here = CASE WHEN host_id = v_uid THEN true ELSE host_here END,
        guest_here = CASE WHEN guest_id = v_uid THEN true ELSE guest_here END
    WHERE id = m.id;
    RETURN jsonb_build_object(
      'ok', true,
      'match_id', m.id,
      'status', 'finished',
      'pending_forfeit_notice', COALESCE(v_notice, false)
    );
  END IF;

  SELECT * INTO m
  FROM public.arena_matches
  WHERE status = 'lobby'
    AND (host_id = v_uid OR guest_id = v_uid)
  ORDER BY updated_at DESC
  LIMIT 1;
  IF FOUND THEN
    PERFORM public.arena_see(m.id, v_uid);
    RETURN jsonb_build_object('ok', true, 'match_id', m.id, 'status', 'lobby', 'code', m.code);
  END IF;

  SELECT COALESCE(pending_forfeit_notice, false) INTO v_notice
  FROM public.arena_stats WHERE user_id = v_uid;
  IF v_notice THEN
    SELECT * INTO m
    FROM public.arena_matches
    WHERE status = 'finished'
      AND (host_id = v_uid OR guest_id = v_uid)
      AND result IN ('host_forfeit', 'guest_forfeit', 'double_forfeit')
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 1;
    IF FOUND THEN
      UPDATE public.arena_matches
      SET host_here = CASE WHEN host_id = v_uid THEN true ELSE host_here END,
          guest_here = CASE WHEN guest_id = v_uid THEN true ELSE guest_here END
      WHERE id = m.id;
      RETURN jsonb_build_object(
        'ok', true,
        'match_id', m.id,
        'status', 'finished',
        'pending_forfeit_notice', true
      );
    END IF;
    RETURN jsonb_build_object('ok', true, 'pending_forfeit_notice', true);
  END IF;

  SELECT * INTO m
  FROM public.arena_matches
  WHERE status = 'finished'
    AND updated_at > clock_timestamp() - interval '2 hours'
    AND (
      (host_id = v_uid AND host_here)
      OR (guest_id = v_uid AND guest_here)
    )
  ORDER BY updated_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'match_id', m.id, 'status', 'finished');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_view(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  s public.arena_match_secrets;
  q public.questions;
  v_role text;
  v_show_options boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  SELECT * INTO s FROM public.arena_match_secrets WHERE match_id = m.id;
  v_role := CASE WHEN m.host_id = v_uid THEN 'host' ELSE 'guest' END;
  v_show_options := m.phase IN ('reveal', 'scoreboard', 'final')
    OR (m.phase = 'answering' AND m.buzz_user = v_uid);

  IF m.status IN ('live', 'finished') AND s.question_ids IS NOT NULL AND m.q_index < cardinality(s.question_ids) THEN
    SELECT * INTO q FROM public.questions WHERE id = s.question_ids[m.q_index + 1];
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', m.id,
    'code', m.code,
    'is_random', m.is_random,
    'status', m.status,
    'phase', m.phase,
    'role', v_role,
    'server_now', clock_timestamp(),
    'state_version', m.state_version,
    'settings', m.settings,
    'question_count', m.q_count,
    'question_number', CASE WHEN m.status IN ('live', 'finished') THEN m.q_index + 1 ELSE 0 END,
    'host_name', m.host_name,
    'guest_name', m.guest_name,
    'host_score', m.host_score,
    'guest_score', m.guest_score,
    'host_here', m.host_here,
    'guest_here', m.guest_here,
    'host_answered', m.host_answered,
    'guest_answered', m.guest_answered,
    'host_next', m.host_next,
    'guest_next', m.guest_next,
    'next_deadline', m.next_deadline,
    'host_rematch', m.host_rematch,
    'guest_rematch', m.guest_rematch,
    'countdown_at', m.countdown_at,
    'result', m.result,
    'stream_anchor', m.stream_anchor,
    'stream_from', m.stream_from,
    'stream_ms', m.stream_ms,
    'pre_buzz_seconds', m.pre_buzz_seconds,
    'answer_seconds', m.answer_seconds,
    'buzz_char', m.buzz_char,
    'buzz_at', m.buzz_at,
    'buzz_role', CASE
      WHEN m.buzz_user IS NULL THEN NULL
      WHEN m.buzz_user = m.host_id THEN 'host'
      ELSE 'guest'
    END,
    'buzz_locked', m.first_buzz_user IS NOT DISTINCT FROM v_uid,
    'question_text', q.question_text,
    'options', CASE WHEN v_show_options THEN to_jsonb(s.options) ELSE NULL END,
    'resolution', CASE
      WHEN m.phase IN ('rebound', 'reveal', 'scoreboard', 'final') THEN m.last_resolution
      ELSE NULL
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_review(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m public.arena_matches;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO m FROM public.arena_matches WHERE id = p_match_id;
  IF NOT FOUND OR (m.host_id IS DISTINCT FROM v_uid AND m.guest_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your match.');
  END IF;
  IF m.status <> 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The review opens when the match is over.');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY ord), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      u.ord,
      jsonb_build_object(
        'question_text', q.question_text,
        'choices', jsonb_build_array(
          jsonb_build_object('text', trim(q.correct_answer), 'correct', true),
          jsonb_build_object('text', trim(q.wrong_answers[1]), 'correct', false),
          jsonb_build_object('text', trim(q.wrong_answers[2]), 'correct', false),
          jsonb_build_object('text', trim(q.wrong_answers[3]), 'correct', false)
        )
      ) AS row_data
    FROM public.arena_match_secrets s
    CROSS JOIN LATERAL unnest(s.question_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.questions q ON q.id = u.id
    WHERE s.match_id = m.id
  ) listed;

  RETURN jsonb_build_object(
    'ok', true,
    'result', m.result,
    'host_name', m.host_name,
    'guest_name', m.guest_name,
    'host_score', m.host_score,
    'guest_score', m.guest_score,
    'questions', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arena_abort_user(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.arena_matches;
BEGIN
  FOR m IN
    SELECT *
    FROM public.arena_matches
    WHERE status IN ('lobby', 'countdown', 'live')
      AND (host_id = p_uid OR guest_id = p_uid)
    FOR UPDATE
  LOOP
    IF m.status = 'lobby' THEN
      IF m.host_id = p_uid THEN
        DELETE FROM public.arena_matches WHERE id = m.id;
      ELSE
        UPDATE public.arena_matches
        SET guest_id = NULL, guest_name = NULL, guest_here = false
        WHERE id = m.id;
      END IF;
    ELSIF m.host_id = p_uid THEN
      PERFORM public.arena_finish(m.id, 'host_forfeit');
    ELSE
      PERFORM public.arena_finish(m.id, 'guest_forfeit');
    END IF;
  END LOOP;
  DELETE FROM public.arena_queue WHERE user_id = p_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_email text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = current_user_id;

  PERFORM public.arena_abort_user(current_user_id);
  DELETE FROM public.arena_presence WHERE user_id = current_user_id;
  DELETE FROM public.arena_queue WHERE user_id = current_user_id;
  DELETE FROM public.arena_stats WHERE user_id = current_user_id;

  DELETE FROM public.user_mastered_answers WHERE user_id = current_user_id;
  DELETE FROM public.user_passed_answers WHERE user_id = current_user_id;
  DELETE FROM public.user_wrong_answers WHERE user_id = current_user_id;
  DELETE FROM public.user_stats WHERE user_id = current_user_id;
  DELETE FROM public.ai_tutor_usage WHERE user_id = current_user_id::text;

  DELETE FROM public.profiles WHERE id = current_user_id;

  IF user_email IS NOT NULL THEN
    DELETE FROM public.profiles WHERE lower(email) = lower(user_email);
  END IF;

  DELETE FROM auth.users WHERE id = current_user_id;

  RETURN json_build_object('success', true, 'message', 'Account deleted successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Roman check. Fails the script if room codes would be nonsense.
DO $$
BEGIN
  IF public.arena_to_roman(83) IS DISTINCT FROM 'LXXXIII' THEN
    RAISE EXCEPTION 'Roman numeral check failed';
  END IF;
  IF public.arena_valid_code('LXXXIII') IS DISTINCT FROM 'LXXXIII' THEN
    RAISE EXCEPTION 'Roman code check failed';
  END IF;
  IF public.arena_valid_code('XVIII') IS NOT NULL OR public.arena_valid_code('IIIII') IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid Roman code was accepted';
  END IF;
END $$;

-- Hide helpers from the app. The SQL editor (postgres) can still call them.
REVOKE ALL ON FUNCTION public.arena_clean_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_is_guest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_roman_value(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_to_roman(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_from_roman(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_valid_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_new_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_text_list(jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_normalize_settings(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_playable_ids(text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_available(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_pick_questions(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_default_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_add_stat(uuid, integer, integer, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_finish(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_prepare_question(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_advance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_maybe_advance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_release_for_new(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_see(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_opponent_stale(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_question_len(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_read_deadline(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_miss_question(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_mark_wrong_rebound(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_grade(uuid, uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_abort_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_bump_version() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.arena_pool_count(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_my_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_dismiss_forfeit_notice() TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_create_match(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_join_match(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_start_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_open_live(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_enqueue(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_poll() TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_dequeue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_heartbeat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_buzz(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_answer_expired(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_reading_expired(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_to_scoreboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_tap_next(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_rematch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_reconcile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arena_review(uuid) TO authenticated;
