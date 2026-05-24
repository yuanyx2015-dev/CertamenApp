import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getCurrentUser } from '../services/authService';
import { bumpUserStreak } from '../services/userStatsService';
import {
  getUnmasteredQuestions,
  masterQuestion,
} from '../services/userMasteredService';
import { getAllWrongQuestions, markQuestionAsWrong } from '../services/questionReviewService';
import { recordPassedQuestion } from '../services/userPassedService';
import type { Question } from '../services/questionService';
import type {
  ChallengeDifficulty,
} from '../lib/challengeRanks';
import type { MainTabId } from './MainTabsScreen';
import { FeedbackOverlay, type FeedbackOverlayHandle } from './RomanFeedback';
import { ButtonDot } from './ButtonDot';

const HOLD_TO_MASTER_MS = 1000;

export type ChallengeGameMode = 'challenge' | 'review';

export interface ChallengeGameConfig {
  mode: ChallengeGameMode;
  setSize: number;
  /** Required for 'challenge' mode; ignored in 'review' mode (which spans all difficulties). */
  difficulty?: ChallengeDifficulty;
}

interface ShuffledOption {
  text: string;
  isCorrect: boolean;
}

interface QueueEntry {
  question: Question;
  options: ShuffledOption[];
}

function StarIcon({ filled, progress }: { filled: number; progress: Animated.Value }) {
  // `filled` is the static fill before any animation; `progress` (0..1) drives the live overlay.
  return (
    <View style={starStyles.wrap}>
      {/* Outline (always visible) */}
      <Svg width={48} height={48} viewBox="0 0 24 24">
        <Path
          d="M12 17.27l5.18 3.04-1.37-5.91 4.59-3.97-6.06-.52L12 4l-2.34 5.91-6.06.52 4.59 3.97-1.37 5.91L12 17.27z"
          fill={filled > 0 ? '#c9a961' : 'rgba(255,255,255,0.6)'}
          stroke="#9d856b"
          strokeWidth={1}
        />
      </Svg>
      {/* Animated fill overlay using opacity */}
      <Animated.View
        pointerEvents="none"
        style={[starStyles.overlay, { opacity: progress }]}
      >
        <Svg width={48} height={48} viewBox="0 0 24 24">
          <Path
            d="M12 17.27l5.18 3.04-1.37-5.91 4.59-3.97-6.06-.52L12 4l-2.34 5.91-6.06.52 4.59 3.97-1.37 5.91L12 17.27z"
            fill="#c9a961"
            stroke="#7d6543"
            strokeWidth={1}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const starStyles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function shuffleArray<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQueueEntry(q: Question): QueueEntry {
  const options: ShuffledOption[] = [
    { text: q.correct_answer, isCorrect: true },
    { text: q.wrong_answers[0], isCorrect: false },
    { text: q.wrong_answers[1], isCorrect: false },
    { text: q.wrong_answers[2], isCorrect: false },
  ];
  return { question: q, options: shuffleArray(options) };
}

export function ChallengeGameScreen({
  config,
  onNavigate,
  onTabChange,
  onStartGame,
}: {
  config: ChallengeGameConfig;
  onNavigate?: (screen: string) => void;
  onTabChange?: (tab: MainTabId) => void;
  /** Restart with a brand-new pool (used by "Another Set" button). */
  onStartGame?: (mode: ChallengeGameMode, setSize: number, difficulty?: ChallengeDifficulty) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /** Active question queue (head = current). Mutated locally for re-queue. */
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  /** Running counts for the end-of-set summary. */
  const [masteredCount, setMasteredCount] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  const [isFinished, setIsFinished] = useState(false);

  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** Bumped once per game session on the first answer (server-side same-day no-op). */
  const streakBumpedRef = useRef(false);
  const feedbackRef = useRef<FeedbackOverlayHandle>(null);

  // ----- LOAD POOL -----
  useEffect(() => {
    let cancelled = false;

    const loadPool = async () => {
      setIsLoading(true);
      setLoadError(null);
      setQueue([]);
      setIsFinished(false);
      setMasteredCount(0);
      setPassedCount(0);
      setWrongCount(0);

      const user = await getCurrentUser();
      if (!user) {
        if (!cancelled) {
          setLoadError('You need to be signed in.');
          setIsLoading(false);
        }
        return;
      }
      if (!cancelled) setUserId(user.id);

      let pool: Question[] = [];
      try {
        if (config.mode === 'challenge') {
          if (!config.difficulty) {
            if (!cancelled) {
              setLoadError('Missing difficulty for challenge.');
              setIsLoading(false);
            }
            return;
          }
          const { data, error } = await getUnmasteredQuestions(
            user.id,
            config.difficulty,
            config.setSize
          );
          if (error) throw error;
          pool = data ?? [];
        } else {
          const { data, error } = await getAllWrongQuestions(user.id, 1000);
          if (error) throw error;
          pool = shuffleArray(data ?? []).slice(0, config.setSize);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message ?? 'Failed to load questions.');
          setIsLoading(false);
        }
        return;
      }

      if (cancelled) return;

      if (pool.length === 0) {
        setLoadError(
          config.mode === 'challenge'
            ? 'No unmastered questions left at this difficulty. Try Review or pick another difficulty.'
            : 'No wrong questions to review. Take a Challenge set first!'
        );
        setIsLoading(false);
        return;
      }

      setQueue(pool.map(buildQueueEntry));
      setIsLoading(false);
    };

    void loadPool();
    return () => {
      cancelled = true;
    };
  }, [config.mode, config.setSize, config.difficulty]);

  // ----- HOLD TIMER CLEANUP -----
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const current = queue[0];
  const totalAnswered = masteredCount + passedCount + wrongCount;

  // ----- RESET PER QUESTION -----
  const advanceToNext = useCallback(
    (next: QueueEntry[]) => {
      setQueue(next);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsCorrect(false);
      holdAnim.setValue(0);
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (next.length === 0) {
        setIsFinished(true);
      }
    },
    [holdAnim]
  );

  // ----- ANSWER -----
  const handleAnswerSelect = useCallback(
    async (option: ShuffledOption) => {
      if (isAnswered || !current || !userId) return;
      setIsAnswered(true);
      setIsCorrect(option.isCorrect);
      setSelectedAnswer(option.text);
      feedbackRef.current?.show(option.isCorrect ? 'correct' : 'wrong');

      // Streak: bump once per session on the first answer. The DB function
      // is idempotent within the same calendar day, so repeated sessions
      // on the same day won't double-count.
      if (!streakBumpedRef.current) {
        streakBumpedRef.current = true;
        void bumpUserStreak(userId);
      }

      if (!option.isCorrect) {
        // Mark wrong, fire-and-forget; UI advances on Next tap.
        await markQuestionAsWrong(userId, current.question.id);
        setWrongCount((n) => n + 1);
      }
    },
    [current, isAnswered, userId]
  );

  // ----- ADVANCE AFTER WRONG -----
  const handleNextAfterWrong = useCallback(() => {
    if (!current) return;
    // Wrong → remove from queue entirely.
    advanceToNext(queue.slice(1));
  }, [advanceToNext, current, queue]);

  // ----- PASS (Continue after correct) -----
  const handlePass = useCallback(async () => {
    if (!current || !userId) return;
    await recordPassedQuestion(userId, current.question.id);
    setPassedCount((n) => n + 1);
    // In-session re-queue: move to back of queue so the user finishes
    // all other unmastered questions before seeing this one again.
    const [head, ...rest] = queue;
    advanceToNext([...rest, head]);
  }, [advanceToNext, current, queue, userId]);

  // ----- MASTER (hold star) -----
  const fireMaster = useCallback(async () => {
    if (!current || !userId) return;
    await masterQuestion(userId, current.question.id);
    setMasteredCount((n) => n + 1);
    advanceToNext(queue.slice(1));
  }, [advanceToNext, current, queue, userId]);

  const handleStarPressIn = useCallback(() => {
    if (!isCorrect) return;
    holdAnim.setValue(0);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_TO_MASTER_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    holdTimerRef.current = setTimeout(() => {
      void fireMaster();
    }, HOLD_TO_MASTER_MS);
  }, [fireMaster, holdAnim, isCorrect]);

  const handleStarPressOut = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    Animated.timing(holdAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [holdAnim]);

  // ----- DERIVED -----
  const totalForHeader = useMemo(() => {
    // Challenge mode: if user keeps passing, total may grow beyond setSize because
    // pass re-queues, so show the larger of the two. Review mode: total is always
    // the initial wrong-pool size we started with (locked at config.setSize).
    if (config.mode === 'review') return config.setSize;
    return Math.max(config.setSize, totalAnswered + queue.length);
  }, [config.mode, config.setSize, queue.length, totalAnswered]);

  const headerLabel = useMemo(() => {
    const current = Math.min(totalAnswered + 1, totalForHeader);
    if (config.mode === 'review') return `${current} / ${totalForHeader}`;
    return `Q ${current}/${totalForHeader}`;
  }, [config.mode, totalAnswered, totalForHeader]);

  // ----- RENDER STATES -----

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#c9a961" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <View style={styles.centerWrap}>
          <Text style={styles.errorTitle}>Heads up</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onNavigate?.('main')}
            activeOpacity={0.85}
          >
            <ButtonDot />
            <Text style={styles.secondaryBtnText}>Back to Main</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isFinished || !current) {
    const totalAttempted = masteredCount + passedCount + wrongCount;
    const correct = masteredCount + passedCount;
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.summaryScroll}>
          <Text style={styles.summaryTitle}>Set Complete</Text>
          <Text style={styles.summaryScore}>
            {correct} / {totalAttempted} correct
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Mastered</Text>
              <Text style={styles.summaryRowValue}>{masteredCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Correct (not mastered)</Text>
              <Text style={styles.summaryRowValue}>{passedCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Wrong</Text>
              <Text style={styles.summaryRowValue}>{wrongCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              onStartGame?.(config.mode, config.setSize, config.difficulty)
            }
            activeOpacity={0.85}
          >
            <ButtonDot color="#fff" />
            <Text style={styles.primaryBtnText}>Another Set</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              onTabChange?.('review');
              onNavigate?.('main');
            }}
            activeOpacity={0.85}
          >
            <ButtonDot />
            <Text style={styles.secondaryBtnText}>Review Questions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              onTabChange?.('profile');
              onNavigate?.('main');
            }}
            activeOpacity={0.85}
          >
            <ButtonDot />
            <Text style={styles.secondaryBtnText}>Return to Main</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ----- ACTIVE QUESTION -----
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{headerLabel}</Text>
        <Text style={styles.headerCount}>★ {masteredCount} mastered</Text>
      </View>

      <ScrollView
        style={styles.gameArea}
        contentContainerStyle={styles.gameAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>{current.question.question_text}</Text>
        </View>

        <View style={styles.optionsGrid}>
          {current.options.map((option, i) => {
            const selected = selectedAnswer === option.text;
            const showCorrect = isAnswered && option.isCorrect;
            const showWrong = isAnswered && selected && !option.isCorrect;

            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.optionCard,
                  showCorrect && styles.optionCorrect,
                  showWrong && styles.optionWrong,
                ]}
                onPress={() => handleAnswerSelect(option)}
                disabled={isAnswered}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.optionText,
                    showCorrect && styles.optionTextCorrect,
                    showWrong && styles.optionTextWrong,
                  ]}
                >
                  {option.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isAnswered && (
          <View style={styles.actionRow}>
            {isCorrect ? (
              <>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={handlePass}
                  activeOpacity={0.85}
                >
                  <ButtonDot color="#fff" />
                  <Text style={styles.continueBtnText}>Continue</Text>
                </TouchableOpacity>

                <View style={styles.starWrap}>
                  <TouchableOpacity
                    onPressIn={handleStarPressIn}
                    onPressOut={handleStarPressOut}
                    activeOpacity={1}
                    style={styles.starPress}
                  >
                    <StarIcon filled={0} progress={holdAnim} />
                  </TouchableOpacity>
                  <Text style={styles.starHint}>Hold to master</Text>
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={handleNextAfterWrong}
                activeOpacity={0.85}
              >
                <ButtonDot color="#fff" />
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => {
            onTabChange?.('profile');
            onNavigate?.('main');
          }}
          activeOpacity={0.7}
        >
          <ButtonDot color="#8a6a3a" />
          <Text style={styles.footerLink}>Done learning? Click me</Text>
        </TouchableOpacity>
      </View>

      <FeedbackOverlay ref={feedbackRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6a6a6a',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3a3a',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#6a6a6a',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(245, 239, 227, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 169, 97, 0.3)',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a3a3a',
  },
  headerCount: {
    fontSize: 13,
    color: '#6a6a6a',
    fontWeight: '500',
  },
  gameArea: {
    flex: 1,
  },
  gameAreaContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 18,
    paddingBottom: 24,
  },
  questionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3a3a3a',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  optionCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    borderRadius: 10,
    padding: 14,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    color: '#3a3a3a',
    textAlign: 'center',
    lineHeight: 19,
  },
  optionCorrect: {
    backgroundColor: 'rgba(72, 130, 88, 0.18)',
    borderColor: 'rgba(52, 120, 72, 0.75)',
    borderWidth: 2,
  },
  optionWrong: {
    backgroundColor: 'rgba(176, 72, 72, 0.16)',
    borderColor: 'rgba(160, 52, 52, 0.85)',
    borderWidth: 2,
  },
  optionTextCorrect: {
    color: '#2d5c3a',
    fontWeight: '600',
  },
  optionTextWrong: {
    color: '#7a2a2a',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  continueBtn: {
    backgroundColor: '#c9a961',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#9d856b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nextBtn: {
    backgroundColor: '#c9a961',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#9d856b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  starWrap: {
    alignItems: 'center',
    gap: 2,
  },
  starPress: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starHint: {
    fontSize: 10,
    color: '#6a6a6a',
    letterSpacing: 0.3,
  },
  footer: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.25)',
    backgroundColor: 'rgba(245, 239, 227, 0.85)',
  },
  footerLink: {
    fontSize: 12,
    color: '#8a6a3a',
    textDecorationLine: 'underline',
  },
  // Summary
  summaryScroll: {
    padding: 20,
    gap: 14,
    alignItems: 'stretch',
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3a3a3a',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  summaryScore: {
    fontSize: 17,
    color: '#3a3a3a',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryRowLabel: {
    fontSize: 13,
    color: '#3a3a3a',
  },
  summaryRowValue: {
    fontSize: 13,
    color: '#6a6a6a',
    fontWeight: '700',
  },
  primaryBtn: {
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
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
  },
  secondaryBtnText: {
    fontSize: 14,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
