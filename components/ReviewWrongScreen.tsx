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
import type { MainTabId } from './MainTabsScreen';

const SET_SIZES = [10, 20, 30, 40, 50] as const;

export function ReviewWrongScreen({
  isAuthenticated,
  onNavigate,
  onTabChange,
}: {
  isAuthenticated?: boolean;
  onNavigate?: (screen: string) => void;
  onTabChange?: (tab: MainTabId) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [wrongCount, setWrongCount] = useState(0);
  const [setSize, setSetSize] = useState<number>(10);

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
        <Text style={styles.title}>Review Wrong Questions</Text>
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

  const effectiveSetSize = Math.min(setSize, wrongCount);

  const handleStart = () => {
    if (wrongCount === 0) {
      Alert.alert(
        'No wrong questions',
        "You don't have any wrong questions right now. Take a Challenge Mode set and any questions you miss will land here."
      );
      return;
    }
    Alert.alert(
      'Review game UI is coming next',
      `Ready to review ${effectiveSetSize} wrong question${effectiveSetSize === 1 ? '' : 's'}. The in-question UI (Continue + hold-to-master star) is the next build phase.`
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, styles.summaryCard]}>
        <Text style={styles.summaryLabel}>Wrong Questions</Text>
        <Text style={styles.summaryValue}>{wrongCount}</Text>
        <Text style={styles.summaryCaption}>
          Master any of these to remove them from your wrong pool and add them to your mastered count.
        </Text>
      </View>

      <View style={[styles.card, styles.pickerCard]}>
        <Text style={styles.pickerLabel}>Questions per session</Text>
        <View style={styles.pickerRow}>
          {SET_SIZES.map((n) => {
            const selected = setSize === n;
            const greyed = n > wrongCount;
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
        {wrongCount > 0 && wrongCount < setSize && (
          <Text style={styles.pickerCaption}>
            Only {wrongCount} wrong question{wrongCount === 1 ? '' : 's'} available — your session will be capped.
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.startBtn, wrongCount === 0 && styles.startBtnDisabled]}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text style={styles.startBtnText}>
          {wrongCount === 0 ? 'No wrong questions' : `Start ${effectiveSetSize}-question session`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => onTabChange?.('profile')}
        activeOpacity={0.85}
      >
        <Text style={styles.doneBtnText}>Done with learning</Text>
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
  startBtnDisabled: {
    backgroundColor: '#bdb7a8',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  doneBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
  },
  doneBtnText: {
    color: '#3a3a3a',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
