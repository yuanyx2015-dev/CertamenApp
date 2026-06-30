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
  Modal,
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import { bumpUserStreak } from '../services/userStatsService';
import {
  getRankPoolQuestions,
  getMasteredCount,
  masterQuestion,
} from '../services/userMasteredService';
import {
  shouldShowReviewPrompt,
  markReviewPromptShown,
  confirmReview,
} from '../lib/appReview';
import { getAllWrongQuestions, markQuestionAsWrong } from '../services/questionReviewService';
import { recordPassedQuestion } from '../services/userPassedService';
import type { Question } from '../services/questionService';
import type { MainTabId } from './MainTabsScreen';
import { FeedbackOverlay, type FeedbackOverlayHandle } from './RomanFeedback';
import { StarIcon } from './StarIcon';
const HOLD_TO_MASTER_MS = 500;
/** After the tossup finishes typing, the player must buzz within this many seconds or the tossup is scored incorrect. */
const PRE_BUZZ_SECONDS = 10;
/** After buzzing, the player has this many seconds to pick an answer. */
const ANSWER_SECONDS = 5;
/** Milliseconds per character for the typewriter stream. */
const STREAM_INTERVAL_MS = 50;

export type ChallengeGameMode = 'challenge' | 'review';

export interface ChallengeGameConfig {
  mode: ChallengeGameMode;
  setSize: number;
  /** Required for 'challenge' mode; ignored in 'review' mode. */
  rankIndex?: number;
}

interface ShuffledOption {
  text: string;
  isCorrect: boolean;
}

interface QueueEntry {
  question: Question;
  options: ShuffledOption[];
}

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
  onStartGame?: (mode: ChallengeGameMode, setSize: number, rankIndex?: number) => void;
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
  /** Questions left behind (advanced past). Drives the "Q x/y" header so the
   *  counter only moves when the user taps Next/Continue/masters, not the
   *  instant an answer is scored. */
  const [advancedCount, setAdvancedCount] = useState(0);

  /** Number of questions this set actually started with (<= setSize if the pool is small). */
  const [initialPoolSize, setInitialPoolSize] = useState(0);

  const [isFinished, setIsFinished] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // ----- TYPEWRITER + BUZZ + TIMER (mirrors Practice mode) -----
  const [displayedText, setDisplayedText] = useState('');
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(ANSWER_SECONDS);
  /** Countdown after the full question is shown; null = not running (still streaming or already buzzed/resolved). */
  const [preBuzzSecondsRemaining, setPreBuzzSecondsRemaining] = useState<number | null>(null);
  /** Bumped on each load/advance to (re)start the typewriter stream for the new head question. */
  const [roundId, setRoundId] = useState(0);

  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** Bumped once per game session on the first answer (server-side same-day no-op). */
  const streakBumpedRef = useRef(false);
  const feedbackRef = useRef<FeedbackOverlayHandle>(null);

  const charIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const answerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const answerRemainingRef = useRef<number>(ANSWER_SECONDS);
  const preBuzzIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preBuzzRemainingRef = useRef<number | null>(null);
  const fullTextRef = useRef('');
  const isBuzzedRef = useRef(false);
  const isAnsweredRef = useRef(false);
  const currentQuestionRef = useRef<Question | null>(null);
  const userIdRef = useRef<string | null>(null);

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
      setAdvancedCount(0);
      setInitialPoolSize(0);

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
          if (config.rankIndex === undefined) {
            if (!cancelled) {
              setLoadError('Missing rank for challenge.');
              setIsLoading(false);
            }
            return;
          }
          const { data, error } = await getRankPoolQuestions(
            user.id,
            config.rankIndex,
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
            ? 'No unmastered questions left in this rank. Try Review or advance to the next rank.'
            : 'No wrong questions to review. Take a Challenge set first!'
        );
        setIsLoading(false);
        return;
      }

      setQueue(pool.map(buildQueueEntry));
      setInitialPoolSize(pool.length);
      setIsLoading(false);
      setRoundId((r) => r + 1);
    };

    void loadPool();
    return () => {
      cancelled = true;
    };
  }, [config.mode, config.setSize, config.rankIndex]);

  // ----- HOLD TIMER CLEANUP -----
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // ----- KEEP REFS IN SYNC FOR TIMER CALLBACKS -----
  useEffect(() => {
    isBuzzedRef.current = isBuzzed;
  }, [isBuzzed]);
  useEffect(() => {
    isAnsweredRef.current = isAnswered;
  }, [isAnswered]);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const current = queue[0];

  useEffect(() => {
    currentQuestionRef.current = current?.question ?? null;
  }, [current]);

  // ----- TIMER HELPERS -----
  const clearStreamTimer = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  };
  const clearAnswerTimer = () => {
    if (answerTimerRef.current) {
      clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
  };
  const clearPreBuzzTimer = () => {
    if (preBuzzIntervalRef.current) {
      clearInterval(preBuzzIntervalRef.current);
      preBuzzIntervalRef.current = null;
    }
  };

  // ----- RESET PER QUESTION -----
  const advanceToNext = useCallback(
    (next: QueueEntry[]) => {
      clearStreamTimer();
      clearAnswerTimer();
      clearPreBuzzTimer();
      setQueue(next);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsCorrect(false);
      holdAnim.setValue(0);
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setAdvancedCount((n) => n + 1);
      if (next.length === 0) {
        setIsFinished(true);
      }
      setRoundId((r) => r + 1);
    },
    [holdAnim]
  );

  // ----- NO BUZZ IN TIME (pre-buzz countdown expired) → scored incorrect -----
  const handleNoBuzzInTime = async () => {
    if (isBuzzedRef.current || isAnsweredRef.current) return;
    const q = currentQuestionRef.current;
    const uid = userIdRef.current;
    if (!q || !uid) return;
    isAnsweredRef.current = true;

    clearPreBuzzTimer();
    setPreBuzzSecondsRemaining(null);
    setIsAnswered(true);
    setIsCorrect(false);
    setSelectedAnswer(null);
    setDisplayedText(fullTextRef.current);
    setStatusText("Time's up! You didn't buzz in time.");
    feedbackRef.current?.show('wrong');

    if (!streakBumpedRef.current) {
      streakBumpedRef.current = true;
      void bumpUserStreak(uid);
    }
    await markQuestionAsWrong(uid, q.id);
    setWrongCount((n) => n + 1);
  };

  // ----- POST-BUZZ ANSWER WINDOW EXPIRED → scored incorrect -----
  const handleAnswerTimeUp = async () => {
    if (isAnsweredRef.current) return;
    const q = currentQuestionRef.current;
    const uid = userIdRef.current;
    if (!q || !uid) return;
    isAnsweredRef.current = true;

    clearAnswerTimer();
    setIsAnswered(true);
    setIsCorrect(false);
    setSelectedAnswer(null);
    setDisplayedText(fullTextRef.current);
    setStatusText("Time's up! No answer selected.");
    feedbackRef.current?.show('wrong');

    if (!streakBumpedRef.current) {
      streakBumpedRef.current = true;
      void bumpUserStreak(uid);
    }
    await markQuestionAsWrong(uid, q.id);
    setWrongCount((n) => n + 1);
  };

  const startPreBuzzCountdown = () => {
    clearPreBuzzTimer();
    preBuzzRemainingRef.current = PRE_BUZZ_SECONDS;
    setPreBuzzSecondsRemaining(PRE_BUZZ_SECONDS);
    // Decrement and fire the timeout handler from the timer callback (not from
    // inside a setState updater), so FeedbackOverlay's state isn't updated
    // during this component's render.
    preBuzzIntervalRef.current = setInterval(() => {
      const next = (preBuzzRemainingRef.current ?? 0) - 1;
      if (next <= 0) {
        preBuzzRemainingRef.current = null;
        clearPreBuzzTimer();
        setPreBuzzSecondsRemaining(null);
        void handleNoBuzzInTime();
      } else {
        preBuzzRemainingRef.current = next;
        setPreBuzzSecondsRemaining(next);
      }
    }, 1000);
  };

  // ----- BUZZ -----
  const handleBuzz = () => {
    if (isBuzzedRef.current || isAnsweredRef.current) return;
    isBuzzedRef.current = true;

    clearStreamTimer();
    clearPreBuzzTimer();
    setPreBuzzSecondsRemaining(null);
    setIsBuzzed(true);
    setStatusText('Buzzed! Select your answer...');
    answerRemainingRef.current = ANSWER_SECONDS;
    setTimeRemaining(ANSWER_SECONDS);

    // Decrement and fire the timeout handler from the timer callback (not from
    // inside a setState updater), so FeedbackOverlay's state isn't updated
    // during this component's render.
    answerTimerRef.current = setInterval(() => {
      const next = answerRemainingRef.current - 1;
      if (next <= 0) {
        answerRemainingRef.current = 0;
        clearAnswerTimer();
        setTimeRemaining(0);
        void handleAnswerTimeUp();
      } else {
        answerRemainingRef.current = next;
        setTimeRemaining(next);
      }
    }, 1000);
  };

  // ----- TYPEWRITER STREAM -----
  const startStreaming = (text: string) => {
    clearStreamTimer();
    clearAnswerTimer();
    clearPreBuzzTimer();
    isBuzzedRef.current = false;
    isAnsweredRef.current = false;
    setIsBuzzed(false);
    setDisplayedText('');
    setPreBuzzSecondsRemaining(null);
    setTimeRemaining(ANSWER_SECONDS);
    setStatusText('Reading question...');
    charIndexRef.current = 0;
    fullTextRef.current = text;

    streamIntervalRef.current = setInterval(() => {
      if (charIndexRef.current < fullTextRef.current.length) {
        setDisplayedText(fullTextRef.current.substring(0, charIndexRef.current + 1));
        charIndexRef.current++;
      } else {
        clearStreamTimer();
        setStatusText('Waiting for buzz...');
        startPreBuzzCountdown();
      }
    }, STREAM_INTERVAL_MS);
  };

  // (Re)start the stream whenever a new head question is presented.
  useEffect(() => {
    if (isLoading || loadError || isFinished) return;
    const head = queue[0];
    if (!head) return;
    startStreaming(head.question.question_text);
    return () => {
      clearStreamTimer();
      clearAnswerTimer();
      clearPreBuzzTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, isLoading, loadError, isFinished]);

  // ----- ANSWER -----
  const handleAnswerSelect = useCallback(
    async (option: ShuffledOption) => {
      if (isAnswered || !current || !userId) return;
      isAnsweredRef.current = true;
      if (answerTimerRef.current) {
        clearInterval(answerTimerRef.current);
        answerTimerRef.current = null;
      }
      setIsAnswered(true);
      setIsCorrect(option.isCorrect);
      setSelectedAnswer(option.text);
      setDisplayedText(fullTextRef.current);
      setStatusText(option.isCorrect ? 'Correct!' : 'Wrong! Better luck next time.');
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
    // Correct-but-not-mastered still consumes the question for this set.
    // It stays unmastered server-side, so it can resurface in a future set,
    // but it will NOT repeat within the current set.
    advanceToNext(queue.slice(1));
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

  // At end of a scored Challenge / Review set, maybe show the custom rate popup.
  useEffect(() => {
    if (!isFinished || !userId) return;
    let cancelled = false;
    (async () => {
      const { data: totalMastered } = await getMasteredCount(userId);
      const count = totalMastered ?? 0;
      const show = await shouldShowReviewPrompt(count);
      if (show && !cancelled) {
        await markReviewPromptShown(count);
        setShowReviewModal(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFinished, userId]);

  const handleRateApp = async () => {
    setShowReviewModal(false);
    await confirmReview();
  };

  const handleReviewNotNow = () => {
    setShowReviewModal(false);
  };

  // ----- DERIVED -----
  const totalForHeader = useMemo(() => {
    // Every answer (right or wrong) consumes exactly one question, so the set
    // is a fixed number of questions: the size of the pool we started with.
    // Falls back to setSize before the pool has loaded.
    return initialPoolSize || config.setSize;
  }, [config.setSize, initialPoolSize]);

  const headerLabel = useMemo(() => {
    const current = Math.min(advancedCount + 1, totalForHeader);
    if (config.mode === 'review') return `${current} / ${totalForHeader}`;
    return `Q ${current}/${totalForHeader}`;
  }, [config.mode, advancedCount, totalForHeader]);

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
              onStartGame?.(config.mode, config.setSize, config.rankIndex)
            }
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Another Set</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onNavigate?.('review')}
            activeOpacity={0.85}
          >
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
            <Text style={styles.secondaryBtnText}>Return to Main</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={showReviewModal}
          transparent
          animationType="fade"
          onRequestClose={handleReviewNotNow}
        >
          <View style={styles.reviewModalOverlay}>
            <View style={styles.reviewModalContent}>
              <TouchableOpacity
                style={styles.reviewCloseButton}
                onPress={handleReviewNotNow}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.reviewCloseButtonText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.reviewModalTitle}>Please rate CertamenPrep</Text>
              <Text style={styles.reviewModalMessage}>
                Enjoying the app? Please keep supporting our free app by leaving us a rating or a
                review!
              </Text>

              <TouchableOpacity
                style={styles.reviewRateButton}
                onPress={handleRateApp}
                activeOpacity={0.85}
              >
                <Text style={styles.reviewRateButtonText}>Rate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reviewNotNowButton}
                onPress={handleReviewNotNow}
                activeOpacity={0.85}
              >
                <Text style={styles.reviewNotNowButtonText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ----- ACTIVE QUESTION -----
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerColLeft}>
          <Text style={styles.headerText}>{headerLabel}</Text>
        </View>
        <View
          style={[
            styles.headerColCenter,
            (isBuzzed && !isAnswered) ||
            (!isBuzzed && !isAnswered && preBuzzSecondsRemaining !== null)
              ? styles.headerColCenterActive
              : styles.headerColCenterHidden,
          ]}
        >
          {isBuzzed && !isAnswered && (
            <Text style={styles.headerTimerText}>Time: {timeRemaining}s</Text>
          )}
          {!isBuzzed && !isAnswered && preBuzzSecondsRemaining !== null && (
            <Text style={styles.headerTimerText}>Buzz in: {preBuzzSecondsRemaining}s</Text>
          )}
        </View>
        <View style={styles.headerColRight}>
          <Text style={styles.headerCount}>★ {masteredCount} mastered</Text>
        </View>
      </View>

      <ScrollView
        style={styles.gameArea}
        contentContainerStyle={styles.gameAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, isBuzzed && styles.statusTextBuzzed]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.questionBox}>
          <Text style={styles.questionText}>
            {displayedText}
            {!isBuzzed && !isAnswered && charIndexRef.current < fullTextRef.current.length && (
              <Text style={styles.cursor}>|</Text>
            )}
          </Text>
        </View>

        {/* Buzz button (while reading / waiting to buzz) */}
        {!isBuzzed && !isAnswered && (
          <TouchableOpacity
            style={styles.buzzerBtn}
            onPress={handleBuzz}
            activeOpacity={0.8}
          >
            <Text style={styles.buzzerText}>BUZZ</Text>
          </TouchableOpacity>
        )}

        {/* Options become tappable only after buzzing */}
        {isBuzzed && !isAnswered && (
          <View style={styles.optionsGrid}>
            {current.options.map((option, i) => (
              <TouchableOpacity
                key={i}
                style={styles.optionCard}
                onPress={() => handleAnswerSelect(option)}
                activeOpacity={0.75}
              >
                <Text style={styles.optionText}>{option.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Answer feedback */}
        {isAnswered && (
          <View style={styles.optionsGrid}>
            {current.options.map((option, i) => {
              const selected = selectedAnswer === option.text;
              const showCorrect = option.isCorrect;
              const showWrong = selected && !option.isCorrect;

              return (
                <View
                  key={i}
                  style={[
                    styles.optionCard,
                    showCorrect && styles.optionCorrect,
                    showWrong && styles.optionWrong,
                  ]}
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
                </View>
              );
            })}
          </View>
        )}

        {isAnswered && (
          <View style={styles.actionRow}>
            {isCorrect ? (
              <>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={handlePass}
                  activeOpacity={0.85}
                >
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
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {config.mode === 'review' ? (
          <View style={styles.footerReviewWrap}>
            <TouchableOpacity
              style={styles.footerFinishBtn}
              onPress={() => onNavigate?.('review')}
              activeOpacity={0.85}
            >
              <Text style={styles.footerFinishBtnText}>Finish reviewing? Click me</Text>
            </TouchableOpacity>
            <Text style={styles.footerFinishHint}>
              Review mode goes over all your wrong questions so if you want, you can finish at any point!
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => {
              onTabChange?.('profile');
              onNavigate?.('main');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.footerLink}>Done learning? Click me</Text>
          </TouchableOpacity>
        )}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(245, 239, 227, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 169, 97, 0.3)',
  },
  headerColLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerColCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerColCenterHidden: {
    width: 0,
    minWidth: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  headerColCenterActive: {
    flexShrink: 0,
    minWidth: 88,
    paddingHorizontal: 6,
  },
  headerColRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerTimerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#c9a961',
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
  statusContainer: {
    alignItems: 'center',
    minHeight: 20,
  },
  statusText: {
    fontSize: 12,
    color: '#7a7a7a',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusTextBuzzed: {
    color: '#c9a961',
    fontWeight: '600',
  },
  cursor: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#c9a961',
  },
  buzzerBtn: {
    alignSelf: 'center',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 3,
    borderColor: '#c9a961',
    shadowColor: '#c9a961',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  buzzerText: {
    color: '#c9a961',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
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
  footerReviewWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  footerFinishBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(201, 169, 97, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.28)',
  },
  footerFinishHint: {
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(106, 85, 48, 0.55)',
    textAlign: 'center',
    maxWidth: 300,
  },
  footerFinishBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6a5530',
    letterSpacing: 0.3,
    textAlign: 'center',
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
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
  },
  secondaryBtnText: {
    fontSize: 14,
    color: '#3a3a3a',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reviewModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    paddingTop: 28,
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  reviewCloseButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  reviewCloseButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9a9a9a',
    lineHeight: 20,
  },
  reviewModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3a3a3a',
    marginBottom: 12,
    textAlign: 'center',
  },
  reviewModalMessage: {
    fontSize: 15,
    color: '#6a6a6a',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  reviewRateButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  reviewRateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reviewNotNowButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  reviewNotNowButtonText: {
    color: '#8a8a8a',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
