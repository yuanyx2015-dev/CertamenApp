-- Migration: Add username field to user_stats table
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add username column to user_stats table
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS username TEXT DEFAULT 'User';

-- Step 2: Update existing records to set username from auth.users metadata
-- This will try to extract username from user metadata or email
UPDATE user_stats us
SET username = COALESCE(
  (SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    SPLIT_PART(email, '@', 1),
    'User'
  )
  FROM auth.users
  WHERE id = us.user_id),
  'User'
);
