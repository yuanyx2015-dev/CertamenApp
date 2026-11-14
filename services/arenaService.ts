import { supabase } from '../lib/supabase';

export const ARENA_CATEGORIES = [
  { key: 'mythology', label: 'Mythology' },
  { key: 'history', label: 'History' },
  { key: 'language', label: 'Language' },
  { key: 'literature', label: 'Literature' },
  { key: 'culture-life', label: 'Culture & Life' },
  { key: 'living-latin', label: 'Living Latin' },
] as const;

export const ARENA_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const ARENA_SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5] as const;

export interface ArenaSettings {
  question_count: number;
  reading_speed: number;
  pre_buzz_seconds: number;
  answer_seconds: number;
  difficulties: string[];
  categories: string[];
}

export const ARENA_DEFAULT_SETTINGS: ArenaSettings = {
  question_count: 20,
  reading_speed: 1,
  pre_buzz_seconds: 10,
  answer_seconds: 5,
  difficulties: ['easy', 'medium', 'hard'],
  categories: ARENA_CATEGORIES.map((c) => c.key),
};

export interface ArenaStats {
  ok: boolean;
  guest?: boolean;
  error?: string;
  wins?: number;
  games_played?: number;
  ties?: number;
  forfeits?: number;
  pending_forfeit_notice?: boolean;
}

export interface ArenaResolution {
  outcome: 'correct' | 'wrong' | 'miss';
  actor?: 'host' | 'guest' | null;
  options?: string[] | null;
  correct_index?: number | null;
  points?: number;
}

export interface ArenaView {
  ok: boolean;
  error?: string;
  match_id: string;
  code: string;
  is_random: boolean;
  status: 'lobby' | 'countdown' | 'live' | 'finished';
  phase:
    | 'lobby'
    | 'countdown'
    | 'reading'
    | 'answering'
    | 'rebound'
    | 'reveal'
    | 'scoreboard'
    | 'final';
  role: 'host' | 'guest';
  server_now: string;
  state_version: number;
  settings: ArenaSettings;
  question_count: number;
  question_number: number;
  host_name: string;
  guest_name: string | null;
  host_score: number;
  guest_score: number;
  host_here: boolean;
  guest_here: boolean;
  host_answered: boolean;
  guest_answered: boolean;
  host_next: boolean;
  guest_next: boolean;
  next_deadline: string | null;
  host_rematch: boolean;
  guest_rematch: boolean;
  countdown_at: string | null;
  result:
    | 'host_win'
    | 'guest_win'
    | 'tie'
    | 'host_forfeit'
    | 'guest_forfeit'
    | 'double_forfeit'
    | null;
  stream_anchor: string | null;
  stream_from: number;
  stream_ms: number;
  pre_buzz_seconds: number;
  answer_seconds: number;
  buzz_char: number | null;
  buzz_at: string | null;
  buzz_role: 'host' | 'guest' | null;
  buzz_locked: boolean;
  question_text: string | null;
  options: string[] | null;
  resolution: ArenaResolution | null;
}

export interface ArenaReviewQuestion {
  question_text: string;
  choices: { text: string; correct: boolean }[];
}

/** Name for this app process only. A full close clears it. */
let memoryName = '';

export function readArenaName(): string {
  return memoryName;
}

export function writeArenaName(name: string): void {
  memoryName = name.slice(0, 32);
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) {
    return { ok: false, error: error.message } as T;
  }
  return data as T;
}

export function arenaPoolCount(settings: ArenaSettings) {
  return call<{
    ok: boolean;
    available?: number;
    min?: number;
    max?: number;
    error?: string;
  }>('arena_pool_count', { p_settings: settings });
}

export function arenaMyStats() {
  return call<ArenaStats>('arena_my_stats');
}

export function arenaDismissForfeitNotice() {
  return call<{ ok: boolean }>('arena_dismiss_forfeit_notice');
}

export function arenaCreateMatch(name: string, settings: ArenaSettings) {
  return call<{ ok: boolean; match_id?: string; code?: string; error?: string }>(
    'arena_create_match',
    { p_name: name, p_settings: settings }
  );
}

export function arenaJoinMatch(code: string, name: string) {
  return call<{ ok: boolean; match_id?: string; error?: string }>('arena_join_match', {
    p_code: code,
    p_name: name,
  });
}

export function arenaEnqueue(name: string) {
  return call<{ ok: boolean; waiting?: boolean; match_id?: string; error?: string }>(
    'arena_enqueue',
    { p_name: name }
  );
}

export function arenaPoll() {
  return call<{ ok: boolean; waiting?: boolean; match_id?: string | null; status?: string; error?: string }>(
    'arena_poll'
  );
}

export function arenaDequeue() {
  return call<{ ok: boolean }>('arena_dequeue');
}

export function arenaHeartbeat(matchId: string) {
  return call<{ ok: boolean; event?: string; error?: string }>('arena_heartbeat', {
    p_match_id: matchId,
  });
}

export function arenaBuzz(matchId: string) {
  return call<{
    ok: boolean;
    your_buzz?: boolean;
    options?: string[];
    locked?: boolean;
    taken?: boolean;
    expired?: boolean;
    error?: string;
  }>('arena_buzz', { p_match_id: matchId });
}

export function arenaAnswer(matchId: string, choice: number) {
  return call<{ ok: boolean; correct?: boolean; rebound?: boolean; error?: string }>(
    'arena_answer',
    { p_match_id: matchId, p_choice: choice }
  );
}

export function arenaAnswerExpired(matchId: string) {
  return call<{ ok: boolean; error?: string }>('arena_answer_expired', { p_match_id: matchId });
}

export function arenaReadingExpired(matchId: string) {
  return call<{ ok: boolean; error?: string }>('arena_reading_expired', { p_match_id: matchId });
}

export function arenaToScoreboard(matchId: string) {
  return call<{ ok: boolean; error?: string }>('arena_to_scoreboard', { p_match_id: matchId });
}

export function arenaTapNext(matchId: string) {
  return call<{ ok: boolean }>('arena_tap_next', { p_match_id: matchId });
}

export function arenaOpenLive(matchId: string) {
  return call<{ ok: boolean; error?: string; countdown_at?: string }>('arena_open_live', {
    p_match_id: matchId,
  });
}

export function arenaStartMatch(matchId: string) {
  return call<{ ok: boolean; error?: string }>('arena_start_match', { p_match_id: matchId });
}

export function arenaRematch(matchId: string) {
  return call<{ ok: boolean; ready?: boolean; error?: string }>('arena_rematch', {
    p_match_id: matchId,
  });
}

export function arenaLeave(matchId: string) {
  return call<{ ok: boolean; event?: string; error?: string }>('arena_leave', {
    p_match_id: matchId,
  });
}

export function arenaReconcile() {
  return call<{
    ok: boolean;
    match_id?: string;
    status?: string;
    code?: string;
    pending_forfeit_notice?: boolean;
    error?: string;
  }>('arena_reconcile');
}

export function arenaView(matchId: string) {
  return call<ArenaView>('arena_view', { p_match_id: matchId });
}

export function arenaReview(matchId: string) {
  return call<{
    ok: boolean;
    error?: string;
    questions?: ArenaReviewQuestion[];
    result?: ArenaView['result'];
    host_name?: string;
    guest_name?: string | null;
    host_score?: number;
    guest_score?: number;
  }>('arena_review', { p_match_id: matchId });
}

export function subscribeArenaMatch(matchId: string, onChange: () => void) {
  const channel = supabase
    .channel(`arena-match-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'arena_matches',
        filter: `id=eq.${matchId}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
