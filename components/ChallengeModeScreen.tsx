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
import { getRankStats } from '../services/userMasteredService';
import {
  MASTERY_RANKS,
  MASTERY_RANK_COUNT,
  allRanksComplete,
  currentRankFromStats,
  rankProgressFromStats,
  type RankStats,
} from '../lib/masteryRanks';
import type { MainTabId } from './MainTabsScreen';
import type { ChallengeGameMode } from './ChallengeGameScreen';
import { ButtonDot } from './ButtonDot';

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
    rankIndex?: number
  ) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [rankStats, setRankStats] = useState<RankStats[]>([]);
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
    const { data: rankData } = await getRankStats(user.id);
    setRankStats(rankData ?? []);
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
          <ButtonDot />
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

  const rankIdx = currentRankFromStats(rankStats);
  const cur = rankStats.find((s) => s.rankIndex === rankIdx);
  const rankName = MASTERY_RANKS[rankIdx];
  const progress = rankProgressFromStats(cur);
  const unmasteredHere = cur?.unmastered ?? 0;
  const allDone = allRanksComplete(rankStats);

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
        `You have nothing left to learn at ${rankName}. Master any wrong questions in the Review tab to finish this rank.`,
        [
          { text: 'Open Review', onPress: () => onTabChange?.('review') },
          { text: 'Close', style: 'cancel' },
        ]
      );
      return;
    }
    onStartChallengeGame?.('challenge', effectiveSetSize, rankIdx);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, styles.rankCard]}>
        <Text style={styles.rankLabel}>Current Rank</Text>
        <Text style={styles.rankName}>{rankName}</Text>
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { flex: 1 }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsRowText}>Mastered: {cur?.mastered ?? 0}</Text>
          <Text style={styles.statsRowText}>Unmastered: {cur?.unmastered ?? 0}</Text>
          <Text style={styles.statsRowText}>Wrong: {cur?.wrong ?? 0}</Text>
        </View>
      </View>

      <View style={[styles.card, styles.pickerCard]}>
        <Text style={styles.pickerLabel}>Questions per set</Text>
        {([SET_SIZES.slice(0, 3), SET_SIZES.slice(3)] as const).map((row, rowIdx) => (
          <View key={rowIdx} style={styles.pickerRow}>
            {row.map((n) => {
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
                  <ButtonDot color={selected ? '#8a6a3a' : '#c9a961'} />
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
        ))}
        {unmasteredHere > 0 && unmasteredHere < setSize && (
          <Text style={styles.pickerCaption}>
            Only {unmasteredHere} unmastered questions left at {rankName} — your set will be capped.
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={handleStart}
        activeOpacity={0.85}
      >
          <ButtonDot color="#fff" />
          <Text style={styles.startBtnText}>
            {unmasteredHere === 0 ? 'Rank Complete' : `Start ${effectiveSetSize}-question set`}
          </Text>
      </TouchableOpacity>

      <View style={[styles.card, styles.allRanksCard]}>
        <Text style={styles.allRanksTitle}>All ranks</Text>
        {Array.from({ length: MASTERY_RANK_COUNT }, (_, idx) => {
          const name = MASTERY_RANKS[idx];
          const s = rankStats.find((x) => x.rankIndex === idx);
          const inRank = s?.mastered ?? 0;
          const total = s?.totalQuestions ?? 100;
          const p = rankProgressFromStats(s);
          const isCurrentRank = idx === rankIdx;
          return (
            <View key={name} style={styles.rankRow}>
              <View style={styles.rankRowHead}>
                <Text style={[styles.rankRowName, isCurrentRank && styles.rankRowNameCurrent]}>
                  {name}
                </Text>
                <Text style={styles.rankRowCaption}>
                  {s ? `${inRank}/${total}` : '—'}
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressPct: {
    fontSize: 11,
    color: '#8a6a3a',
    fontWeight: '600',
    letterSpacing: 0.2,
    minWidth: 32,
    textAlign: 'right',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(201, 169, 97, 0.18)',
    overflow: 'hidden',
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
    justifyContent: 'center',
    gap: 8,
  },
  pickerChip: {
    paddingLeft: 32,
    paddingRight: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    minWidth: 72,
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
  rankRowNameCurrent: {
    fontWeight: '700',
    color: '#8a6a3a',
  },
  rankRowCaption: {
    fontSize: 11,
    color: '#6a6a6a',
    fontWeight: '500',
  },
});
