import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable
} from 'react-native';
import { Text } from '../lib/AppText';
import { FitScrollView } from './FitScrollView';
import { getCurrentUser } from '../services/authService';
import { getRankStats } from '../services/userMasteredService';
import {
  MASTERY_RANKS,
  MASTERY_RANK_BLURBS,
  MASTERY_RANK_COUNT,
  allRanksComplete,
  currentRankFromStats,
  rankProgressFromStats,
  type RankStats,
} from '../lib/masteryRanks';
import type { MainTabId } from './MainTabsScreen';
import type { ChallengeGameMode } from './ChallengeGameScreen';
import { useIPadScaledStyles } from '../lib/layout';

const SET_SIZES = [10, 20, 30, 40, 50] as const;

/**
 * Trial polish for the All-ranks list (current emphasized; done/locked quieter).
 * Set to false to restore the previous flat list with zero other changes.
 */
const USE_RANK_HIERARCHY_UI = true;

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
  const styles = useIPadScaledStyles(baseStyles);
  const [isLoading, setIsLoading] = useState(true);
  const [rankStats, setRankStats] = useState<RankStats[]>([]);
  const [setSize, setSetSize] = useState<number>(10);
  /** Index of rank whose info popover is open; null when closed. */
  const [infoRankIdx, setInfoRankIdx] = useState<number | null>(null);

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
        <Text style={styles.subtitle}>
          Sign in to track mastery ranks and save your Challenge progress.
        </Text>
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

  const infoName = infoRankIdx !== null ? MASTERY_RANKS[infoRankIdx] : null;

  return (
    <>
    <FitScrollView
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
        <Text style={styles.rankNote}>
          To complete this rank, review and master all wrong questions in{' '}
          <Text
            style={styles.rankNoteLink}
            onPress={() => onTabChange?.('review')}
            accessibilityRole="link"
          >
            Review
          </Text>
          .
        </Text>
      </View>

      <View style={[styles.card, styles.pickerCard]}>
        <Text style={styles.pickerLabel}>Questions per set</Text>
        {([SET_SIZES.slice(0, 3), SET_SIZES.slice(3)] as const).map((row, rowIdx) => (
          <View key={rowIdx} style={styles.pickerRow}>
            {row.map((n) => {
              const selected = setSize === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.pickerChip, selected && styles.pickerChipSelected]}
                  onPress={() => setSetSize(n)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.pickerChipText, selected && styles.pickerChipTextSelected]}
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
          const total = s?.totalQuestions ?? 0;
          const p = rankProgressFromStats(s);
          const isCurrentRank = idx === rankIdx;
          const isCompletedRank = idx < rankIdx;
          const hierarchy = USE_RANK_HIERARCHY_UI;

          return (
            <View
              key={name}
              style={[
                styles.rankRow,
                hierarchy && isCurrentRank && styles.rankRowCurrent,
              ]}
            >
              <View style={styles.rankRowHead}>
                <View style={styles.rankRowNameWrap}>
                  <Text
                    style={[
                      styles.rankRowName,
                      isCurrentRank && styles.rankRowNameCurrent,
                      hierarchy && isCurrentRank && styles.rankRowNameCurrentHero,
                    ]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <TouchableOpacity
                    style={styles.rankInfoBtn}
                    onPress={() => setInfoRankIdx(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`About ${name}`}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rankInfoBtnText}>i</Text>
                  </TouchableOpacity>
                  {hierarchy && isCurrentRank && (
                    <Text style={styles.rankRowBadge}>Current</Text>
                  )}
                  {hierarchy && isCompletedRank && (
                    <Text style={styles.rankRowBadgeCompleted}>Completed</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.rankRowCaption,
                    hierarchy && isCurrentRank && styles.rankRowCaptionCurrent,
                  ]}
                >
                  {s ? `${inRank}/${total}` : '—'}
                </Text>
              </View>
              <View
                style={[
                  styles.progressTrackSmall,
                  hierarchy && isCurrentRank && styles.progressTrackCurrent,
                ]}
              >
                <View style={[styles.progressFill, { width: `${Math.round(p * 100)}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    </FitScrollView>

    <Modal
      visible={infoRankIdx !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setInfoRankIdx(null)}
    >
      <Pressable
        style={styles.infoBackdrop}
        onPress={() => setInfoRankIdx(null)}
        accessibilityLabel="Dismiss rank info"
      >
        <Pressable
          style={styles.infoCard}
          onPress={() => {
            /* swallow presses so the backdrop dismiss does not fire */
          }}
        >
          {infoName !== null && (
            <>
              <Text style={styles.infoTitle}>{infoName}</Text>
              <Text style={styles.infoBody}>{MASTERY_RANK_BLURBS[infoName]}</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const baseStyles = StyleSheet.create({
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
    fontSize: 24,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6a6a6a',
    textAlign: 'center',
    lineHeight: 21,
  },
  signInBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.55)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signInBtnText: {
    color: '#3a3a3a',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    fontSize: 12,
    color: '#6a6a6a',
    letterSpacing: 0.15,
  },
  rankName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#3a3a3a',
    letterSpacing: 0.2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressPct: {
    fontSize: 12,
    color: '#8a6a3a',
    fontWeight: '600',
    letterSpacing: 0.1,
    minWidth: 36,
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
    fontSize: 12,
    color: '#6a6a6a',
    letterSpacing: 0.1,
  },
  rankNote: {
    marginTop: 8,
    alignSelf: 'flex-end',
    maxWidth: '82%',
    fontSize: 13,
    lineHeight: 18,
    color: '#8a6a3a',
    letterSpacing: 0.1,
    textAlign: 'right',
  },
  rankNoteLink: {
    fontWeight: '700',
    color: '#8a6a3a',
  },
  pickerCard: {
    gap: 10,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  pickerChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    minWidth: 72,
    alignItems: 'center',
  },
  pickerChipSelected: {
    backgroundColor: 'rgba(201, 169, 97, 0.35)',
    borderColor: '#c9a961',
  },
  pickerChipText: {
    fontSize: 16,
    color: '#3a3a3a',
    fontWeight: '500',
  },
  pickerChipTextSelected: {
    fontWeight: '700',
  },
  pickerCaption: {
    fontSize: 12,
    color: '#8a6a3a',
    letterSpacing: 0.1,
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  allRanksCard: {
    gap: 10,
  },
  allRanksTitle: {
    fontSize: 14,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  rankRow: {
    gap: 2,
  },
  // Hierarchy trial styles — unused when USE_RANK_HIERARCHY_UI is false.
  rankRowCurrent: {
    marginVertical: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.65)',
    backgroundColor: 'rgba(201, 169, 97, 0.16)',
    gap: 4,
  },
  rankRowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankRowNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  rankRowName: {
    fontSize: 13,
    color: '#3a3a3a',
    letterSpacing: 0.1,
  },
  rankRowNameCurrent: {
    fontWeight: '700',
    color: '#8a6a3a',
  },
  rankRowNameCurrentHero: {
    fontSize: 17,
    letterSpacing: 0.15,
    color: '#4a3728',
  },
  rankRowBadge: {
    // All-caps micro badge: keep tracking, but Spectral needs the extra px.
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#8a6a3a',
    backgroundColor: 'rgba(201, 169, 97, 0.28)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  rankRowBadgeCompleted: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: '#7a6a55',
  },
  rankInfoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 58, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    overflow: 'hidden',
  },
  rankInfoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    // Italic Spectral "i" sits high in its em-box; keep upright for true center.
    fontStyle: 'normal',
    color: '#8a6a3a',
    lineHeight: 11,
    textAlign: 'center',
    includeFontPadding: false,
    // Tiny optical nudge so the glyph's visual center matches the circle.
    transform: [{ translateY: 0.5 }],
  },
  rankRowCaption: {
    fontSize: 12,
    color: '#6a6a6a',
    fontWeight: '500',
  },
  rankRowCaptionCurrent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a6a3a',
  },
  progressTrackCurrent: {
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  infoBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    // Very light so the list stays readable — not a heavy dim sheet.
    backgroundColor: 'rgba(58, 45, 28, 0.12)',
  },
  infoCard: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#fbf7ef',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#3a2a1a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4a3728',
    letterSpacing: 0.15,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5a5a5a',
  },
});
