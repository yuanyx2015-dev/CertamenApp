import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated
} from 'react-native';
import { Text } from '../lib/AppText';
import { useIPadScaledStyles } from '../lib/layout';
import { getCurrentUser } from '../services/authService';
import {
  getOrCreateUserSettings,
  normalizePracticeDifficulties,
  normalizePracticeQuestionPool,
  type PracticeQuestionPool,
} from '../services/userSettingsService';
import {
  countPoolByCategory,
  fetchPracticePoolQuestions,
} from '../services/practicePoolService';
const PRACTICE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'mythology', label: 'Mythology' },
  { key: 'history', label: 'History' },
  { key: 'language', label: 'Language' },
  { key: 'literature', label: 'Literature' },
  { key: 'culture-life', label: 'Culture & Life' },
  { key: 'living-latin', label: 'Living Latin' },
];

function CategoryBox({
  label,
  count,
  onPress,
}: {
  label: string;
  /** Wrong / Mastered pool count at the selected difficulties; null in All. */
  count: number | null;
  onPress: () => void;
}) {
  const styles = useIPadScaledStyles(baseStyles);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }),
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
    outputRange: ['#f0e6d3', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '47%' }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.categoryButton, { backgroundColor }]}>
          <Text style={styles.categoryLabel}>{label}</Text>
          {count !== null && (
            <Text style={[styles.categoryCount, count === 0 && styles.categoryCountEmpty]}>
              {count === 0 ? 'none available' : `${count} available`}
            </Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

type NavigateFn = (
  screen: string,
  category?: string,
  practiceDifficulty?: 'easy' | 'medium' | 'hard'
) => void;

export function PracticeCategorySessionPicker({ onNavigate }: { onNavigate?: NavigateFn }) {
  const styles = useIPadScaledStyles(baseStyles);
  const [pool, setPool] = React.useState<PracticeQuestionPool>('all');
  const [counts, setCounts] = React.useState<Record<string, number> | null>(null);

  // Counts only mean something for the per-user Wrong / Mastered lists, so All
  // shows plain tiles and skips the fetch entirely.
  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const user = await getCurrentUser();
      if (!user) {
        if (!cancelled) {
          setPool('all');
          setCounts(null);
        }
        return;
      }

      const { data: settings } = await getOrCreateUserSettings(user.id);
      const activePool = normalizePracticeQuestionPool(
        settings?.practice_question_pool,
        !!settings?.wrong_questions_only
      );
      if (cancelled) return;
      setPool(activePool);

      if (activePool === 'all') {
        setCounts(null);
        return;
      }

      const difficulties = normalizePracticeDifficulties(
        settings?.practice_session_difficulty
      );
      const { data, error } = await fetchPracticePoolQuestions(user.id, activePool);
      if (cancelled) return;
      setCounts(error ? null : countPoolByCategory(data, difficulties));
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.grid}>
      {PRACTICE_CATEGORIES.map(({ key, label }) => (
        <CategoryBox
          key={key}
          label={label}
          count={pool === 'all' || !counts ? null : (counts[key] ?? 0)}
          onPress={() => onNavigate?.('practice-game', key)}
        />
      ))}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  categoryButton: {
    width: '100%',
    aspectRatio: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fbf8f4',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryLabel: {
    fontSize: 17,
    color: '#3a3a3a',
    letterSpacing: 0.2,
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryCount: {
    marginTop: 6,
    fontSize: 12,
    color: '#8a6a3a',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  categoryCountEmpty: {
    color: '#a8681f',
    fontStyle: 'italic',
  },
});
