import React, { useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import {
  getOrCreateUserSettings,
  updateSetting,
  type PracticeSessionDifficulty,
  normalizePracticeDifficulties,
  PRACTICE_DIFFICULTY_OPTIONS,
} from '../services/userSettingsService';
import { getAllWrongQuestions } from '../services/questionReviewService';
import { useIPadScaledStyles } from '../lib/layout';

function AnimatedButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useIPadScaledStyles(baseStyles);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.timing(bgColorAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(bgColorAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.6)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.button, { backgroundColor }]}>
          <Text style={styles.buttonText}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SettingsScreen({
  onNavigate,
  previousScreen,
  isGuestMode,
}: {
  onNavigate?: (screen: string) => void;
  previousScreen?: string;
  isGuestMode?: boolean;
}) {
  const styles = useIPadScaledStyles(baseStyles);
  const [wrongQuestionsOnly, setWrongQuestionsOnly] = React.useState(false);
  const [numTossups, setNumTossups] = React.useState(20);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [wrongQuestionCount, setWrongQuestionCount] = React.useState(0);
  const [practiceSessionDifficulties, setPracticeSessionDifficulties] =
    React.useState<PracticeSessionDifficulty[]>(['easy']);

  // Extract loading logic into reusable function
  const loadSettingsData = React.useCallback(async () => {
    setIsLoading(true);
    
    // Use special 'guest' ID for guest mode
    const effectiveUserId = isGuestMode ? 'guest' : null;
    
    const user = isGuestMode ? null : await getCurrentUser();
    const userIdToUse = user?.id || effectiveUserId;
    
    if (userIdToUse) {
      setUserId(userIdToUse);
      const { data: settings, error } = await getOrCreateUserSettings(userIdToUse);
      if (settings && !error) {
        setWrongQuestionsOnly(settings.wrong_questions_only);
        setNumTossups(settings.num_tossups);
        setPracticeSessionDifficulties(
          normalizePracticeDifficulties(settings.practice_session_difficulty)
        );
      }
      
      // Fetch wrong question count (only for authenticated users)
      if (!isGuestMode && user) {
        const { data: wrongQuestions } = await getAllWrongQuestions(user.id, 1000);
        if (wrongQuestions) {
          setWrongQuestionCount(wrongQuestions.length);
        }
      }
    }
    setIsLoading(false);
  }, [isGuestMode]);

  // Load on mount and whenever the user/scope changes. The screen remounts on
  // each navigation, so a single effect keyed on loadSettingsData covers both
  // initial load and re-entry without the double-fetch race of two effects.
  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // Handle toggle change and save to database
  const handleWrongQuestionsToggle = async (value: boolean) => {
    // A wrong-questions-only session needs at least one wrong question, otherwise
    // the game would load an empty set. Block enabling it and explain why.
    if (value && wrongQuestionCount === 0) {
      Alert.alert(
        'No wrong questions yet',
        'You have no wrong questions to review right now. Practice or take a Challenge set first.'
      );
      return;
    }
    setWrongQuestionsOnly(value);
    
    if (userId) {
      await updateSetting(userId, 'wrong_questions_only', value);
    }

    // Auto-adjust number of questions when toggling
    if (value && wrongQuestionCount > 0) {
      // When toggling ON: set to wrong question count (capped at 50)
      const newNumQuestions = Math.min(wrongQuestionCount, 50);
      setNumTossups(newNumQuestions);
      if (userId) {
        await updateSetting(userId, 'num_tossups', newNumQuestions);
      }
    } else if (!value && numTossups < 5) {
      // When toggling OFF: ensure minimum is 5
      setNumTossups(5);
      if (userId) {
        await updateSetting(userId, 'num_tossups', 5);
      }
    }
  };

  // Multi-select difficulties; never allow zero checked.
  const handlePracticeDifficultyToggle = async (id: PracticeSessionDifficulty) => {
    if (!userId) return;
    const selected = new Set(practiceSessionDifficulties);
    if (selected.has(id)) {
      if (selected.size <= 1) return;
      selected.delete(id);
    } else {
      selected.add(id);
    }
    const next = PRACTICE_DIFFICULTY_OPTIONS.filter((d) => selected.has(d));
    setPracticeSessionDifficulties(next);
    await updateSetting(userId, 'practice_session_difficulty', next);
  };

  const handleNumTossupsChange = async (newValue: number) => {
    const minQuestions =
      wrongQuestionsOnly ? Math.min(5, wrongQuestionCount || 1) : 5;
    const maxQuestions =
      wrongQuestionsOnly ? Math.min(wrongQuestionCount, 50) : 50;
    // Clamp between minQuestions and maxQuestions
    const clampedValue = Math.max(minQuestions, Math.min(maxQuestions, newValue));
    setNumTossups(clampedValue);
    
    if (userId) {
      await updateSetting(userId, 'num_tossups', clampedValue);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container]}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  const settingsBody = (
    <>
      <Text style={styles.titleText}>Settings</Text>

      <View style={styles.settingsContainer}>
        <View style={styles.counterRow}>
          <Text style={styles.optionText}># of questions</Text>
          <View style={styles.counterControls}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => handleNumTossupsChange(numTossups - 5)}
              activeOpacity={0.7}
            >
              <Text style={styles.counterButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{numTossups}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => handleNumTossupsChange(numTossups + 5)}
              activeOpacity={0.7}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        {wrongQuestionsOnly && (
          <Text style={styles.helperText}>
            Max: {Math.min(wrongQuestionCount, 50)} (based on your wrong questions)
          </Text>
        )}

        <>
          <View style={styles.toggleRow}>
            <Text style={[styles.optionText, isGuestMode && styles.disabledText]}>
              Wrong questions only
            </Text>
            <Switch
              value={wrongQuestionsOnly}
              onValueChange={handleWrongQuestionsToggle}
              trackColor={{ false: '#d4d4d4', true: '#c9a961' }}
              thumbColor={wrongQuestionsOnly ? '#d4b76a' : '#f4f3f4'}
              ios_backgroundColor="#d4d4d4"
              disabled={isGuestMode}
            />
          </View>
          {isGuestMode && (
            <Text style={styles.guestHelperText}>
              Sign in to save missed questions and use Wrong questions only
            </Text>
          )}
        </>

        <View style={styles.difficultySection}>
            <Text style={styles.sectionTitle}>Difficulty</Text>
            <Text style={styles.difficultyHint}>Select one or more</Text>
            <View style={styles.difficultyRow}>
              {(
                [
                  { id: 'easy' as const, label: 'Easy' },
                  { id: 'medium' as const, label: 'Medium' },
                  { id: 'hard' as const, label: 'Hard' },
                ] as const
              ).map(({ id, label }) => {
                const checked = practiceSessionDifficulties.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.difficultyTap}
                    onPress={() => handlePracticeDifficultyToggle(id)}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                  >
                    <View
                      style={[
                        styles.difficultyCheckbox,
                        checked && styles.difficultyCheckboxSelected,
                      ]}
                    >
                      {checked && <Text style={styles.difficultyCheckMark}>✓</Text>}
                    </View>
                    <Text style={styles.difficultyLabel}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
      </View>
    </>
  );

  return (
    <View style={[styles.containerPractice]}>
      <ScrollView
        style={styles.scrollPractice}
        contentContainerStyle={styles.scrollPracticeContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentContainer}>{settingsBody}</View>
        <View style={styles.backInScroll}>
          <AnimatedButton label="Back" onPress={() => onNavigate?.(previousScreen || 'main')} />
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  contentContainer: {
    width: '100%',
    gap: 28,
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  settingsContainer: {
    gap: 22,
  },
  optionText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  helperText: {
    color: '#8b7355',
    fontSize: 12,
    marginTop: -8,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  counterButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3a3a3a',
    lineHeight: 24,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3a3a',
    minWidth: 40,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  disabledText: {
    color: '#999',
  },
  guestHelperText: {
    color: '#8b7355',
    fontSize: 12,
    marginTop: -8,
    fontStyle: 'italic',
  },
  containerPractice: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  scrollPractice: {
    flex: 1,
    width: '100%',
  },
  scrollPracticeContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 36,
  },
  backInScroll: {
    marginTop: 28,
    alignItems: 'center',
    paddingBottom: 8,
  },
  difficultySection: {
    gap: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.3,
  },
  difficultyHint: {
    fontSize: 12,
    color: '#8a6a3a',
    letterSpacing: 0.2,
  },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  difficultyTap: {
    alignItems: 'center',
    gap: 8,
    minWidth: 76,
  },
  difficultyCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(120, 120, 120, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyCheckboxSelected: {
    borderColor: '#b8954a',
    backgroundColor: 'rgba(201, 169, 97, 0.35)',
  },
  difficultyCheckMark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8a6a3a',
    lineHeight: 18,
  },
  difficultyLabel: {
    fontSize: 14,
    color: '#3a3a3a',
    letterSpacing: 0.3,
  },
});