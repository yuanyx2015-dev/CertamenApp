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

/** YYYY-MM-DD in the device local timezone — streak "days" follow the user's calendar. */
export const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const localYesterdayString = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

const STREAK_MILESTONES: Record<number, string> = {
  7: 'One week under arms. Day 7 secured — well marched!',
  10: 'Double digits, legionary. Day 10 held!',
  25: '25 days. Your place in the ranks is earned.',
  50: '50 days secured! The centurions have noticed.',
  75: '75 days. A veteran\'s discipline.',
  100: '100 days! You carry the standard now.',
  150: '150 days. Few soldiers march this far.',
  200: '200 days! The eagle rises with you.',
  250: '250 days. Steel through and through.',
  300: '300 days. A full campaign, nearly complete.',
};

const STREAK_GENERAL_POOL = [
  'Day {n} secured. Well marched, soldier.',
  'Another day answered. That\'s {n}.',
  '{n} days held. The line stands.',
  'Day {n} in the books. The legion advances.',
  'Reported and done — day {n}.',
  'Day {n} claimed. Steady on the march.',
  '{n} days, never a muster missed.',
  'Day {n} won. Rest, then onward.',
];

function pickGeneralStreakMessage(n: number): string {
  const template =
    STREAK_GENERAL_POOL[Math.floor(Math.random() * STREAK_GENERAL_POOL.length)];
  return template.replace(/\{n\}/g, String(n));
}

function getYearStreakMessage(n: number): string {
  switch (n) {
    case 365:
      return 'One full year in service — 365 days held. Rome salutes you!';
    case 730:
      return 'Two years under the eagle. A true veteran.';
    case 1095:
      return 'Three years. Legendary service.';
    default: {
      const years = n / 365;
      return `${years} years — ${n} days in the ranks. Ave, commander!`;
    }
  }
}

/**
 * Toast copy when the daily streak is credited in Challenge Mode (local calendar day).
 * Selection order: comeback day 1 → year multiples → milestones → days 1–3 → general pool.
 */
export function getStreakCelebrateMessage(
  lastActivityDate: string | null | undefined,
  newStreak: number
): string {
  const n = newStreak;
  const yesterday = localYesterdayString();
  const hadPriorActivity = !!lastActivityDate;
  const isComebackDay1 = n === 1 && hadPriorActivity && lastActivityDate !== yesterday;

  // (1) Comeback — played before, missed at least one day, restarting at day 1
  if (isComebackDay1) {
    return 'The eagle rises again — day 1 of your new campaign, reclaimed.';
  }

  // (2) Full-year anniversaries (365, 730, 1095, …)
  if (n >= 365 && n % 365 === 0) {
    return getYearStreakMessage(n);
  }

  // (3) Milestone days
  const milestone = STREAK_MILESTONES[n];
  if (milestone) return milestone;

  // (4) Early campaign days
  if (n === 1) {
    return 'The muster is answered — day 1 of your new campaign secured. Fall in!';
  }
  if (n === 2) {
    return 'Day 2 secured. The march goes on.';
  }
  if (n === 3) {
    return 'Day 3 done. Finding your footing in the ranks.';
  }

  // (5) General pool for day 4+
  return pickGeneralStreakMessage(n);
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
    // Compare ISO date strings (last_activity_date is stored as YYYY-MM-DD).
    if (lastDate < localYesterdayString()) {
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
    p_today: getLocalDateString(),
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
