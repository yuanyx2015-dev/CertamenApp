-- ================================================
-- Link profiles table with user_stats table
-- This adds a profile_id foreign key to user_stats
-- ================================================

-- Step 1: Add profile_id column to user_stats (nullable for now)
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_stats_profile_id_idx ON public.user_stats(profile_id);

-- Step 3: Add email column to user_stats for easier lookups (optional but helpful)
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 4: Create index on email
CREATE INDEX IF NOT EXISTS user_stats_email_idx ON public.user_stats(email);

-- ================================================
-- Optional: Populate profile_id for existing records
-- Run this AFTER users have logged in and profiles are created
-- ================================================

-- This query will link existing user_stats to profiles by matching email
-- Uncomment and run this AFTER profiles have been created for your users:

/*
UPDATE public.user_stats us
SET profile_id = p.id
FROM public.profiles p
WHERE us.email = p.email
AND us.profile_id IS NULL;
*/

-- ================================================
-- View to see profiles with their stats (useful for debugging)
-- ================================================

CREATE OR REPLACE VIEW public.profile_stats_view AS
SELECT 
  p.id as profile_id,
  p.username,
  p.display_name,
  p.email,
  p.avatar_url,
  p.created_at as profile_created_at,
  us.id as stats_id,
  us.score,
  us.rank,
  us.win_streak,
  us.total_games,
  us.wins,
  us.losses,
  us.practice_completed,
  us.created_at as stats_created_at
FROM public.profiles p
LEFT JOIN public.user_stats us ON us.profile_id = p.id;

-- Grant permissions to view
GRANT SELECT ON public.profile_stats_view TO authenticated;

-- ================================================
-- Function to sync profile data to user_stats
-- This automatically updates user_stats when profile changes
-- ================================================

CREATE OR REPLACE FUNCTION public.sync_profile_to_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update username in user_stats when profile username changes
  UPDATE public.user_stats
  SET username = NEW.username
  WHERE profile_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep username in sync
DROP TRIGGER IF EXISTS sync_profile_username ON public.profiles;
CREATE TRIGGER sync_profile_username
  AFTER UPDATE OF username ON public.profiles
  FOR EACH ROW
  WHEN (OLD.username IS DISTINCT FROM NEW.username)
  EXECUTE FUNCTION public.sync_profile_to_stats();

-- ================================================
-- NOTES:
-- ================================================
-- 1. After running this SQL, update your app code to set profile_id when creating user_stats
-- 2. The profile_id allows you to:
--    - Query user stats along with profile info in a single join
--    - Ensure data consistency (CASCADE delete)
--    - Display avatar_url and display_name on profile screen
-- 3. Run the commented UPDATE query after users have created profiles
-- ================================================
