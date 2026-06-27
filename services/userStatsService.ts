import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';

export interface UserStats {
  id: string;
  user_id: string;
  username: string;
  profile_id?: string;
  email?: string;
  score: number;
  rank: string;
  win_streak: number;
  /** Challenge Mode daily streak. Bumped at most once per calendar day. */
  current_streak?: number;
  /** All-time longest daily streak the user has reached. Never decreases. */
  highest_streak?: number;
  last_activity_date?: string | null;
  total_games: number;
  wins: number;
  losses: number;
  practice_completed: number;
  created_at: string;
  updated_at: string;
}

// Get user stats by user_id
export const getUserStats = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.log('No existing user stats found (expected for new users):', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Create initial user stats
export const createUserStats = async (userId: string, username?: string, profileId?: string, email?: string) => {
  const { data, error } = await supabase
    .from('user_stats')
    .insert({
      user_id: userId,
      username: username || 'User',
      profile_id: profileId || null,
      email: email || null,
      score: 0,
      rank: 'Miles',
      win_streak: 0,
      total_games: 0,
      wins: 0,
      losses: 0,
      practice_completed: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user stats:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Update user stats (score and rank)
export const updateUserScore = async (userId: string, newScore: number, newRank: string) => {
  const { data, error } = await supabase
    .from('user_stats')
    .update({
      score: newScore,
      rank: newRank
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user score:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

/**
 * Check whether the user missed one or more days since their last challenge.
 * If so, reset current_streak to 0 in the DB and return the corrected stats.
 * Safe to call on every home-screen mount — no-ops if the streak is still valid.
 */
export const expireStreakIfMissed = async (userId: string): Promise<UserStats | null> => {
  const { data: stats } = await getUserStats(userId);
  if (!stats) return null;

  const streak = stats.current_streak ?? 0;
  const lastDate = stats.last_activity_date;

  if (streak > 0 && lastDate) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const yesterdayMidnight = new Date(todayMidnight);
    yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

    const lastActivity = new Date(lastDate);
    lastActivity.setHours(0, 0, 0, 0);

    if (lastActivity < yesterdayMidnight) {
      await supabase
        .from('user_stats')
        .update({ current_streak: 0 })
        .eq('user_id', userId);
      return { ...stats, current_streak: 0 };
    }
  }

  return stats;
};

/**
 * Daily streak bump (Duolingo-style).
 *   - First action of the day:   +1 if yesterday, else reset to 1
 *   - Subsequent actions today:  no change
 * Idempotent: safe to call on every app open / every screen mount.
 */
export const bumpUserStreak = async (userId: string) => {
  const { data, error } = await supabase.rpc('bump_user_streak', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error bumping streak:', error);
    return { data: null, error };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    data: row
      ? {
          current_streak: Number(row.current_streak) || 0,
          highest_streak: Number(row.highest_streak) || 0,
          last_activity_date: row.last_activity_date as string | null,
        }
      : null,
    error: null,
  };
};

// Get or create user stats (helper function)
export const getOrCreateUserStats = async (userId: string) => {
  // Try to get existing stats
  const { data, error } = await getUserStats(userId);

  // Check if error is because no stats exist (PGRST116 error code or "0 rows" message)
  if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows') || error.message?.includes('No rows'))) {
    // Stats don't exist, create them
    console.log('Creating new user stats for user:', userId);
    
    // Try to get username and profile info from current user
    const user = await getCurrentUser();
    const username = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const email = user?.email || null;
    
    // Try to get profile_id by email
    let profileId = null;
    if (email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      
      if (profile) {
        profileId = profile.id;
      }
    }
    
    return createUserStats(userId, username, profileId, email);
  }

  if (error) {
    // Other error occurred
    console.error('Error getting user stats:', error);
    return { data: null, error };
  }

  // Fix old rank names (convert "Novice" or any invalid rank to "Miles")
  if (data && (data.rank === 'Novice' || !['Miles', 'Decanus', 'Optio', 'Centurio', 'Primus Pilus', 'Praefectus Castrorum', 'Legatus Legionis'].includes(data.rank))) {
    console.log('Fixing old rank name:', data.rank, '-> Miles');
    await updateUserScore(userId, data.score, 'Miles');
    data.rank = 'Miles';
  }

  return { data, error: null };
};
