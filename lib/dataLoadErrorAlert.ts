import { Alert } from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getRankStats } from '../services/userMasteredService';

const COOLDOWN_MS = 90_000;
let lastShownAt = 0;

/** Signed-in session still looks local, but Supabase data could not be loaded. */
export function showDataLoadErrorAlert() {
  const now = Date.now();
  if (now - lastShownAt < COOLDOWN_MS) return;
  lastShownAt = now;
  Alert.alert(
    'Error',
    'Please reload the app. If reloading does not work, contact support@certamenprep.org.',
    [{ text: 'OK' }]
  );
}

/** Used after returning from background. Skips guests and healthy sessions. */
export async function alertIfSignedInDataUnreachable() {
  const user = await getCurrentUser();
  if (!user) {
    showDataLoadErrorAlert();
    return;
  }
  const { error } = await getRankStats(user.id);
  if (error) showDataLoadErrorAlert();
}
