import React, { useEffect } from 'react';
import {
  View,
  TextInput,
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
  type PracticeQuestionPool,
  normalizePracticeDifficulties,
  normalizePracticeQuestionPool,
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
import {
  categoriesShortOfSetSize,
  countPoolAtDifficulties,
  fetchPracticePoolQuestions,
  PRACTICE_POOL_CATEGORIES,
  type PracticePoolQuestion,
} from '../services/practicePoolService';
import { FitScrollView } from './FitScrollView';
import { useIPadScaledStyles } from '../lib/layout';

/** Half thumb width — insets the rail so end thumbs aren't clipped. */
const READING_SPEED_THUMB_INSET = 10;

/** Main Practice Settings defaults (set size / pool / difficulty). */
const PRACTICE_SESSION_DEFAULTS = {
  num_tossups: 5,
  practice_question_pool: 'all' as const,
  practice_session_difficulty: ['easy'] as PracticeSessionDifficulty[],
  wrong_questions_only: false,
};

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

/** Warning triangle for pool/difficulty combos a category can't fill. */
function WarningTriangleIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17">
      <Path
        d="M8.5 2.1 L15.6 14.6 H1.4 Z"
        stroke="#a8681f"
        strokeWidth={1.4}
        strokeLinejoin="round"
        fill="rgba(201, 169, 97, 0.25)"
      />
      <Path
        d="M8.5 6.2 V10.3"
        stroke="#a8681f"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path d="M8.5 12.3 V12.4" stroke="#a8681f" strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

/** Counter − / + — SVG like the difficulty check so glyphs stay centered in the circle. */
function CounterMinusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M4 9 H14"
        stroke="#3a3a3a"
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function CounterPlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M4 9 H14 M9 4 V14"
        stroke="#3a3a3a"
        strokeWidth={2.2}
        strokeLinecap="round"
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
  const [questionPool, setQuestionPool] = React.useState<PracticeQuestionPool>('all');
  const [numTossups, setNumTossups] = React.useState(20);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  // null = not loaded or the fetch failed, so counts are unknown rather than zero.
  const [wrongPool, setWrongPool] = React.useState<PracticePoolQuestion[] | null>(null);
  const [masteredPool, setMasteredPool] = React.useState<PracticePoolQuestion[] | null>(null);
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
        const pool = normalizePracticeQuestionPool(
          settings.practice_question_pool,
          settings.wrong_questions_only
        );
        setQuestionPool(pool);
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
      
      // Wrong / mastered pools drive the exact set-size max (only for signed-in users).
      if (!isGuestMode && user) {
        const [wrongRes, masteredRes] = await Promise.all([
          fetchPracticePoolQuestions(user.id, 'wrong'),
          fetchPracticePoolQuestions(user.id, 'mastered'),
        ]);
        setWrongPool(wrongRes.error ? null : (wrongRes.data ?? []));
        setMasteredPool(masteredRes.error ? null : (masteredRes.data ?? []));
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

  const poolQuestionsFor = (pool: PracticeQuestionPool): PracticePoolQuestion[] | null =>
    pool === 'wrong' ? wrongPool : pool === 'mastered' ? masteredPool : null;

  /** Questions this pool can actually serve at the checked difficulties. */
  const availableFor = (
    pool: PracticeQuestionPool,
    difficulties: PracticeSessionDifficulty[]
  ): number | null => {
    const questions = poolQuestionsFor(pool);
    if (!questions) return null;
    return countPoolAtDifficulties(questions, difficulties);
  };

  const setSizeBoundsFor = (
    pool: PracticeQuestionPool,
    difficulties: PracticeSessionDifficulty[]
  ) => {
    const available = availableFor(pool, difficulties);
    if (available === null) return { min: 5, max: 50 };
    const max = Math.min(available, 50);
    return { min: Math.min(5, max), max };
  };

  /** The pool matters here but its contents never arrived — don't report zero. */
  const poolLoadFailed =
    !isGuestMode && questionPool !== 'all' && poolQuestionsFor(questionPool) === null;

  const poolAvailable = availableFor(questionPool, practiceSessionDifficulties);
  const { max: setSizeMax } = setSizeBoundsFor(questionPool, practiceSessionDifficulties);
  const shortCategories = categoriesShortOfSetSize(
    poolQuestionsFor(questionPool),
    practiceSessionDifficulties,
    numTossups
  );

  const persistSetSize = async (value: number) => {
    setNumTossups(value);
    if (userId) {
      await updateSetting(userId, 'num_tossups', value);
    }
  };

  /**
   * Keep the size the user picked; only move it when the pool genuinely can't
   * serve it. A pool with nothing at these difficulties is left alone, since the
   * helper text and the load popup already explain that case.
   */
  const clampSetSize = async (
    pool: PracticeQuestionPool,
    difficulties: PracticeSessionDifficulty[]
  ) => {
    const { min, max } = setSizeBoundsFor(pool, difficulties);
    if (max <= 0) return;
    if (numTossups > max) await persistSetSize(max);
    else if (numTossups < min) await persistSetSize(min);
  };

  const applyPoolChange = async (pool: PracticeQuestionPool) => {
    setQuestionPool(pool);
    if (userId) {
      await updateUserSettings(userId, {
        practice_question_pool: pool,
        wrong_questions_only: pool === 'wrong',
      });
    }
    await clampSetSize(pool, practiceSessionDifficulties);
  };

  const handleQuestionPoolSelect = async (pool: PracticeQuestionPool) => {
    if (pool === questionPool) return;
    const requested = pool === 'wrong' ? wrongPool : pool === 'mastered' ? masteredPool : null;
    if (pool !== 'all' && requested === null) {
      Alert.alert(
        'Couldn’t load your questions',
        'Your ' +
          pool +
          ' questions didn’t load, so this pool isn’t available yet. Check your connection and reopen Settings.'
      );
      return;
    }
    if (pool === 'wrong' && requested?.length === 0) {
      Alert.alert(
        'No wrong questions yet',
        'You have no wrong questions to review right now. Take a Challenge set first.'
      );
      return;
    }
    if (pool === 'mastered' && requested?.length === 0) {
      Alert.alert(
        'No mastered questions yet',
        'Master questions in Challenge or Review first, then you can drill them here.'
      );
      return;
    }
    await applyPoolChange(pool);
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

    // Narrowing difficulty can strand a set size the pool can no longer fill.
    await clampSetSize(questionPool, next);
  };

  const handleNumTossupsChange = async (newValue: number) => {
    const { min, max } = setSizeBoundsFor(questionPool, practiceSessionDifficulties);
    if (max <= 0) return;
    await persistSetSize(Math.max(min, Math.min(max, newValue)));
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

  const handleResetPracticeSession = async () => {
    setNumTossups(PRACTICE_SESSION_DEFAULTS.num_tossups);
    setQuestionPool(PRACTICE_SESSION_DEFAULTS.practice_question_pool);
    setPracticeSessionDifficulties(PRACTICE_SESSION_DEFAULTS.practice_session_difficulty);
    if (userId) {
      await updateUserSettings(userId, { ...PRACTICE_SESSION_DEFAULTS });
    }
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

  const practiceSessionAtDefaults =
    numTossups === PRACTICE_SESSION_DEFAULTS.num_tossups &&
    questionPool === PRACTICE_SESSION_DEFAULTS.practice_question_pool &&
    practiceSessionDifficulties.length === 1 &&
    practiceSessionDifficulties[0] === 'easy';

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
              accessibilityLabel="Decrease number of questions"
            >
              <CounterMinusIcon />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{numTossups}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => handleNumTossupsChange(numTossups + 5)}
              activeOpacity={0.7}
              accessibilityLabel="Increase number of questions"
            >
              <CounterPlusIcon />
            </TouchableOpacity>
          </View>
        </View>
        {poolLoadFailed && (
          <TouchableOpacity
            style={styles.poolWarningRow}
            onPress={loadSettingsData}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <WarningTriangleIcon />
            <Text style={styles.poolWarningText}>
              Couldn’t load your {questionPool} questions, so the limit below may be off. Tap to
              retry.
            </Text>
          </TouchableOpacity>
        )}

        {!poolLoadFailed && poolAvailable !== null && (
          <Text style={styles.helperText}>
            {poolAvailable === 0
              ? `No ${questionPool} questions at these difficulties`
              : `Max: ${setSizeMax} of ${poolAvailable} ${questionPool} at these difficulties`}
          </Text>
        )}

        {shortCategories.length > 0 && (
          <View style={styles.poolWarningRow}>
            <WarningTriangleIcon />
            <Text style={styles.poolWarningText}>
              {shortCategories.length === PRACTICE_POOL_CATEGORIES.length
                ? `No category has ${numTossups} ${questionPool} questions at these difficulties. Change the settings to practice a category.`
                : `${shortCategories.length} of ${PRACTICE_POOL_CATEGORIES.length} categories have fewer than ${numTossups} ${questionPool} questions at these difficulties. Change the settings to practice those categories.`}
            </Text>
          </View>
        )}

        <View style={styles.poolSection}>
          <Text style={[styles.sectionTitle, isGuestMode && styles.disabledText]}>
            Question pool
          </Text>
          <Text style={styles.difficultyHint}>Choose one</Text>
          <View style={styles.poolRow}>
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'wrong' as const, label: 'Wrong' },
                { id: 'mastered' as const, label: 'Mastered' },
              ] as const
            ).map(({ id, label }) => {
              const selected = questionPool === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.poolChip, selected && styles.poolChipSelected]}
                  onPress={() => handleQuestionPoolSelect(id)}
                  activeOpacity={0.75}
                  disabled={isGuestMode}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: isGuestMode }}
                >
                  <Text
                    style={[
                      styles.poolChipLabel,
                      selected && styles.poolChipLabelSelected,
                      isGuestMode && styles.disabledText,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isGuestMode && (
            <Text style={styles.guestHelperText}>
              Sign in to practice from Wrong or Mastered lists
            </Text>
          )}
        </View>

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
            <View style={styles.resetPracticeWrap}>
              <TouchableOpacity
                style={[
                  styles.resetPracticeButton,
                  practiceSessionAtDefaults && styles.resetFurtherButtonDisabled,
                ]}
                onPress={handleResetPracticeSession}
                activeOpacity={0.7}
                disabled={practiceSessionAtDefaults}
                accessibilityRole="button"
                accessibilityLabel="Reset practice settings to default"
              >
                <Text
                  style={[
                    styles.resetFurtherButtonText,
                    practiceSessionAtDefaults && styles.resetFurtherButtonTextDisabled,
                  ]}
                >
                  Reset to default
                </Text>
              </TouchableOpacity>
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
  poolWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: -4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 104, 31, 0.35)',
    backgroundColor: 'rgba(201, 169, 97, 0.14)',
  },
  poolWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#7a5320',
    letterSpacing: 0.1,
  },
  poolSection: {
    gap: 8,
    marginTop: 4,
  },
  poolRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  poolChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(120, 120, 120, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  poolChipSelected: {
    borderColor: '#b8954a',
    backgroundColor: 'rgba(201, 169, 97, 0.35)',
  },
  poolChipLabel: {
    fontSize: 15,
    color: '#3a3a3a',
    letterSpacing: 0.15,
    fontWeight: '500',
  },
  poolChipLabelSelected: {
    fontWeight: '600',
    color: '#5a4a28',
  },
  resetPracticeWrap: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  resetPracticeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
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