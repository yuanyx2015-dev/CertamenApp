import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';

export interface UserStats {
  id: string;
  user_id: string;
  score: number;
  rank: string;
  win_streak: number;
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
    console.error('Error fetching user stats:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Get current user's stats
export const getCurrentUserStats = async () => {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: { message: 'No user logged in' } };
  }

  return getUserStats(user.id);
};

// Create initial user stats
export const createUserStats = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_stats')
    .insert({
      user_id: userId,
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

// Increment practice completed count
export const incrementPracticeCompleted = async (userId: string) => {
  // Get current stats
  const { data: currentStats } = await getUserStats(userId);
  if (!currentStats) return { data: null, error: { message: 'Stats not found' } };

  const { data, error } = await supabase
    .from('user_stats')
    .update({
      practice_completed: currentStats.practice_completed + 1
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error incrementing practice completed:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

// Get or create user stats (helper function)
export const getOrCreateUserStats = async (userId: string) => {
  // Try to get existing stats
  const { data, error } = await getUserStats(userId);

  // Check if error is because no stats exist (PGRST116 error code or "0 rows" message)
  if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows') || error.message?.includes('No rows'))) {
    // Stats don't exist, create them
    console.log('Creating new user stats for user:', userId);
    return createUserStats(userId);
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
