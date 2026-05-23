import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getDifficultyStats } from '../services/userMasteredService';
import {
  CHALLENGE_RANKS,
  currentDifficulty,
  difficultyProgress,
  rankForDifficulty,
  type ChallengeDifficulty,
  type DifficultyStats,
} from '../lib/challengeRanks';
import type { MainTabId } from './MainTabsScreen';
import type { ChallengeGameMode } from './ChallengeGameScreen';

const SET_SIZES = [10, 20, 30, 40, 50] as const;

export function ChallengeModeScreen({
  isAuthenticated,
  isGuestMode,
  onNavigate,
  onTabChange,
  onStartChallengeGame,
}: {
  isAuthenticated?: boolean;
  isGuestMode?: boolean;
  onNavigate?: (screen: string) => void;
  onTabChange?: (tab: MainTabId) => void;
  onStartChallengeGame?: (
    mode: ChallengeGameMode,
    setSize: number,
    difficulty?: ChallengeDifficulty
  ) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DifficultyStats[]>([]);
  const [setSize, setSetSize] = useState<number>(10);

  const load = useCallback(async () => {
    if (!isAuthenticated || isGuestMode) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      setIsLoading(false);
      return;
    }
    const { data } = await getDifficultyStats(user.id);
    setStats(data ?? []);
    setIsLoading(false);
  }, [isAuthenticated, isGuestMode]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated || isGuestMode) {
    return (
      <View style={[styles.container, styles.centerWrap]}>
        <Text style={styles.title}>Challenge Mode</Text>
        <Text style={styles.subtitle}>Sign in to start a challenge.</Text>
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => onNavigate?.('login')}
          activeOpacity={0.85}
        >
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerWrap]}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  const diff: ChallengeDifficulty = currentDifficulty(stats);
  const cur = stats.find((s) => s.difficulty === diff);
  const rank = rankForDifficulty(diff);
  const progress = difficultyProgress(cur);
  const unmasteredHere = cur?.unmastered ?? 0;
  const allDone = stats.length > 0 && stats.every((s) => s.unmastered + s.wrong === 0);

  const effectiveSetSize = Math.min(setSize, Math.max(unmasteredHere, 0));

  const handleStart = () => {
    if (allDone) {
      Alert.alert(
        'You have reached the pinnacle!',
        'You have already mastered every question. Try Practice Mode to keep sharp.',
        [
          { text: 'Open Practice Mode', onPress: () => onNavigate?.('story') },
          { text: 'Close', style: 'cancel' },
        ]
      );
      return;
    }
    if (unmasteredHere === 0) {
      Alert.alert(
        'No unmastered questions',
        `You have nothing left to learn at ${rank.name}. Master any wrong questions in the Review tab to finish this rank.`,
        [
          { text: 'Open Review', onPress: () => onTabChange?.('review') },
          { text: 'Close', style: 'cancel' },
        ]
      );
      return;
    }
    onStartChallengeGame?.('challenge', effectiveSetSize, diff);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, styles.rankCard]}>
        <Text style={styles.rankLabel}>Current Rank</Text>
        <Text style={styles.rankName}>{rank.name}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsRowText}>Mastered: {cur?.mastered ?? 0}</Text>
          <Text style={styles.statsRowText}>Unmastered: {cur?.unmastered ?? 0}</Text>
          <Text style={styles.statsRowText}>Wrong: {cur?.wrong ?? 0}</Text>
        </View>
      </View>

      <View style={[styles.card, styles.pickerCard]}>
        <Text style={styles.pickerLabel}>Questions per set</Text>
        <View style={styles.pickerRow}>
          {SET_SIZES.map((n) => {
            const selected = setSize === n;
            const greyed = n > unmasteredHere;
            return (
              <TouchableOpacity
                key={n}
                style={[
                  styles.pickerChip,
                  selected && styles.pickerChipSelected,
                  greyed && styles.pickerChipGreyed,
                ]}
                onPress={() => setSetSize(n)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pickerChipText,
                    selected && styles.pickerChipTextSelected,
                    greyed && styles.pickerChipTextGreyed,
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {unmasteredHere > 0 && unmasteredHere < setSize && (
          <Text style={styles.pickerCaption}>
            Only {unmasteredHere} unmastered questions left at {rank.name} — your set will be capped.
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text style={styles.startBtnText}>
          {unmasteredHere === 0 ? 'Rank Complete' : `Start ${effectiveSetSize}-question set`}
        </Text>
      </TouchableOpacity>

      <View style={[styles.card, styles.allRanksCard]}>
        <Text style={styles.allRanksTitle}>All ranks</Text>
        {(['easy', 'medium', 'hard'] as ChallengeDifficulty[]).map((d) => {
          const s = stats.find((x) => x.difficulty === d);
          const r = CHALLENGE_RANKS[d];
          const p = difficultyProgress(s);
          return (
            <View key={d} style={styles.rankRow}>
              <View style={styles.rankRowHead}>
                <Text style={styles.rankRowName}>{r.name}</Text>
                <Text style={styles.rankRowCaption}>
                  {s ? `${s.mastered}/${s.totalQuestions}` : '—'}
                </Text>
              </View>
              <View style={styles.progressTrackSmall}>
                <View style={[styles.progressFill, { width: `${Math.round(p * 100)}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
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
  centerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6a6a6a',
    textAlign: 'center',
  },
  signInBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.55)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signInBtnText: {
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  rankCard: {
    gap: 8,
  },
  rankLabel: {
    fontSize: 11,
    color: '#6a6a6a',
    letterSpacing: 0.3,
  },
  rankName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3a3a3a',
    letterSpacing: 0.4,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(201, 169, 97, 0.18)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressTrackSmall: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(201, 169, 97, 0.18)',
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#c9a961',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  statsRowText: {
    fontSize: 11,
    color: '#6a6a6a',
    letterSpacing: 0.2,
  },
  pickerCard: {
    gap: 10,
  },
  pickerLabel: {
    fontSize: 13,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    minWidth: 56,
    alignItems: 'center',
  },
  pickerChipSelected: {
    backgroundColor: 'rgba(201, 169, 97, 0.35)',
    borderColor: '#c9a961',
  },
  pickerChipGreyed: {
    opacity: 0.45,
  },
  pickerChipText: {
    fontSize: 14,
    color: '#3a3a3a',
    fontWeight: '500',
  },
  pickerChipTextSelected: {
    fontWeight: '700',
  },
  pickerChipTextGreyed: {
    color: '#9a9a9a',
  },
  pickerCaption: {
    fontSize: 11,
    color: '#8a6a3a',
    letterSpacing: 0.2,
  },
  startBtn: {
    backgroundColor: '#c9a961',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#9d856b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  allRanksCard: {
    gap: 10,
  },
  allRanksTitle: {
    fontSize: 13,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  rankRow: {
    gap: 2,
  },
  rankRowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankRowName: {
    fontSize: 12,
    color: '#3a3a3a',
    letterSpacing: 0.2,
  },
  rankRowCaption: {
    fontSize: 11,
    color: '#6a6a6a',
    fontWeight: '500',
  },
});
