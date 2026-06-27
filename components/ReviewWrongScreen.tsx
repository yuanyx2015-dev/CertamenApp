import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getAllWrongQuestions } from '../services/questionReviewService';
import type { ChallengeGameMode } from './ChallengeGameScreen';

/**
 * Format a wrong-question count: < 1000 stays as a plain integer;
 * >= 1000 shrinks to "X.YYY k" with trailing zeros trimmed for readability
 * (e.g. 1249 -> "1.249 k", 2000 -> "2 k", 1050 -> "1.05 k").
 */
function formatWrongCount(n: number): string {
  if (n < 1000) return String(n);
  const trimmed = (n / 1000).toFixed(3).replace(/\.?0+$/, '');
  return `${trimmed} k`;
}

export function ReviewWrongScreen({
  isAuthenticated,
  onNavigate,
  onStartChallengeGame,
}: {
  isAuthenticated?: boolean;
  onNavigate?: (screen: string) => void;
  onStartChallengeGame?: (
    mode: ChallengeGameMode,
    setSize: number,
    rankIndex?: number
  ) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [wrongCount, setWrongCount] = useState(0);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      setIsLoading(false);
      return;
    }
    const { data } = await getAllWrongQuestions(user.id, 1000);
    setWrongCount(data?.length ?? 0);
    setIsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerWrap]}>
        <Text style={styles.title}>Review Questions</Text>
        <Text style={styles.subtitle}>Sign in to review the questions you got wrong.</Text>
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

  const handleStart = () => {
    if (wrongCount === 0) {
      Alert.alert(
        'No wrong questions',
        "You don't have any wrong questions right now. Take a Challenge Mode set and any questions you miss will land here."
      );
      return;
    }
    onStartChallengeGame?.('review', wrongCount);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, styles.summaryCard]}>
        <Text style={styles.summaryLabel}>Review Questions</Text>
        <Text style={styles.summaryValue}>{formatWrongCount(wrongCount)}</Text>
        <Text style={styles.summaryCaption}>Total questions to review</Text>
      </View>

      <View style={[styles.card, styles.infoCard]}>
        <Text style={styles.infoTitle}>How Review works</Text>
        <Text style={styles.infoBody}>
          Master these questions to remove them from your wrong pool and add them to your mastered count.
          Once mastered here, a question stays mastered — it will not reappear in Challenge Mode.
        </Text>
        <Text style={styles.infoBodyMuted}>
          Note: questions you miss in Practice Mode don't show up here — only Challenge Mode and Review
          itself feed this list.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.startBtn, wrongCount === 0 && styles.startBtnDisabled]}
        onPress={handleStart}
        activeOpacity={0.85}
      >
          <Text style={styles.startBtnText}>
            {wrongCount === 0 ? 'No wrong questions' : 'Start review session'}
          </Text>
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
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
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
  summaryCard: {
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6a6a6a',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3a3a3a',
  },
  summaryCaption: {
    marginTop: 4,
    fontSize: 12,
    color: '#6a6a6a',
    lineHeight: 17,
  },
  infoCard: {
    gap: 6,
  },
  infoTitle: {
    fontSize: 13,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoBody: {
    fontSize: 13,
    color: '#3a3a3a',
    lineHeight: 19,
    letterSpacing: 0.2,
  },
  infoBodyMuted: {
    marginTop: 6,
    fontSize: 12,
    color: '#8a8a8a',
    lineHeight: 17,
    letterSpacing: 0.2,
    fontStyle: 'italic',
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
  startBtnDisabled: {
    backgroundColor: '#bdb7a8',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
