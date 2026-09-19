import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHALLENGE_SET_SIZES = [10, 20, 30, 40, 50] as const;
export type ChallengeSetSize = (typeof CHALLENGE_SET_SIZES)[number];
export const DEFAULT_CHALLENGE_SET_SIZE: ChallengeSetSize = 10;

function storageKey(userId: string): string {
  return `challenge_set_size_${userId}`;
}

export function isChallengeSetSize(value: unknown): value is ChallengeSetSize {
  return (
    typeof value === 'number' &&
    (CHALLENGE_SET_SIZES as readonly number[]).includes(value)
  );
}

export async function getChallengeSetSize(userId: string): Promise<ChallengeSetSize> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (raw == null) return DEFAULT_CHALLENGE_SET_SIZE;
    const parsed = Number(raw);
    return isChallengeSetSize(parsed) ? parsed : DEFAULT_CHALLENGE_SET_SIZE;
  } catch {
    return DEFAULT_CHALLENGE_SET_SIZE;
  }
}

export async function setChallengeSetSize(
  userId: string,
  setSize: ChallengeSetSize
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), String(setSize));
}

export async function clearChallengeSetSize(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}
