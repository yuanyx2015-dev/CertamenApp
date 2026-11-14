-- Room codes are a valid 7-character Roman numeral, such as LXXXIII (83).
-- Paste this into the Supabase SQL editor and run it once.

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

REVOKE ALL ON FUNCTION public.arena_valid_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arena_new_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arena_join_match(text, text) TO authenticated;

DO $$
BEGIN
  IF public.arena_to_roman(83) IS DISTINCT FROM 'LXXXIII' THEN
    RAISE EXCEPTION 'Roman numeral check failed';
  END IF;
  IF public.arena_valid_code('LXXXIII') IS DISTINCT FROM 'LXXXIII' THEN
    RAISE EXCEPTION 'Roman code check failed';
  END IF;
  IF public.arena_valid_code('XVIII') IS NOT NULL THEN
    RAISE EXCEPTION 'A short Roman code was accepted';
  END IF;
END $$;
