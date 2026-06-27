import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Apple App Store numeric ID (NOT the bundle identifier) — from App Store Connect →
 * App Information → "Apple ID". Used to deep-link the manual/confirm review action.
 */
const APP_STORE_ID = '6761233176';

/** Android package name (from app.json → expo.android.package). */
const ANDROID_PACKAGE = 'com.ziyou.certamenapp';

const REVIEWED_KEY = 'appReview.reviewed';
const FIRST_SET_PROMPTED_KEY = 'appReview.firstSetPrompted';
const LAST_MILESTONE_KEY = 'appReview.lastPromptedMilestone';

/** After the first-set prompt, re-prompt each time mastered questions cross a multiple of this. */
const MASTERED_MILESTONE_STEP = 10;

function getStoreUrl(): string | null {
  if (Platform.OS === 'ios') {
    return `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  }
  if (Platform.OS === 'android') {
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  }
  return null;
}

function milestoneFor(masteredCount: number): number {
  return Math.floor(masteredCount / MASTERED_MILESTONE_STEP) * MASTERED_MILESTONE_STEP;
}

/** True once the user has tapped "Rate the app" — after which we never prompt again. */
export async function hasReviewed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REVIEWED_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * Decide whether to show the custom review popup at the end of a scored set.
 *  - never, once the user has reviewed
 *  - on the user's very first completed set
 *  - afterwards, whenever mastered questions reach a new multiple of 10 (10, 20, 30, ...)
 */
export async function shouldShowReviewPrompt(masteredCount: number): Promise<boolean> {
  try {
    if (await hasReviewed()) return false;

    const firstSetPrompted = (await AsyncStorage.getItem(FIRST_SET_PROMPTED_KEY)) === '1';
    if (!firstSetPrompted) return true;

    const milestone = milestoneFor(masteredCount);
    if (milestone < MASTERED_MILESTONE_STEP) return false;

    const lastMilestone = Number(await AsyncStorage.getItem(LAST_MILESTONE_KEY)) || 0;
    return milestone > lastMilestone;
  } catch (e) {
    console.warn('[appReview] shouldShowReviewPrompt failed:', e);
    return false;
  }
}

/** Record that the popup was shown so the same milestone isn't asked twice. */
export async function markReviewPromptShown(masteredCount: number): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_SET_PROMPTED_KEY, '1');
    const milestone = milestoneFor(masteredCount);
    const lastMilestone = Number(await AsyncStorage.getItem(LAST_MILESTONE_KEY)) || 0;
    if (milestone > lastMilestone) {
      await AsyncStorage.setItem(LAST_MILESTONE_KEY, String(milestone));
    }
  } catch (e) {
    console.warn('[appReview] markReviewPromptShown failed:', e);
  }
}

/**
 * User chose to rate: open the store review page and mark as reviewed so we never ask again.
 * Used by the popup's blue "Rate" button.
 */
export async function confirmReview(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEWED_KEY, '1');
  } catch (e) {
    console.warn('[appReview] could not persist reviewed flag:', e);
  }
  const url = getStoreUrl();
  if (url) {
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn('[appReview] openURL failed:', e);
    }
  }
}
