# Profile & Stats Integration Guide

## Overview
This guide explains how profiles and user stats are now linked and synchronized in your CertamenApp.

---

## What Was Done

### 1. **SQL Schema Updates** (`link_profiles_to_stats.sql`)

#### Added to `user_stats` table:
- `profile_id` (UUID) - Foreign key to profiles table
- `email` (TEXT) - For easier profile lookups
- Indexes for fast queries
- CASCADE delete (when profile deleted, stats also deleted)

#### Created:
- View `profile_stats_view` - Combines profile + stats data
- Trigger to sync username changes from profiles to stats

### 2. **Updated Services**

#### `userStatsService.ts`:
- Added `profile_id` and `email` fields to `UserStats` interface
- Updated `createUserStats()` to accept profile info
- Modified `getOrCreateUserStats()` to automatically link with profiles

#### `profileService.ts` (already created):
- `getOrCreateProfile()` - Creates profile on login
- `getProfileByEmail()` - Fetches profile data
- Other helper functions

#### `ProfileStatsScreen.tsx`:
- Now loads profile data from database
- Shows `display_name` from profiles table
- Fallback to user metadata if profile not loaded

---

## How It Works

### Login Flow (Automatic):

```
User logs in with Google/Apple
           ↓
1. Create/update PROFILE in profiles table
   - username
   - display_name  
   - email
   - avatar_url
           ↓
2. Create USER_STATS in user_stats table
   - Links to profile via profile_id
   - Copies email for lookups
   - Initializes score, rank, etc.
           ↓
3. Profile Screen displays combined data
```

### Data Sync:

**Profiles Table** ↔ **User Stats Table**

When profile created → stats automatically link via `profile_id`
When username updated in profiles → automatically synced to stats (via trigger)

---

## SQL Setup Instructions

### Step 1: Run the SQL
Copy and run `link_profiles_to_stats.sql` in your Supabase SQL Editor.

This will:
- ✅ Add `profile_id` column to `user_stats`
- ✅ Add `email` column to `user_stats`  
- ✅ Create indexes
- ✅ Create view for joined data
- ✅ Create sync trigger

### Step 2: Test with a New Login
1. Delete your existing user stats (or create a new test account)
2. Log in through the app
3. Check Supabase tables:
   - `profiles` should have your user data
   - `user_stats` should have `profile_id` pointing to your profile

### Step 3: Update Existing Records (Optional)
If you have existing user_stats without `profile_id`, run this in Supabase:

```sql
UPDATE public.user_stats us
SET profile_id = p.id, email = p.email
FROM public.profiles p
WHERE us.email = p.email
AND us.profile_id IS NULL;
```

---

## Database Structure

### profiles table:
```
id            UUID (PK)
username      TEXT (unique)
display_name  TEXT
email         TEXT (unique)
avatar_url    TEXT
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

### user_stats table:
```
id                  UUID (PK)
user_id             TEXT
profile_id          UUID (FK → profiles.id)  ← NEW!
email               TEXT                      ← NEW!
username            TEXT
score               INTEGER
rank                TEXT
win_streak          INTEGER
total_games         INTEGER
wins                INTEGER
losses              INTEGER
practice_completed  INTEGER
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

---

## What Shows on Profile Screen

The ProfileStatsScreen now displays:

1. **Name** - From `profiles.display_name` (or fallback to email)
2. **Score** - From `user_stats.score`
3. **Rank** - From `user_stats.rank`
4. **Win Streak** - From `user_stats.win_streak`

Future enhancements could add:
- Avatar image (from `profiles.avatar_url`)
- Total games, wins, losses
- Practice completed count

---

## Querying Combined Data

### In Supabase SQL Editor:
```sql
-- View all profiles with their stats
SELECT * FROM profile_stats_view;

-- Get specific user
SELECT * FROM profile_stats_view 
WHERE email = 'user@example.com';
```

### In App Code:
```typescript
// Get profile
const { data: profile } = await getProfileByEmail(user.email);

// Get stats (automatically linked)
const { data: stats } = await getOrCreateUserStats(user.id);

// Use them together
console.log(`${profile.display_name}: ${stats.score} points`);
```

---

## Troubleshooting

### Profile not showing in app?
- Check Supabase `profiles` table - does row exist?
- Check console logs for errors during login
- Verify RLS policies allow SELECT on profiles

### Stats not linking to profile?
- Run the UPDATE query in Step 3 above
- Check that `email` matches in both tables
- Verify `profile_id` is set in `user_stats`

### Username not syncing?
- The trigger only fires on UPDATE, not INSERT
- Manually update: `UPDATE profiles SET username = 'newname' WHERE email = 'user@example.com'`
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'sync_profile_username'`

---

## Summary

✅ **Profiles and stats are now linked**
✅ **Automatic sync on login**  
✅ **Profile screen shows database data**
✅ **Username changes propagate automatically**
✅ **Ready for future features** (avatars, leaderboards, etc.)

---

## Next Steps (Optional)

1. **Display Avatar**: Add `<Image source={{ uri: profile.avatar_url }} />` to ProfileStatsScreen
2. **Editable Profile**: Add button to update display_name
3. **Leaderboard**: Query top scores with profile info
4. **Friends System**: Use profiles table for friend lookups

