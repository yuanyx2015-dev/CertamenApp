-- Arena names may be up to 32 characters. They do not have to be unique.
-- Paste this into the Supabase SQL editor and run it once.

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

ALTER TABLE public.arena_matches DROP CONSTRAINT IF EXISTS arena_matches_host_name_len;
ALTER TABLE public.arena_matches
  ADD CONSTRAINT arena_matches_host_name_len CHECK (char_length(host_name) BETWEEN 1 AND 32);

ALTER TABLE public.arena_matches DROP CONSTRAINT IF EXISTS arena_matches_guest_name_len;
ALTER TABLE public.arena_matches
  ADD CONSTRAINT arena_matches_guest_name_len CHECK (
    guest_name IS NULL OR char_length(guest_name) BETWEEN 1 AND 32
  );

ALTER TABLE public.arena_queue DROP CONSTRAINT IF EXISTS arena_queue_name_len;
ALTER TABLE public.arena_queue
  ADD CONSTRAINT arena_queue_name_len CHECK (char_length(display_name) BETWEEN 1 AND 32);
