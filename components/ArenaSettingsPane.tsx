import React from 'react';
import {
  PanResponder,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../lib/AppText';
import {
  playCancelSound,
  playCategorySound,
  playCountPitch,
  playDailySound,
  playDifficultySound,
  playTickSound,
} from '../lib/buttonSound';
import { fontFamilyForRole } from '../lib/fonts';
import {
  ANSWER_SECONDS_MAX,
  ANSWER_SECONDS_MIN,
  DEFAULT_READING_SPEED_MULTIPLIER,
  formatReadingSpeedLabel,
  FURTHER_ADJUSTMENT_DEFAULTS,
  clampAnswerSeconds,
  clampPreBuzzSeconds,
  clampReadingSpeedMultiplier,
  parseTimerSecondsInput,
  PRE_BUZZ_SECONDS_MAX,
  PRE_BUZZ_SECONDS_MIN,
  READING_SPEED_STOPS,
} from '../services/userSettingsService';
import {
  ARENA_CATEGORIES,
  ARENA_DEFAULT_SETTINGS,
  ARENA_DIFFICULTIES,
  type ArenaSettings,
} from '../services/arenaService';

const READING_SPEED_THUMB_INSET = 10;
const READING_SPEED_LABEL_HALF = 24;

function DifficultyCheckMark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M3.2 8.2 L6.4 11.3 L12.8 4.5"
        stroke="#3a3a3a"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function CounterMinusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M4 9 H14" stroke="#3a3a3a" strokeWidth={2.2} strokeLinecap="round" fill="none" />
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

function CornerTicks() {
  return (
    <View pointerEvents="none" style={styles.ticks}>
      <View style={[styles.corner, styles.cornerTL]}>
        <View style={[styles.tickH, styles.tickTop, styles.tickLeft]} />
        <View style={[styles.tickV, styles.tickTop, styles.tickLeft]} />
      </View>
      <View style={[styles.corner, styles.cornerTR]}>
        <View style={[styles.tickH, styles.tickTop, styles.tickRight]} />
        <View style={[styles.tickV, styles.tickTop, styles.tickRight]} />
      </View>
      <View style={[styles.corner, styles.cornerBL]}>
        <View style={[styles.tickH, styles.tickBottom, styles.tickLeft]} />
        <View style={[styles.tickV, styles.tickBottom, styles.tickLeft]} />
      </View>
      <View style={[styles.corner, styles.cornerBR]}>
        <View style={[styles.tickH, styles.tickBottom, styles.tickRight]} />
        <View style={[styles.tickV, styles.tickBottom, styles.tickRight]} />
      </View>
    </View>
  );
}

function ReadingSpeedSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackPageXRef = React.useRef(0);
  const trackRef = React.useRef<View>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const stops = READING_SPEED_STOPS;
  const clamped = clampReadingSpeedMultiplier(value);
  const stopIndex = Math.max(0, stops.findIndex((s) => s === clamped));

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
  const tickLeft = (i: number) => (stops.length > 1 ? (i / (stops.length - 1)) * trackWidth : 0);

  return (
    <View style={sliderStyles.wrap}>
      <View style={sliderStyles.headerRow}>
        <Text style={sliderStyles.title}>Reading speed</Text>
        <Text style={sliderStyles.currentValue}>{formatReadingSpeedLabel(clamped)}</Text>
      </View>
      <Text style={sliderStyles.subtext}>How fast the toss-up types out</Text>
      <View style={sliderStyles.rail}>
        <View style={sliderStyles.trackHit} {...panResponder.panHandlers}>
          <View ref={trackRef} style={sliderStyles.track} onLayout={onTrackLayout}>
            <View
              style={[
                sliderStyles.trackFill,
                { width: trackWidth > 0 ? thumbRatio * trackWidth : 0 },
              ]}
            />
            {trackWidth > 0 &&
              stops.map((stop, i) => (
                <View key={stop} pointerEvents="none" style={[sliderStyles.tick, { left: tickLeft(i) }]} />
              ))}
            {trackWidth > 0 && (
              <View
                pointerEvents="none"
                style={[sliderStyles.thumb, { left: thumbRatio * trackWidth }]}
              />
            )}
          </View>
        </View>
        <View style={sliderStyles.labelsRow}>
          {trackWidth > 0 &&
            stops.map((stop, i) => (
              <Text
                key={stop}
                style={[
                  sliderStyles.tickLabel,
                  { left: tickLeft(i) - READING_SPEED_LABEL_HALF },
                ]}
              >
                {formatReadingSpeedLabel(stop)}
              </Text>
            ))}
        </View>
      </View>
    </View>
  );
}

export function ArenaSettingsPane({
  settings,
  available,
  onChange,
  onBack,
}: {
  settings: ArenaSettings;
  available: number | null;
  onChange: (next: ArenaSettings) => void;
  onBack: () => void;
}) {
  const [furtherOpen, setFurtherOpen] = React.useState(false);
  const [preBuzzText, setPreBuzzText] = React.useState(String(settings.pre_buzz_seconds));
  const [answerText, setAnswerText] = React.useState(String(settings.answer_seconds));

  const maxCount = Math.max(5, Math.min(50, available ?? 50));

  const setCount = (next: number) => {
    const question_count = Math.max(5, Math.min(maxCount, next));
    playCountPitch(question_count);
    onChange({ ...settings, question_count });
  };

  const toggleDifficulty = (id: string) => {
    const has = settings.difficulties.includes(id);
    if (has && settings.difficulties.length <= 1) {
      playCancelSound();
      return;
    }
    playDifficultySound(id);
    const next = has
      ? settings.difficulties.filter((d) => d !== id)
      : ARENA_DIFFICULTIES.filter((d) => settings.difficulties.includes(d) || d === id);
    onChange({ ...settings, difficulties: [...next] });
  };

  const toggleCategory = (key: string) => {
    const has = settings.categories.includes(key);
    if (has && settings.categories.length <= 1) {
      playCancelSound();
      return;
    }
    playCategorySound(ARENA_CATEGORIES.findIndex((c) => c.key === key));
    const next = has
      ? settings.categories.filter((c) => c !== key)
      : ARENA_CATEGORIES.map((c) => c.key).filter((c) => settings.categories.includes(c) || c === key);
    onChange({ ...settings, categories: [...next] });
  };

  const sessionAtDefaults =
    settings.question_count === ARENA_DEFAULT_SETTINGS.question_count &&
    settings.difficulties.length === ARENA_DIFFICULTIES.length &&
    settings.categories.length === ARENA_CATEGORIES.length;

  const furtherAtDefaults =
    settings.pre_buzz_seconds === FURTHER_ADJUSTMENT_DEFAULTS.pre_buzz_seconds &&
    settings.answer_seconds === FURTHER_ADJUSTMENT_DEFAULTS.answer_seconds &&
    settings.reading_speed === FURTHER_ADJUSTMENT_DEFAULTS.reading_speed_multiplier;

  const commitPreBuzz = () => {
    const parsed = parseTimerSecondsInput(preBuzzText, PRE_BUZZ_SECONDS_MIN, PRE_BUZZ_SECONDS_MAX);
    if (parsed === null) {
      setPreBuzzText(String(settings.pre_buzz_seconds));
      return;
    }
    const next = clampPreBuzzSeconds(parsed);
    setPreBuzzText(String(next));
    onChange({ ...settings, pre_buzz_seconds: next });
  };

  const commitAnswer = () => {
    const parsed = parseTimerSecondsInput(answerText, ANSWER_SECONDS_MIN, ANSWER_SECONDS_MAX);
    if (parsed === null) {
      setAnswerText(String(settings.answer_seconds));
      return;
    }
    const next = clampAnswerSeconds(parsed);
    setAnswerText(String(next));
    onChange({ ...settings, answer_seconds: next });
  };

  return (
    <View style={styles.content}>
      <Text style={styles.titleText}>Settings</Text>
      <View style={styles.settingsContainer}>
        <View style={styles.counterRow}>
          <Text style={styles.optionText}># of questions</Text>
          <View style={styles.counterControls}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setCount(settings.question_count - 5)}
              activeOpacity={0.7}
              accessibilityLabel="Decrease number of questions"
            >
              <CounterMinusIcon />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{settings.question_count}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setCount(settings.question_count + 5)}
              activeOpacity={0.7}
              accessibilityLabel="Increase number of questions"
            >
              <CounterPlusIcon />
            </TouchableOpacity>
          </View>
        </View>
        {available !== null && (
          <Text style={styles.helperText}>
            {available === 0
              ? 'No questions at these difficulties and categories'
              : `Max: ${maxCount} of ${available} at these difficulties and categories`}
          </Text>
        )}

        <View style={styles.difficultySection}>
          <Text style={styles.sectionTitle}>Difficulty</Text>
          <Text style={styles.difficultyHint}>Select one or more</Text>
          <View style={styles.difficultyRow}>
            {ARENA_DIFFICULTIES.map((id) => {
              const checked = settings.difficulties.includes(id);
              const label = id[0].toUpperCase() + id.slice(1);
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.difficultyTap}
                  onPress={() => toggleDifficulty(id)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <View style={[styles.difficultyCheckbox, checked && styles.difficultyCheckboxSelected]}>
                    {checked && <DifficultyCheckMark />}
                  </View>
                  <Text style={styles.difficultyLabel}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.resetWrap}>
            <TouchableOpacity
              style={[styles.resetButton, sessionAtDefaults && styles.resetDisabled]}
              onPress={() => {
                playCancelSound();
                onChange({
                  ...settings,
                  question_count: ARENA_DEFAULT_SETTINGS.question_count,
                  difficulties: [...ARENA_DEFAULT_SETTINGS.difficulties],
                  categories: [...ARENA_DEFAULT_SETTINGS.categories],
                });
              }}
              disabled={sessionAtDefaults}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetText, sessionAtDefaults && styles.resetTextDisabled]}>
                Reset to default
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity
              onPress={() => {
                playDailySound();
                onChange({
                  ...settings,
                  categories: ARENA_CATEGORIES.map((c) => c.key),
                });
              }}
              disabled={settings.categories.length === ARENA_CATEGORIES.length}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectAll,
                  settings.categories.length === ARENA_CATEGORIES.length && styles.resetTextDisabled,
                ]}
              >
                Select all
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {ARENA_CATEGORIES.map((c) => {
              const selected = settings.categories.includes(c.key);
              return (
                <TouchableOpacity
                  key={c.key}
                  style={styles.gridItem}
                  onPress={() => toggleCategory(c.key)}
                  activeOpacity={1}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.categoryBox, selected && styles.categoryBoxOn]}>
                    <CornerTicks />
                    <Text style={styles.categoryLabel}>{c.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.furtherSection}>
          <TouchableOpacity
            style={styles.furtherHeader}
            onPress={() => {
              playTickSound();
              setFurtherOpen((open) => !open);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: furtherOpen }}
          >
            <Text style={styles.sectionTitle}>Further adjustments</Text>
            <Text style={[styles.furtherCaret, furtherOpen && styles.furtherCaretExpanded]}>⌃</Text>
          </TouchableOpacity>
          <Text style={styles.difficultyHint}>
            (Not recommended for casual Latin/Certamen students)
          </Text>
          {furtherOpen && (
            <View style={styles.furtherBody}>
              <View style={styles.counterRow}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionText}>Buzz timer</Text>
                  <Text style={styles.optionSubtext}>Seconds to buzz after the question finishes</Text>
                </View>
                <View style={styles.timerValueRow}>
                  <View style={styles.timerNumberBox}>
                    <TextInput
                      style={styles.counterInput}
                      value={preBuzzText}
                      onChangeText={setPreBuzzText}
                      onBlur={commitPreBuzz}
                      onSubmitEditing={commitPreBuzz}
                      keyboardType="default"
                      returnKeyType="done"
                      selectTextOnFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </View>
                  <Text style={styles.counterUnit}>seconds</Text>
                </View>
              </View>
              <View style={styles.counterRow}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionText}>Answer timer</Text>
                  <Text style={styles.optionSubtext}>Seconds to answer after you buzz</Text>
                </View>
                <View style={styles.timerValueRow}>
                  <View style={styles.timerNumberBox}>
                    <TextInput
                      style={styles.counterInput}
                      value={answerText}
                      onChangeText={setAnswerText}
                      onBlur={commitAnswer}
                      onSubmitEditing={commitAnswer}
                      keyboardType="default"
                      returnKeyType="done"
                      selectTextOnFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </View>
                  <Text style={styles.counterUnit}>seconds</Text>
                </View>
              </View>
              <ReadingSpeedSlider
                value={settings.reading_speed}
                onChange={(reading_speed) => onChange({ ...settings, reading_speed })}
              />
              <View style={styles.resetFurtherWrap}>
                <TouchableOpacity
                  style={[styles.resetFurtherButton, furtherAtDefaults && styles.resetDisabled]}
                  onPress={() => {
                    playCancelSound();
                    setPreBuzzText(String(FURTHER_ADJUSTMENT_DEFAULTS.pre_buzz_seconds));
                    setAnswerText(String(FURTHER_ADJUSTMENT_DEFAULTS.answer_seconds));
                    onChange({
                      ...settings,
                      pre_buzz_seconds: FURTHER_ADJUSTMENT_DEFAULTS.pre_buzz_seconds,
                      answer_seconds: FURTHER_ADJUSTMENT_DEFAULTS.answer_seconds,
                      reading_speed: FURTHER_ADJUSTMENT_DEFAULTS.reading_speed_multiplier,
                    });
                  }}
                  disabled={furtherAtDefaults}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.resetText, furtherAtDefaults && styles.resetTextDisabled]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          playCancelSound();
          onBack();
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', gap: 28 },
  titleText: {
    color: '#3a3a3a',
    fontSize: 28,
    letterSpacing: 0.3,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  settingsContainer: { gap: 22 },
  optionText: { color: '#3a3a3a', fontSize: 17, letterSpacing: 0.2 },
  optionTextWrap: { flex: 1, paddingRight: 12, gap: 2 },
  optionSubtext: { fontSize: 12, color: '#8a6a3a', letterSpacing: 0.1, lineHeight: 16 },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fbf8f4',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 19,
    fontWeight: '600',
    color: '#3a3a3a',
    minWidth: 44,
    textAlign: 'center',
  },
  helperText: { color: '#8b7355', fontSize: 13, marginTop: -8, fontStyle: 'italic' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#3a3a3a', letterSpacing: 0.15 },
  difficultyHint: { fontSize: 13, color: '#8a6a3a', letterSpacing: 0.1 },
  difficultySection: { gap: 12, marginTop: 4 },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  difficultyTap: { alignItems: 'center', gap: 8, minWidth: 76 },
  difficultyCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(120, 120, 120, 0.45)',
    backgroundColor: '#fbf8f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyCheckboxSelected: {
    borderColor: '#c9a961',
    backgroundColor: 'rgba(201, 169, 97, 0.25)',
  },
  difficultyLabel: { fontSize: 15, color: '#3a3a3a', letterSpacing: 0.15 },
  resetWrap: { alignItems: 'flex-end', marginTop: -4 },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#faf6ef',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
  },
  resetDisabled: { opacity: 0.45 },
  resetText: { color: '#3a3a3a', fontSize: 16, letterSpacing: 0.2, fontWeight: '600' },
  resetTextDisabled: { color: '#8a8a8a' },
  categorySection: { gap: 12 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectAll: { color: '#3a3a3a', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  gridItem: { width: '47%' },
  categoryBox: {
    width: '100%',
    aspectRatio: 1.35,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fbf8f4',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryBoxOn: {
    backgroundColor: '#f0e6d3',
    borderColor: 'rgba(201, 169, 97, 0.9)',
    transform: [{ scale: 0.98 }],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  categoryLabel: {
    fontSize: 17,
    color: '#3a3a3a',
    letterSpacing: 0.2,
    fontWeight: '500',
    textAlign: 'center',
  },
  ticks: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: 12, height: 12 },
  cornerTL: { top: 8, left: 8 },
  cornerTR: { top: 8, right: 8 },
  cornerBL: { bottom: 8, left: 8 },
  cornerBR: { bottom: 8, right: 8 },
  tickH: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: 'rgba(201, 169, 97, 0.7)',
  },
  tickV: {
    position: 'absolute',
    width: 1.5,
    height: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.7)',
  },
  tickTop: { top: 0 },
  tickBottom: { bottom: 0 },
  tickLeft: { left: 0 },
  tickRight: { right: 0 },
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
  furtherCaretExpanded: { transform: [{ rotate: '180deg' }] },
  furtherBody: { gap: 16, marginTop: 8 },
  timerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  timerNumberBox: {
    width: 46,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fbf8f4',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  counterInput: {
    fontSize: 19,
    fontFamily: fontFamilyForRole('body', '600'),
    fontWeight: 'normal',
    color: '#3a3a3a',
    width: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlign: 'right',
  },
  counterUnit: { fontSize: 15, fontWeight: '500', color: '#3a3a3a', letterSpacing: 0.1 },
  resetFurtherWrap: { width: '80%', alignSelf: 'center', marginTop: 4 },
  resetFurtherButton: {
    alignSelf: 'flex-end',
    marginRight: READING_SPEED_THUMB_INSET,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#faf6ef',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
  },
  backButton: {
    alignSelf: 'center',
    backgroundColor: '#fbf8f4',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 12,
    marginTop: 8,
  },
  backButtonText: { color: '#3a3a3a', fontSize: 17, letterSpacing: 0.25 },
});

const sliderStyles = StyleSheet.create({
  wrap: { gap: 6, paddingTop: 2, overflow: 'visible' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#3a3a3a', fontSize: 17, letterSpacing: 0.2 },
  currentValue: {
    color: '#3a3a3a',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 54,
    textAlign: 'right',
  },
  subtext: { fontSize: 12, color: '#8a6a3a', letterSpacing: 0.1, lineHeight: 16, marginBottom: 4 },
  rail: { width: '80%', alignSelf: 'center', overflow: 'visible' },
  trackHit: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: READING_SPEED_THUMB_INSET,
    overflow: 'visible',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ecd9be',
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
  },
  labelsRow: { position: 'relative', height: 15, marginTop: 4, overflow: 'visible' },
  tickLabel: {
    position: 'absolute',
    width: READING_SPEED_LABEL_HALF * 2,
    fontSize: 10,
    color: '#8a6a3a',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});
