import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { Text } from '../lib/AppText';
import { FitScrollView } from './FitScrollView';
import { getCurrentUser, signOut } from '../services/authService';
import {
  getOrCreateUserStats,
  expireStreakIfMissed,
  type UserStats,
} from '../services/userStatsService';
import { getProfileByEmail, deleteAccount } from '../services/profileService';
import { clearAllLocalAccountData } from '../services/userSettingsService';
import {
  getRankStats,
  getMasteredCount,
} from '../services/userMasteredService';
import { getWrongCount } from '../services/questionReviewService';
import {
  MASTERY_RANKS,
  currentRankFromStats,
  rankProgressFromStats,
} from '../lib/masteryRanks';
import type { MainTabId } from './MainTabsScreen';
import { useIPadScaledStyles } from '../lib/layout';
import { PRIVACY_POLICY_URL } from '../constants/urls';

function AnimatedCardButton({
  label,
  onPress,
  style,
  innerStyle,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  style?: object;
  innerStyle?: object;
  textStyle?: object;
}) {
  const styles = useIPadScaledStyles(baseStyles);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(201, 169, 97, 0.12)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={{ flex: 1 }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.card, styles.dailyChallengeCard, innerStyle, { backgroundColor }]}>
          <Text style={[styles.dailyChallengeText, textStyle]}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function StatBox({
  label,
  value,
  scopeLabel,
  footer,
  style,
}: {
  label: string;
  value: string | number;
  scopeLabel?: string;
  footer?: React.ReactNode;
  style?: object;
}) {
  const styles = useIPadScaledStyles(baseStyles);
  return (
    <View style={[styles.card, styles.statBox, style]}>
      <View>
        <Text style={styles.statBoxLabel}>{label}</Text>
        {scopeLabel ? <Text style={styles.statScopeLabel}>{scopeLabel}</Text> : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {footer}
    </View>
  );
}

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  const styles = useIPadScaledStyles(baseStyles);
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressLabelValue}>{pct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export function InformationScreen({
  onNavigate,
  onTabChange,
  isGuestMode,
  isAuthenticated,
  onLogout,
}: {
  onNavigate?: (screen: string) => void;
  onTabChange?: (tab: MainTabId) => void;
  isGuestMode?: boolean;
  isAuthenticated?: boolean;
  onLogout?: () => void;
}) {
  const styles = useIPadScaledStyles(baseStyles);
  const [userName, setUserName] = useState('—');
  const [rankName, setRankName] = useState('—');
  const [progress, setProgress] = useState(0);
  const [streak, setStreak] = useState<string | number>('—');
  const [highStreak, setHighStreak] = useState<string | number>('—');
  const [masteredCount, setMasteredCount] = useState<string | number>('—');
  const [unmasteredCount, setUnmasteredCount] = useState<string | number>('—');
  const [wrongCount, setWrongCount] = useState<string | number>('—');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Could not verify user identity.', [{ text: 'OK' }]);
        setIsDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      try {
        await clearAllLocalAccountData(user.id);
      } catch (storageError) {
        console.warn('Error clearing local account data:', storageError);
      }

      const { error: deleteError } = await deleteAccount();
      if (deleteError) {
        console.error('Delete account error details:', deleteError);
        Alert.alert(
          'Error',
          `Failed to delete account: ${deleteError.message || 'Unknown error'}. Please try again or contact support.`,
          [{ text: 'OK' }]
        );
        setIsDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      await signOut();
      setShowDeleteModal(false);
      onLogout?.();
    } catch (error: any) {
      console.error('Error during account deletion:', error);
      Alert.alert(
        'Error',
        `An unexpected error occurred: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  const loadData = useCallback(async () => {
    if (!isAuthenticated || isGuestMode) {
      setUserName(isGuestMode ? 'Guest' : '—');
      setRankName('—');
      setProgress(0);
      setStreak('—');
      setHighStreak('—');
      setMasteredCount('—');
      setUnmasteredCount('—');
      setWrongCount('—');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(false);
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoadError(true);
        setIsLoading(false);
        return;
      }

      let displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      if (user.email) {
        const { data: profileData } = await getProfileByEmail(user.email);
        if (profileData) {
          displayName = profileData.display_name || profileData.username || displayName;
        }
      }
      setUserName(displayName);

      // Track whether any fetch failed so we can surface a retry instead of
      // silently showing zeros/lowest rank as if the user had no progress.
      let hadError = false;

      // Read streak, resetting to 0 if the user missed a day.
      const { data: stats, error: statsError } = await getOrCreateUserStats(user.id);
      if (statsError) {
        hadError = true;
        setStreak('—');
        setHighStreak('—');
      } else {
        const liveStats = stats ? await expireStreakIfMissed(user.id) : null;
        applyStreakFromStats(liveStats ?? stats);
      }

      const [rankRes, masteredRes, wrongRes] = await Promise.all([
        getRankStats(user.id),
        getMasteredCount(user.id),
        getWrongCount(user.id),
      ]);

      if (masteredRes.error) {
        hadError = true;
        setMasteredCount('—');
      } else {
        setMasteredCount(masteredRes.data ?? 0);
      }

      if (wrongRes.error) {
        hadError = true;
        setWrongCount('—');
      } else {
        setWrongCount(wrongRes.data);
      }

      if (rankRes.error) {
        hadError = true;
        setRankName('—');
        setProgress(0);
        setUnmasteredCount('—');
      } else {
        const rankStats = rankRes.data ?? [];
        const rankIdx = currentRankFromStats(rankStats);
        const cur = rankStats.find((s) => s.rankIndex === rankIdx);

        setRankName(MASTERY_RANKS[rankIdx]);
        setProgress(rankProgressFromStats(cur));
        setUnmasteredCount(cur?.unmastered ?? 0);
      }

      setLoadError(hadError);
    } catch (e) {
      console.error('[InformationScreen] loadData error:', e);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isGuestMode]);

  const applyStreakFromStats = (stats: UserStats | null) => {
    if (!stats) {
      setStreak(0);
      setHighStreak(0);
      return;
    }
    setStreak(stats.current_streak ?? stats.win_streak ?? 0);
    setHighStreak(stats.highest_streak ?? stats.current_streak ?? 0);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDailyChallenge = () => {
    // Guests land on Challenge's inline sign-in screen (same as the Challenge tab).
    onTabChange?.('challenge');
  };

  const handleWrongQuestions = () => {
    if (!isAuthenticated || isGuestMode) {
      // Guests land on Review's inline sign-in screen (same as the Review tab).
      onTabChange?.('review');
      return;
    }
    onNavigate?.('reviewCategories');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingWrap]}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  return (
    <FitScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {loadError && (
        <TouchableOpacity style={styles.errorBanner} onPress={loadData} activeOpacity={0.85}>
          <Text style={styles.errorBannerText}>
            Couldn't load your latest stats. Tap to retry.
          </Text>
        </TouchableOpacity>
      )}

      <View style={[styles.card, styles.userCard]}>
        <Text style={styles.userNameText}>{userName}</Text>
        <Text style={styles.userRankText}>
          Rank: <Text style={styles.userMetaValue}>{rankName}</Text>
        </Text>
        <ProgressBar progress={progress} label="Progress through this rank" />
        {isGuestMode && (
          <TouchableOpacity
            style={styles.guestSignInBtn}
            onPress={() => onNavigate?.('login')}
            activeOpacity={0.85}
          >
            <Text style={styles.guestSignInBtnText}>
              Sign in to track mastery, streaks, and review
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.gridSection}>
        {/* Mastered + Remaining | Daily Challenge (same height as those two) */}
        <View style={styles.topGridRow}>
          <View style={styles.leftStatsColumn}>
            <StatBox
              label="Mastered"
              scopeLabel="all ranks"
              value={masteredCount}
              style={styles.topStatBox}
            />
            <StatBox
              label="Remaining"
              scopeLabel={rankName === '—' ? 'in this rank' : `in ${rankName}`}
              value={unmasteredCount}
              style={styles.topStatBox}
            />
          </View>
          <AnimatedCardButton
            label="Start your Daily Challenge!"
            onPress={handleDailyChallenge}
            style={styles.dailyChallengeWrap}
          />
        </View>

        {/* To review | Streak */}
        <View style={styles.bottomGridRow}>
          <StatBox
            label="To review"
            scopeLabel="missed questions"
            value={wrongCount}
            style={styles.bottomStatBox}
          />
          <StatBox
            label="Streak"
            value={streak}
            style={styles.bottomStatBox}
            footer={
              <Text style={styles.statSubLabel}>
                Best: <Text style={styles.statSubValue}>{highStreak}</Text>
              </Text>
            }
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.wrongQuestionsBtn}
        onPress={handleWrongQuestions}
        activeOpacity={0.85}
      >
        <Text style={styles.wrongQuestionsBtnText}>Your Wrong Questions</Text>
        <Text style={styles.wrongQuestionsBtnSubtitle}>
          Missed questions from Challenge Mode, organized by category.
        </Text>
        <Text style={styles.wrongQuestionsBtnHint}>
          Browse by category &middot; ask AI for an explanation
        </Text>
      </TouchableOpacity>

      {isAuthenticated && !isGuestMode && (
        <View style={styles.accountSection}>
          <TouchableOpacity
            style={styles.accountBtn}
            onPress={handleLogoutPress}
            activeOpacity={0.85}
          >
            <Text style={styles.accountBtnText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.deleteBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.privacyLinkWrap}
        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
      >
        <Text style={styles.privacyLink}>Privacy Policy</Text>
      </TouchableOpacity>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete your account? All of your information, including your
              score, rank, and progress will be permanently lost. This action cannot be undone.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmDeleteButton]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </FitScrollView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    width: '100%',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  errorBanner: {
    backgroundColor: 'rgba(176, 58, 46, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(176, 58, 46, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#8a2a22',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  scrollContent: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 12,
    paddingBottom: 16,
  },
  loadingWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    // iOS keeps soft shadows. Android elevation + border looks like a thick outline,
    // so Android uses the 1px border only (same look as Log Out).
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -1, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 0,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: -1, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
    }),
  },
  userCard: {
    gap: 8,
  },
  guestSignInBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  guestSignInBtnText: {
    color: '#3a3a3a',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  userNameText: {
    fontSize: 21,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.2,
  },
  userRankText: {
    fontSize: 15,
    color: '#3a3a3a',
    letterSpacing: 0.15,
  },
  userMetaValue: {
    color: '#6a6a6a',
    fontWeight: '500',
  },
  progressWrap: {
    marginTop: 4,
    gap: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6a6a6a',
    letterSpacing: 0.1,
  },
  progressLabelValue: {
    fontSize: 12,
    color: '#6a6a6a',
    fontWeight: '600',
  },
  progressTrack: {
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'rgba(201, 169, 97, 0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#c9a961',
  },
  gridSection: {
    gap: 10,
  },
  /** Left: Mastered / Remaining. Right: Daily Challenge (same height). */
  topGridRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
    minHeight: 168,
  },
  leftStatsColumn: {
    flex: 1,
    gap: 10,
  },
  topStatBox: {
    flex: 1,
    minHeight: 79,
  },
  /** Left: To review. Right: Streak. */
  bottomGridRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  bottomStatBox: {
    flex: 1,
    minHeight: 76,
  },
  statBox: {
    justifyContent: 'space-between',
  },
  statBoxLabel: {
    fontSize: 13,
    color: '#3a3a3a',
    letterSpacing: 0.1,
    lineHeight: 17,
    fontWeight: '600',
  },
  statScopeLabel: {
    fontSize: 11,
    color: '#8a8a8a',
    fontStyle: 'italic',
    marginTop: 1,
    lineHeight: 14,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6a6a6a',
    marginTop: 2,
  },
  statSubLabel: {
    fontSize: 11,
    color: '#8a8a8a',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  statSubValue: {
    fontWeight: '600',
    color: '#6a6a6a',
  },
  dailyChallengeWrap: {
    flex: 1,
  },
  dailyChallengeCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 168,
    paddingHorizontal: 10,
  },
  dailyChallengeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a3a3a',
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 22,
  },
  wrongQuestionsBtn: {
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -1, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 0,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: -1, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
    }),
  },
  wrongQuestionsBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3a3a3a',
    letterSpacing: 0.2,
  },
  wrongQuestionsBtnSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#8a8a8a',
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 17,
  },
  wrongQuestionsBtnHint: {
    marginTop: 3,
    fontSize: 12,
    color: '#8a6a3a',
    letterSpacing: 0.1,
  },
  accountSection: {
    marginTop: 6,
    gap: 8,
  },
  accountBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    alignItems: 'center',
  },
  accountBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.2,
  },
  deleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(160, 31, 79, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(160, 31, 79, 0.4)',
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a01f4f',
    letterSpacing: 0.2,
  },
  privacyLinkWrap: {
    marginTop: 14,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  privacyLink: {
    fontSize: 13,
    color: '#6a6a6a',
    textDecorationLine: 'underline',
    letterSpacing: 0.1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3a3a3a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6a6a6a',
    lineHeight: 23,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    backgroundColor: '#d32f2f',
  },
  confirmDeleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
