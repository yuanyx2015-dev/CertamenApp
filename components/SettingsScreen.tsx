import React, { useEffect } from 'react';
import {
  View,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../lib/AppText';
import { fontFamilyForRole } from '../lib/fonts';
import { getCurrentUser } from '../services/authService';
import {
  getOrCreateUserSettings,
  updateSetting,
  updateUserSettings,
  type PracticeSessionDifficulty,
  normalizePracticeDifficulties,
  PRACTICE_DIFFICULTY_OPTIONS,
  DEFAULT_PRE_BUZZ_SECONDS,
  DEFAULT_ANSWER_SECONDS,
  DEFAULT_READING_SPEED_MULTIPLIER,
  PRE_BUZZ_SECONDS_MIN,
  PRE_BUZZ_SECONDS_MAX,
  ANSWER_SECONDS_MIN,
  ANSWER_SECONDS_MAX,
  READING_SPEED_STOPS,
  FURTHER_ADJUSTMENT_DEFAULTS,
  clampPreBuzzSeconds,
  clampAnswerSeconds,
  clampReadingSpeedMultiplier,
  formatReadingSpeedLabel,
  parseTimerSecondsInput,
} from '../services/userSettingsService';
import { getAllWrongQuestions } from '../services/questionReviewService';
import { FitScrollView } from './FitScrollView';
import { useIPadScaledStyles } from '../lib/layout';

/** Half thumb width — insets the rail so end thumbs aren't clipped. */
const READING_SPEED_THUMB_INSET = 10;

/** Crisp checkbox mark — SVG so Spectral doesn’t shrink/offset a text “✓”. */
function DifficultyCheckMark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M3.2 8.2 L6.4 11.3 L12.8 4.5"
        stroke="#8a6a3a"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
/** Fixed label box half-width for centering under ticks. */
const READING_SPEED_LABEL_HALF = 24;

function ReadingSpeedSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const styles = useIPadScaledStyles(readingSpeedSliderStyles);
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackPageXRef = React.useRef(0);
  const trackRef = React.useRef<View>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const stops = READING_SPEED_STOPS;
  const clamped = clampReadingSpeedMultiplier(value);
  const stopIndex = Math.max(
    0,
    stops.findIndex((s) => s === clamped)
  );

  const valueFromPageX = React.useCallback(
    (pageX: number) => {
      if (trackWidth <= 0) return DEFAULT_READING_SPEED_MULTIPLIER;
      const x = pageX - trackPageXRef.current;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      const index = Math.round(ratio * (stops.length - 1));
      return stops[index];
    },
    [trackWidth, stops]
  );

  const measureTrack = React.useCallback(() => {
    trackRef.current?.measureInWindow((x) => {
      trackPageXRef.current = x;
    });
  }, []);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          measureTrack();
          onChangeRef.current(valueFromPageX(e.nativeEvent.pageX));
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          onChangeRef.current(valueFromPageX(e.nativeEvent.pageX));
        },
      }),
    [measureTrack, valueFromPageX]
  );

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
    measureTrack();
  };

  const thumbRatio = stops.length > 1 ? stopIndex / (stops.length - 1) : 0;
  const tickLeft = (i: number) =>
    stops.length > 1 ? (i / (stops.length - 1)) * trackWidth : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Reading speed</Text>
        <Text style={styles.currentValue}>{formatReadingSpeedLabel(clamped)}</Text>
      </View>
      <Text style={styles.subtext}>How fast the toss-up types out</Text>

      <View style={styles.rail}>
        <View style={styles.trackHit} {...panResponder.panHandlers}>
          <View
            ref={trackRef}
            style={styles.track}
            onLayout={onTrackLayout}
          >
            <View
              style={[
                styles.trackFill,
                { width: trackWidth > 0 ? thumbRatio * trackWidth : 0 },
              ]}
            />
            {trackWidth > 0 &&
              stops.map((stop, i) => (
                <View
                  key={stop}
                  pointerEvents="none"
                  style={[styles.tick, { left: tickLeft(i) }]}
                />
              ))}
            {trackWidth > 0 && (
              <View
                pointerEvents="none"
                style={[styles.thumb, { left: thumbRatio * trackWidth }]}
              />
            )}
          </View>
        </View>

        <View style={styles.labelsRow}>
          {trackWidth > 0 &&
            stops.map((stop, i) => (
              <Text
                key={stop}
                style={[
                  styles.tickLabel,
                  {
                    left:
                      READING_SPEED_THUMB_INSET +
                      tickLeft(i) -
                      READING_SPEED_LABEL_HALF,
                  },
                  stop === clamped && styles.tickLabelActive,
                ]}
                numberOfLines={1}
              >
                {formatReadingSpeedLabel(stop)}
              </Text>
            ))}
        </View>
      </View>
    </View>
  );
}

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
  const [preBuzzSeconds, setPreBuzzSeconds] = React.useState(DEFAULT_PRE_BUZZ_SECONDS);
  const [answerSeconds, setAnswerSeconds] = React.useState(DEFAULT_ANSWER_SECONDS);
  const [preBuzzText, setPreBuzzText] = React.useState(String(DEFAULT_PRE_BUZZ_SECONDS));
  const [answerText, setAnswerText] = React.useState(String(DEFAULT_ANSWER_SECONDS));
  const [readingSpeed, setReadingSpeed] = React.useState(DEFAULT_READING_SPEED_MULTIPLIER);
  const [furtherOpen, setFurtherOpen] = React.useState(false);

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
        const nextPreBuzz = clampPreBuzzSeconds(settings.pre_buzz_seconds);
        const nextAnswer = clampAnswerSeconds(settings.answer_seconds);
        setPreBuzzSeconds(nextPreBuzz);
        setAnswerSeconds(nextAnswer);
        setPreBuzzText(String(nextPreBuzz));
        setAnswerText(String(nextAnswer));
        setReadingSpeed(clampReadingSpeedMultiplier(settings.reading_speed_multiplier));
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

  const handlePreBuzzSecondsChange = async (newValue: number) => {
    const clamped = clampPreBuzzSeconds(newValue);
    setPreBuzzSeconds(clamped);
    setPreBuzzText(String(clamped));
    if (userId) {
      await updateSetting(userId, 'pre_buzz_seconds', clamped);
    }
  };

  const handleAnswerSecondsChange = async (newValue: number) => {
    const clamped = clampAnswerSeconds(newValue);
    setAnswerSeconds(clamped);
    setAnswerText(String(clamped));
    if (userId) {
      await updateSetting(userId, 'answer_seconds', clamped);
    }
  };

  const commitPreBuzzText = () => {
    const parsed = parseTimerSecondsInput(
      preBuzzText,
      PRE_BUZZ_SECONDS_MIN,
      PRE_BUZZ_SECONDS_MAX
    );
    if (parsed === null) {
      setPreBuzzText(String(preBuzzSeconds));
      return;
    }
    void handlePreBuzzSecondsChange(parsed);
  };

  const commitAnswerText = () => {
    const parsed = parseTimerSecondsInput(
      answerText,
      ANSWER_SECONDS_MIN,
      ANSWER_SECONDS_MAX
    );
    if (parsed === null) {
      setAnswerText(String(answerSeconds));
      return;
    }
    void handleAnswerSecondsChange(parsed);
  };

  const readingSpeedSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleReadingSpeedChange = (newValue: number) => {
    const clamped = clampReadingSpeedMultiplier(newValue);
    setReadingSpeed(clamped);
    if (!userId) return;
    if (readingSpeedSaveTimer.current) clearTimeout(readingSpeedSaveTimer.current);
    readingSpeedSaveTimer.current = setTimeout(() => {
      void updateSetting(userId, 'reading_speed_multiplier', clamped);
    }, 120);
  };

  const handleResetFurtherAdjustments = async () => {
    setPreBuzzSeconds(FURTHER_ADJUSTMENT_DEFAULTS.pre_buzz_seconds);
    setAnswerSeconds(FURTHER_ADJUSTMENT_DEFAULTS.answer_seconds);
    setPreBuzzText(String(FURTHER_ADJUSTMENT_DEFAULTS.pre_buzz_seconds));
    setAnswerText(String(FURTHER_ADJUSTMENT_DEFAULTS.answer_seconds));
    setReadingSpeed(FURTHER_ADJUSTMENT_DEFAULTS.reading_speed_multiplier);
    if (userId) {
      await updateUserSettings(userId, { ...FURTHER_ADJUSTMENT_DEFAULTS });
    }
  };

  const furtherAtDefaults =
    preBuzzSeconds === FURTHER_ADJUSTMENT_DEFAULTS.pre_buzz_seconds &&
    answerSeconds === FURTHER_ADJUSTMENT_DEFAULTS.answer_seconds &&
    readingSpeed === FURTHER_ADJUSTMENT_DEFAULTS.reading_speed_multiplier;

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
                      {checked && <DifficultyCheckMark />}
                    </View>
                    <Text style={styles.difficultyLabel}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        <View style={styles.furtherSection}>
          <TouchableOpacity
            style={styles.furtherHeader}
            onPress={() => setFurtherOpen((open) => !open)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: furtherOpen }}
            accessibilityLabel="Further adjustments"
          >
            <Text style={styles.sectionTitle}>Further adjustments</Text>
            <Text
              style={[
                styles.furtherCaret,
                furtherOpen && styles.furtherCaretExpanded,
              ]}
            >
              ⌃
            </Text>
          </TouchableOpacity>
          <Text style={styles.difficultyHint}>
            (Not recommended for casual Latin/Certamen students)
          </Text>

          {furtherOpen && (
            <View style={styles.furtherBody}>
              <View style={styles.counterRow}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionText}>Buzz timer</Text>
                  <Text style={styles.optionSubtext}>
                    Seconds to buzz after the question finishes
                  </Text>
                </View>
                <View style={styles.timerValueRow}>
                  <View style={styles.timerNumberBox}>
                    <TextInput
                      style={styles.counterInput}
                      value={preBuzzText}
                      onChangeText={setPreBuzzText}
                      onBlur={commitPreBuzzText}
                      onSubmitEditing={commitPreBuzzText}
                      keyboardType="default"
                      returnKeyType="done"
                      selectTextOnFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                      accessibilityLabel={`Buzz timer, ${PRE_BUZZ_SECONDS_MIN} to ${PRE_BUZZ_SECONDS_MAX} seconds`}
                    />
                  </View>
                  <Text style={styles.counterUnit}>seconds</Text>
                </View>
              </View>

              <View style={styles.counterRow}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionText}>Answer timer</Text>
                  <Text style={styles.optionSubtext}>
                    Seconds to answer after you buzz
                  </Text>
                </View>
                <View style={styles.timerValueRow}>
                  <View style={styles.timerNumberBox}>
                    <TextInput
                      style={styles.counterInput}
                      value={answerText}
                      onChangeText={setAnswerText}
                      onBlur={commitAnswerText}
                      onSubmitEditing={commitAnswerText}
                      keyboardType="default"
                      returnKeyType="done"
                      selectTextOnFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                      accessibilityLabel={`Answer timer, ${ANSWER_SECONDS_MIN} to ${ANSWER_SECONDS_MAX} seconds`}
                    />
                  </View>
                  <Text style={styles.counterUnit}>seconds</Text>
                </View>
              </View>

              <ReadingSpeedSlider
                value={readingSpeed}
                onChange={handleReadingSpeedChange}
              />
              <View style={styles.resetFurtherWrap}>
                <TouchableOpacity
                  style={[
                    styles.resetFurtherButton,
                    furtherAtDefaults && styles.resetFurtherButtonDisabled,
                  ]}
                  onPress={handleResetFurtherAdjustments}
                  activeOpacity={0.7}
                  disabled={furtherAtDefaults}
                  accessibilityRole="button"
                  accessibilityLabel="Reset further adjustments to defaults"
                >
                  <Text
                    style={[
                      styles.resetFurtherButtonText,
                      furtherAtDefaults && styles.resetFurtherButtonTextDisabled,
                    ]}
                  >
                    Reset
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.containerPractice]}>
      <FitScrollView
        style={styles.scrollPractice}
        contentContainerStyle={styles.scrollPracticeContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentContainer}>{settingsBody}</View>
        <View style={styles.backInScroll}>
          <AnimatedButton label="Back" onPress={() => onNavigate?.(previousScreen || 'main')} />
        </View>
      </FitScrollView>
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
    fontSize: 28,
    letterSpacing: 0.3,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  settingsContainer: {
    gap: 22,
  },
  optionText: {
    color: '#3a3a3a',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  optionTextWrap: {
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },
  optionSubtext: {
    fontSize: 12,
    color: '#8a6a3a',
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  furtherSection: {
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.28)',
  },
  furtherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  furtherCaret: {
    fontSize: 20,
    color: '#8a6a3a',
    fontWeight: '600',
    paddingHorizontal: 4,
    lineHeight: 24,
    width: 24,
    textAlign: 'center',
  },
  furtherCaretExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  furtherBody: {
    gap: 16,
    marginTop: 8,
  },
  helperText: {
    color: '#8b7355',
    fontSize: 13,
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
    // Bare "−" / "+" glyphs sit small in Spectral; nudge up to fill the circle.
    fontSize: 26,
    fontWeight: '600',
    color: '#3a3a3a',
    lineHeight: 27,
  },
  counterValue: {
    fontSize: 19,
    fontWeight: '600',
    color: '#3a3a3a',
    minWidth: 44,
    textAlign: 'center',
  },
  timerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  timerNumberBox: {
    width: 46,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  counterInput: {
    fontSize: 19,
    fontFamily: fontFamilyForRole('body', '600'),
    // Weight is baked into the face; avoid system synthetic bold.
    fontWeight: 'normal',
    color: '#3a3a3a',
    width: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlign: 'right',
  },
  counterUnit: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3a3a3a',
    letterSpacing: 0.1,
  },
  /** Same width as the reading-speed rail so Reset can right-edge to the last tick. */
  resetFurtherWrap: {
    width: '80%',
    alignSelf: 'center',
    marginTop: 4,
  },
  resetFurtherButton: {
    alignSelf: 'flex-end',
    marginRight: READING_SPEED_THUMB_INSET,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
  },
  resetFurtherButtonDisabled: {
    opacity: 0.45,
  },
  resetFurtherButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  resetFurtherButtonTextDisabled: {
    color: '#8a8a8a',
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
    fontSize: 17,
    letterSpacing: 0.25,
  },
  disabledText: {
    color: '#999',
  },
  guestHelperText: {
    color: '#8b7355',
    fontSize: 13,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.15,
  },
  difficultyHint: {
    fontSize: 13,
    color: '#8a6a3a',
    letterSpacing: 0.1,
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
  difficultyLabel: {
    fontSize: 15,
    color: '#3a3a3a',
    letterSpacing: 0.15,
  },
});

const readingSpeedSliderStyles = StyleSheet.create({
  wrap: {
    gap: 6,
    paddingTop: 2,
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#3a3a3a',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  currentValue: {
    color: '#3a3a3a',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 54,
    textAlign: 'right',
  },
  subtext: {
    fontSize: 12,
    color: '#8a6a3a',
    letterSpacing: 0.1,
    lineHeight: 16,
    marginBottom: 4,
  },
  rail: {
    width: '80%',
    alignSelf: 'center',
    overflow: 'visible',
  },
  trackHit: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: READING_SPEED_THUMB_INSET,
    overflow: 'visible',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(201, 169, 97, 0.22)',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: 'rgba(201, 169, 97, 0.7)',
  },
  tick: {
    position: 'absolute',
    top: -5,
    width: 2,
    height: 14,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: 'rgba(138, 106, 58, 0.45)',
  },
  thumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: '#c9a961',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  labelsRow: {
    position: 'relative',
    height: 15,
    marginTop: 4,
    overflow: 'visible',
  },
  tickLabel: {
    position: 'absolute',
    width: READING_SPEED_LABEL_HALF * 2,
    fontSize: 10,
    color: '#8a6a3a',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  tickLabelActive: {
    color: '#3a3a3a',
    fontWeight: '700',
  },
});