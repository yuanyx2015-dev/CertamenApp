import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import {
  getOrCreateUserStats,
  bumpUserStreak,
  type UserStats,
} from '../services/userStatsService';
import { getProfileByEmail } from '../services/profileService';
import {
  getDifficultyStats,
  getMasteredCount,
} from '../services/userMasteredService';
import { getAllWrongQuestions } from '../services/questionReviewService';
import {
  currentDifficulty,
  difficultyProgress,
  rankForDifficulty,
  type DifficultyStats,
} from '../lib/challengeRanks';
import type { MainTabId } from './MainTabsScreen';

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
    outputRange: ['rgba(255, 255, 255, 0.6)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} activeOpacity={1}>
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
  style,
}: {
  label: string;
  value: string | number;
  style?: object;
}) {
  return (
    <View style={[styles.card, styles.statBox, style]}>
      <Text style={styles.statBoxLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ProgressBar({ progress, label }: { progress: number; label: string }) {
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
}: {
  onNavigate?: (screen: string) => void;
  onTabChange?: (tab: MainTabId) => void;
  isGuestMode?: boolean;
  isAuthenticated?: boolean;
  onLeaveGuestMode?: () => void;
}) {
  const [userName, setUserName] = useState('—');
  const [rankName, setRankName] = useState('—');
  const [progress, setProgress] = useState(0);
  const [streak, setStreak] = useState<string | number>('—');
  const [highStreak, setHighStreak] = useState<string | number>('—');
  const [masteredCount, setMasteredCount] = useState<string | number>('—');
  const [unmasteredCount, setUnmasteredCount] = useState<string | number>('—');
  const [wrongCount, setWrongCount] = useState<string | number>('—');
  const [isLoading, setIsLoading] = useState(true);

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
    const user = await getCurrentUser();
    if (!user) {
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

    const streakRes = await bumpUserStreak(user.id);
    if (streakRes.data) {
      setStreak(streakRes.data.current_streak);
      setHighStreak(streakRes.data.highest_streak);
    } else {
      const { data: stats } = await getOrCreateUserStats(user.id);
      applyStreakFromStats(stats);
    }

    const { data: diffStats } = await getDifficultyStats(user.id);
    applyDifficultyStats(diffStats);

    const [{ data: mastered }, { data: wrongQuestions }] = await Promise.all([
      getMasteredCount(user.id),
      getAllWrongQuestions(user.id, 1000),
    ]);
    setMasteredCount(mastered ?? 0);
    setWrongCount(wrongQuestions?.length ?? 0);

    if (diffStats) {
      const totalUnmastered = diffStats.reduce((sum, s) => sum + s.unmastered, 0);
      setUnmasteredCount(totalUnmastered);
    } else {
      setUnmasteredCount(0);
    }

    setIsLoading(false);
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

  const applyDifficultyStats = (stats: DifficultyStats[] | null) => {
    if (!stats || stats.length === 0) {
      setRankName(rankForDifficulty('easy').name);
      setProgress(0);
      return;
    }
    const diff = currentDifficulty(stats);
    setRankName(rankForDifficulty(diff).name);
    const cur = stats.find((s) => s.difficulty === diff);
    setProgress(difficultyProgress(cur));
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDailyChallenge = () => {
    if (!isAuthenticated || isGuestMode) {
      Alert.alert('Sign In Required', 'Sign in to start your daily challenge.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => onNavigate?.('login') },
      ]);
      return;
    }
    onTabChange?.('challenge');
  };

  const handlePracticeMode = () => {
    onNavigate?.('story');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingWrap]}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, styles.appNameCard]}>
        <Text style={styles.appNameText}>CertamenApp</Text>
      </View>

      <View style={[styles.card, styles.userCard]}>
        <Text style={styles.userNameText}>{userName}</Text>
        <Text style={styles.userRankText}>
          Rank: <Text style={styles.userMetaValue}>{rankName}</Text>
        </Text>
        <ProgressBar progress={progress} label="Progress through this rank" />
      </View>

      <View style={styles.gridSection}>
        <View style={styles.topGridRow}>
          <View style={styles.leftStatsColumn}>
            <StatBox label="# of Mastered questions:" value={masteredCount} style={styles.topStatBox} />
            <StatBox label="# of Unmastered questions:" value={unmasteredCount} style={styles.topStatBox} />
          </View>
          <AnimatedCardButton
            label="Start your Daily Challenge!"
            onPress={handleDailyChallenge}
            style={styles.dailyChallengeWrap}
          />
        </View>

        <View style={styles.bottomGridRow}>
          <StatBox label="# of Wrong questions:" value={wrongCount} style={styles.bottomStatBox} />
          <View style={[styles.card, styles.statBox, styles.bottomStatBox]}>
            <Text style={styles.statBoxLabel}>Streak Counter:</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statSubLabel}>
              High: <Text style={styles.statSubValue}>{highStreak}</Text>
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.practiceLink} onPress={handlePracticeMode} activeOpacity={0.7}>
        <Text style={styles.practiceLinkText}>Open Practice Mode</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  appNameCard: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  appNameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.8,
  },
  userCard: {
    gap: 8,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.4,
  },
  userRankText: {
    fontSize: 14,
    color: '#3a3a3a',
    letterSpacing: 0.3,
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
    fontSize: 11,
    color: '#6a6a6a',
    letterSpacing: 0.2,
  },
  progressLabelValue: {
    fontSize: 11,
    color: '#6a6a6a',
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
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
    minHeight: 76,
  },
  bottomGridRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  bottomStatBox: {
    flex: 1,
    minHeight: 72,
  },
  statBox: {
    justifyContent: 'space-between',
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#3a3a3a',
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6a6a6a',
    marginTop: 6,
  },
  statSubLabel: {
    fontSize: 10,
    color: '#8a8a8a',
    letterSpacing: 0.2,
    marginTop: 4,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#3a3a3a',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  practiceLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  practiceLinkText: {
    fontSize: 12,
    color: '#6a6a6a',
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },
});
