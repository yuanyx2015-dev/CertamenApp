import React, { useState, useEffect, useRef } from 'react';
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
import { getRandomQuestions, Question } from '../services/questionService';
import { getCurrentUser } from '../services/authService';
import {
  getOrCreateUserSettings,
  normalizePracticeDifficulties,
  type UserSettings,
} from '../services/userSettingsService';
import { markQuestionAsWrong, getAllWrongQuestions, isQuestionWrong } from '../services/questionReviewService';
import {
  addPracticeClearedId,
  getPracticeCategoryEntryCount,
  getPracticeClearedIds,
  PRACTICE_CLEAR_TIP_ENTRY_LIMIT,
  recordPracticeCategoryEntry,
} from '../services/practiceClearedService';
import { FeedbackOverlay } from './RomanFeedback';
import type { FeedbackOverlayHandle } from './RomanFeedback';
import { StarIcon, MASTERED_CONFIRM_MS } from './StarIcon';
import { IPadScaledPhoneColumn } from './IPadScaledPhoneColumn';
import { isIPad, useIPadColumnScale, useIPadScaledStyles } from '../lib/layout';
/** After the tossup finishes typing, the player must buzz within this many seconds or the tossup is scored incorrect. */
const PRE_BUZZ_SECONDS = 10;
/** Same hold duration as Challenge / Review mastery star. */
const HOLD_TO_CLEAR_MS = 500;

interface PracticeGameScreenProps {
  onNavigate?: (screen: string) => void;
  previousScreen?: string;
  isGuestMode?: boolean;
  /** Practice tab: category slug from the six-tile picker. */
  storyPracticeCategory?: string | null;
  onTabChange?: (tab: 'profile' | 'challenge' | 'review' | 'practice') => void;
}

export function PracticeGameScreen({
  onNavigate,
  previousScreen,
  isGuestMode,
  storyPracticeCategory = null,
  onTabChange,
}: PracticeGameScreenProps) {
  const columnScale = useIPadColumnScale(1.265);
  const styles = useIPadScaledStyles(baseStyles, columnScale);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  /** Held-to-clear count this set (also permanently excluded from future Practice). */
  const [clearedThisSession, setClearedThisSession] = useState(0);
  const [wrongThisSession, setWrongThisSession] = useState(0); // # answered wrong in this set
  /** Original set size for end-of-set stats (pool shrinks when cleared). */
  const [startedSetSize, setStartedSetSize] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<Array<{text: string; isCorrect: boolean}>>([]);
  const [statusText, setStatusText] = useState('Loading questions...');
  const [timeRemaining, setTimeRemaining] = useState(5);
  /** Countdown after the full question is shown; null = not running (still streaming or already buzzed/resolved). */
  const [preBuzzSecondsRemaining, setPreBuzzSecondsRemaining] = useState<number | null>(null);
  const [isWrongQuestionsMode, setIsWrongQuestionsMode] = useState(false); // Track if using wrong questions mode
  const [isPreviouslyWrong, setIsPreviouslyWrong] = useState(false); // Track if current question was previously answered wrong
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false); // Whether the current question was answered correctly
  const [starCleared, setStarCleared] = useState(false);
  /** Eligible for the clear tip (first N Practice category entries). */
  const [clearTipEligible, setClearTipEligible] = useState(false);
  /** After leaving the first question of this set, never show the tip again. */
  const [pastFirstQuestion, setPastFirstQuestion] = useState(false);
  /** Bumped by "Try Again" to re-run the loader with the SAME mode/settings. */
  const [reloadNonce, setReloadNonce] = useState(0);

  const charIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const answerRemainingRef = useRef<number>(5);
  const preBuzzIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preBuzzRemainingRef = useRef<number | null>(null);
  const fullTextRef = useRef('');
  const feedbackRef = useRef<FeedbackOverlayHandle>(null);
  const isBuzzedRef = useRef(false);
  const isAnsweredRef = useRef(false);
  const questionsRef = useRef<Question[]>([]);
  const currentQuestionIndexRef = useRef(0);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const starClearedRef = useRef(false);
  const practiceScopeIdRef = useRef('guest');

  /** Practice never feeds the Review pool (Challenge / Review handle that). */
  const skipWrongTracking = true;

  useEffect(() => {
    isBuzzedRef.current = isBuzzed;
  }, [isBuzzed]);
  useEffect(() => {
    isAnsweredRef.current = isAnswered;
  }, [isAnswered]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  // Load questions from database
  useEffect(() => {
    const loadQuestionsAndStats = async () => {
      setIsLoading(true);
      setLoadError(null);
      // Always start a fresh set (covers the "Try Again" reload path too).
      setCurrentQuestionIndex(0);
      setClearedThisSession(0);
      setWrongThisSession(0);
      setStartedSetSize(0);
      setPastFirstQuestion(false);

      let totalQuestions = 20;
      let wrongQuestionsOnly = false;
      let user = null;
      let settingsForScope: UserSettings | null = null;

      if (!isGuestMode) {
        user = await getCurrentUser();
        if (user) {
          practiceScopeIdRef.current = user.id;
          const { data: settings } = await getOrCreateUserSettings(user.id);
          settingsForScope = settings ?? null;
          if (settings) {
            totalQuestions = settings.num_tossups;
            wrongQuestionsOnly = settings.wrong_questions_only;
            setIsWrongQuestionsMode(wrongQuestionsOnly);
          }
        } else {
          practiceScopeIdRef.current = 'guest';
        }
      } else {
        practiceScopeIdRef.current = 'guest';
        const { data: settings } = await getOrCreateUserSettings('guest');
        settingsForScope = settings ?? null;
        if (settings) {
          totalQuestions = settings.num_tossups;
        }
      }

      const storageUserId = practiceScopeIdRef.current;
      const practiceDifficulties = normalizePracticeDifficulties(
        settingsForScope?.practice_session_difficulty
      );
      const difficultySet = new Set(practiceDifficulties);
      // RPC takes a single difficulty; null = all, then we filter to the selection.
      const rpcDifficulty =
        practiceDifficulties.length === 1 ? practiceDifficulties[0] : null;

      const clearedIds = await getPracticeClearedIds(storageUserId);
      // Tip eligibility: first N category entries into Practice (not Try Again reloads).
      // The tip itself only renders on the first question of that entry.
      if (reloadNonce === 0) {
        const entryCount = await recordPracticeCategoryEntry(storageUserId);
        setClearTipEligible(entryCount <= PRACTICE_CLEAR_TIP_ENTRY_LIMIT);
      } else {
        const entryCount = await getPracticeCategoryEntryCount(storageUserId);
        setClearTipEligible(entryCount <= PRACTICE_CLEAR_TIP_ENTRY_LIMIT);
      }

      let loadedQuestions: Question[] = [];

      try {
        if (wrongQuestionsOnly && !isGuestMode && user) {
          const fetchCap = Math.max(totalQuestions * 4, 120);
          const { data: wrongQuestions, error: wrongError } = await getAllWrongQuestions(
            user.id,
            fetchCap
          );
          if (wrongError) throw wrongError;
          let pool = (wrongQuestions ?? []).filter((q) => !clearedIds.has(q.id));
          if (storyPracticeCategory) {
            pool = pool.filter((q) => q.category === storyPracticeCategory);
          }
          pool = pool.filter((q) => difficultySet.has(q.difficulty));
          loadedQuestions = shuffleArray(pool).slice(0, totalQuestions);
          if (loadedQuestions.length === 0) {
            if (wrongQuestions && wrongQuestions.length > 0) {
              setLoadError(
                'It seems as if there are no wrong questions for this category in your selected difficulties. Change settings or practice more in this category!'
              );
            } else {
              setLoadError('You have no wrong questions to review! Try Challenge Mode first.');
            }
            setIsLoading(false);
            return;
          }
        } else if (storyPracticeCategory) {
          // Over-fetch so permanently cleared Practice questions can be filtered out.
          const fetchLimit = Math.min(
            Math.max(totalQuestions + clearedIds.size + 15, totalQuestions * 2),
            120
          );
          const { data: catQuestions, error } = await getRandomQuestions(
            storyPracticeCategory,
            rpcDifficulty ?? undefined,
            fetchLimit
          );
          if (error) throw error;
          loadedQuestions = shuffleArray(
            (catQuestions ?? []).filter(
              (q) => !clearedIds.has(q.id) && difficultySet.has(q.difficulty)
            )
          ).slice(0, totalQuestions);
        } else {
          setLoadError('Pick a category in Practice Mode to start.');
          setIsLoading(false);
          return;
        }

        if (loadedQuestions.length === 0) {
          setLoadError(
            clearedIds.size > 0
              ? 'No Practice questions left in this category for your settings. Cleared questions stay out of Practice permanently.'
              : 'No questions found in database'
          );
          setIsLoading(false);
          return;
        }

        setQuestions(loadedQuestions);
        setStartedSetSize(loadedQuestions.length);
        setIsLoading(false);
        setStatusText('Ready...');
      } catch (error) {
        console.error('Error loading questions:', error);
        setLoadError('Failed to load questions from database');
        setIsLoading(false);
      }
    };

    loadQuestionsAndStats();
  }, [isGuestMode, storyPracticeCategory, reloadNonce]);

  // Shuffle function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const clearPreBuzzTimer = () => {
    if (preBuzzIntervalRef.current) {
      clearInterval(preBuzzIntervalRef.current);
      preBuzzIntervalRef.current = null;
    }
  };

  const triggerFeedbackAnimation = (isCorrect: boolean) => {
    feedbackRef.current?.show(isCorrect ? 'correct' : 'wrong');
  };

  /** No buzz before PRE_BUZZ_SECONDS elapsed after the tossup finished — score as incorrect. */
  const handleNoBuzzInTime = async () => {
    if (isBuzzedRef.current || isAnsweredRef.current) return;
    isAnsweredRef.current = true;

    clearPreBuzzTimer();
    setPreBuzzSecondsRemaining(null);
    setIsAnswered(true);
    setSelectedAnswer(null);
    setDisplayedText(fullTextRef.current);
    setStatusText("Time's up! You didn't buzz in time.");
    triggerFeedbackAnimation(false);
    setWrongThisSession((n) => n + 1);

    if (!skipWrongTracking) {
      const user = await getCurrentUser();
      const idx = currentQuestionIndexRef.current;
      const qs = questionsRef.current;
      if (user && qs[idx]) {
        await markQuestionAsWrong(user.id, qs[idx].id);
      }
    }
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

  // Start question
  const startQuestion = async () => {
    if (currentQuestionIndex >= questions.length) {
      // Game over
      setStatusText('Practice Complete!');
      return;
    }

    // Reset state
    clearPreBuzzTimer();
    setPreBuzzSecondsRemaining(null);
    isBuzzedRef.current = false;
    isAnsweredRef.current = false;
    setIsBuzzed(false);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setDisplayedText('');
    charIndexRef.current = 0;
    setStatusText('Reading question...');
    setIsPreviouslyWrong(false); // Reset indicator
    setLastAnswerCorrect(false);
    setStarCleared(false);
    starClearedRef.current = false;
    holdAnim.setValue(0);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const currentQuestion = questions[currentQuestionIndex];
    fullTextRef.current = currentQuestion.question_text;

    // Check if this question was previously answered wrong (only when profile scoring applies)
    if (!isWrongQuestionsMode && !isGuestMode) {
      const user = await getCurrentUser();
      if (user) {
        const { data: wasWrong } = await isQuestionWrong(user.id, currentQuestion.id);
        if (wasWrong) {
          setIsPreviouslyWrong(true);
        }
      }
    }

    // Prepare shuffled options (trim so DB trailing spaces don't throw off textAlign center)
    const options = [
      { text: currentQuestion.correct_answer.trim(), isCorrect: true },
      { text: currentQuestion.wrong_answers[0].trim(), isCorrect: false },
      { text: currentQuestion.wrong_answers[1].trim(), isCorrect: false },
      { text: currentQuestion.wrong_answers[2].trim(), isCorrect: false },
    ];
    setShuffledOptions(shuffleArray(options));

    // Start streaming text
    streamIntervalRef.current = setInterval(() => {
      if (charIndexRef.current < fullTextRef.current.length) {
        setDisplayedText(fullTextRef.current.substring(0, charIndexRef.current + 1));
        charIndexRef.current++;
      } else {
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }
        setStatusText('Waiting for buzz...');
        startPreBuzzCountdown();
      }
    }, 50); // 50ms per character
  };

  // Handle buzz
  const handleBuzz = () => {
    if (isBuzzedRef.current || isAnsweredRef.current) return;
    isBuzzedRef.current = true;

    // Stop streaming immediately
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    clearPreBuzzTimer();
    setPreBuzzSecondsRemaining(null);

    setIsBuzzed(true);
    setStatusText('Buzzed! Select your answer...');
    answerRemainingRef.current = 5;
    setTimeRemaining(5);

    // Decrement and fire the timeout handler from the timer callback (not from
    // inside a setState updater), so FeedbackOverlay's state isn't updated
    // during this component's render.
    timerIntervalRef.current = setInterval(() => {
      const next = answerRemainingRef.current - 1;
      if (next <= 0) {
        answerRemainingRef.current = 0;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setTimeRemaining(0);
        void handleTimeUp();
      } else {
        answerRemainingRef.current = next;
        setTimeRemaining(next);
      }
    }, 1000);
  };

  // Post-buzz answer window expired — no option selected
  const handleTimeUp = async () => {
    if (isAnsweredRef.current) return;
    isAnsweredRef.current = true;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsAnswered(true);
    setSelectedAnswer(null);
    setDisplayedText(fullTextRef.current);
    setStatusText("Time's up! No answer selected.");
    triggerFeedbackAnimation(false);
    setWrongThisSession((n) => n + 1);

    if (!skipWrongTracking) {
      const user = await getCurrentUser();
      const q = questions[currentQuestionIndex];
      if (user && q) {
        await markQuestionAsWrong(user.id, q.id);
      }
    }
  };

  // Handle answer selection
  const handleAnswerSelect = async (option: {text: string; isCorrect: boolean}) => {
    if (isAnsweredRef.current) return;
    isAnsweredRef.current = true;

    // Stop the timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    setIsAnswered(true);
    setSelectedAnswer(option.text);
    setLastAnswerCorrect(option.isCorrect);

    // Show full text
    setDisplayedText(fullTextRef.current);

    // Trigger feedback animation
    triggerFeedbackAnimation(option.isCorrect);

    if (option.isCorrect) {
      setStatusText('Correct!');
    } else {
      setStatusText('Wrong! Better luck next time.');
      setWrongThisSession((n) => n + 1);
      if (!skipWrongTracking) {
        const user = await getCurrentUser();
        if (user && questions[currentQuestionIndex]) {
          await markQuestionAsWrong(user.id, questions[currentQuestionIndex].id);
        }
      }
    }
  };

  // Next question (leave it in the session list behind you; no server writes).
  const nextQuestion = () => {
    setPastFirstQuestion(true);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  /**
   * Hold-to-clear: permanently exclude from future Practice pools (device-local),
   * remove from this set, advance. Never mastery / Review / ranks.
   */
  const fireClearFromPractice = async () => {
    setPastFirstQuestion(true);
    const q = questions[currentQuestionIndex];
    if (q) {
      await addPracticeClearedId(practiceScopeIdRef.current, q.id);
    }
    setClearedThisSession((n) => n + 1);
    setQuestions((prev) => {
      const next = [...prev];
      if (currentQuestionIndex >= 0 && currentQuestionIndex < next.length) {
        next.splice(currentQuestionIndex, 1);
      }
      return next;
    });
  };

  const handleStarPressIn = () => {
    if (!lastAnswerCorrect || starClearedRef.current) return;
    holdAnim.setValue(0);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_TO_CLEAR_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    holdTimerRef.current = setTimeout(() => {
      starClearedRef.current = true;
      setStarCleared(true);
      holdTimerRef.current = setTimeout(() => {
        void fireClearFromPractice();
      }, MASTERED_CONFIRM_MS);
    }, HOLD_TO_CLEAR_MS);
  };

  const handleStarPressOut = () => {
    if (starClearedRef.current) return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    Animated.timing(holdAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  // Start first question on mount (only when questions are loaded)
  useEffect(() => {
    if (!isLoading && questions.length > 0) {
      startQuestion();
    }
    
    // Cleanup function when component unmounts (user exits game)
    return () => {
      // Clear all intervals
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      clearPreBuzzTimer();
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [currentQuestionIndex, isLoading, questions]);

  // Check if game is over (empty pool after clears, or index past the end via Next).
  const isGameOver =
    !isLoading &&
    !loadError &&
    startedSetSize > 0 &&
    (questions.length === 0 || currentQuestionIndex >= questions.length);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c9a961" />
          <Text style={styles.loadingText}>Loading questions from database...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (loadError) {
    const errorTitle = loadError.includes('It seems as if there are no wrong questions')
      ? 'Uh oh!'
      : loadError.includes('Try practicing normally first')
        ? "You're too good!"
        : 'Error';
    
    return (
      <View style={[styles.container]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity 
            style={styles.restartButton}
            onPress={() => onNavigate?.('main')}
          >
            <Text style={styles.restartButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Game over state
  if (isGameOver) {
    return (
      <View style={[styles.container]}>
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Practice Complete!</Text>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardMastered]}>
              <View style={styles.statNumberBox}>
                <Text style={[styles.statNumber, styles.statNumberMastered]}>
                  {clearedThisSession}
                </Text>
              </View>
              <Text style={styles.statLabel}>Cleared</Text>
            </View>
            <View style={[styles.statCard, styles.statCardWrong]}>
              <View style={styles.statNumberBox}>
                <Text style={[styles.statNumber, styles.statNumberWrong, styles.statNumberFraction]}>
                  {wrongThisSession}/{startedSetSize}
                </Text>
              </View>
              <Text style={styles.statLabel}>Wrong</Text>
            </View>
          </View>

          {/* Guest Sign-In Prompt */}
          {isGuestMode && (
            <View style={styles.guestPromptContainer}>
              <Text style={styles.guestPromptText}>
                Sign in to unlock Challenge Mode and keep a wrong-question list.
              </Text>
              <TouchableOpacity 
                style={styles.signInPromptButton}
                onPress={() => onNavigate?.('login')}
              >
                <Text style={styles.signInPromptButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setReloadNonce((n) => n + 1)}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => onNavigate?.('main')}
          >
            <Text style={styles.backButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const gameBody = (
    <>
      {/* Guest Mode Banner */}
      {isGuestMode && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>
            Guest mode — sign in to unlock Challenge & Review
          </Text>
          <TouchableOpacity
            style={styles.guestSignInButton}
            onPress={() => onNavigate?.('login')}
            activeOpacity={0.7}
          >
            <Text style={styles.guestSignInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header (pre-buzz + answer timers stay visible while scrolling) */}
      <View style={styles.header}>
        <View style={styles.headerColLeft}>
          <Text style={styles.headerText}>
            Question {currentQuestionIndex + 1}/{questions.length}
          </Text>
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
          {!isBuzzed &&
            !isAnswered &&
            preBuzzSecondsRemaining !== null && (
              <Text style={styles.headerTimerText}>
                Buzz in: {preBuzzSecondsRemaining}s
              </Text>
            )}
        </View>
        <View style={styles.headerColRight} />
      </View>

      {/* Game Area */}
      <ScrollView
        style={styles.gameArea}
        contentContainerStyle={styles.gameAreaContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Text */}
        <View style={styles.statusContainer}>
          <Text
            style={[styles.statusText, isBuzzed && styles.statusTextBuzzed]}
          >
            {statusText}
          </Text>
        </View>

        {/* Question Box */}
        <View style={styles.questionBox}>
          {isPreviouslyWrong && !isWrongQuestionsMode && !isGuestMode && (
            <View style={styles.previouslyWrongIndicator}>
              <Text style={styles.previouslyWrongText}>Previously Incorrect</Text>
            </View>
          )}
          <Text style={styles.questionText}>
            {displayedText}
            {!isBuzzed &&
              !isAnswered &&
              charIndexRef.current < fullTextRef.current.length && (
                <Text style={styles.cursor}>|</Text>
              )}
          </Text>
        </View>

        {/* Buzz Button */}
        {!isBuzzed && !isAnswered && (
          <TouchableOpacity
            style={styles.buzzerBtn}
            onPress={handleBuzz}
            activeOpacity={0.8}
          >
            <Text style={styles.buzzerText}>BUZZ</Text>
          </TouchableOpacity>
        )}

        {/* Options Grid */}
        {isBuzzed && !isAnswered && (
          <View style={styles.optionsGrid}>
            {shuffledOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionCard}
                onPress={() => handleAnswerSelect(option)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionText}>{option.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Answer Feedback */}
        {isAnswered && (
          <View style={styles.optionsGrid}>
            {shuffledOptions.map((option, index) => (
              <View
                key={index}
                style={[
                  styles.optionCard,
                  option.isCorrect && styles.optionCorrect,
                  option.text === selectedAnswer &&
                    !option.isCorrect &&
                    styles.optionWrong,
                  !selectedAnswer &&
                    option.isCorrect &&
                    styles.optionCorrect, // Highlight correct answer when time runs out
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    option.isCorrect && styles.optionTextCorrect,
                    option.text === selectedAnswer &&
                      !option.isCorrect &&
                      styles.optionTextWrong,
                  ]}
                >
                  {option.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {isAnswered && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.nextBtn} onPress={nextQuestion}>
              <Text style={styles.nextBtnText}>Next Question →</Text>
            </TouchableOpacity>

            {lastAnswerCorrect && (
              <View style={styles.starWrap}>
                <TouchableOpacity
                  onPressIn={handleStarPressIn}
                  onPressOut={handleStarPressOut}
                  activeOpacity={1}
                  style={styles.starPress}
                  accessibilityRole="button"
                  accessibilityLabel="Hold to clear this question from Practice permanently"
                >
                  <StarIcon filled={0} progress={holdAnim} />
                </TouchableOpacity>
                <Text style={styles.starHint}>
                  {starCleared ? 'Cleared!' : 'Hold to Clear from Practice'}
                </Text>
                {clearTipEligible && !pastFirstQuestion && (
                  <Text style={styles.starTip}>
                    Questions cleared from Practice are cleared permanently.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );

  const exitFooter = (
    <View style={styles.footer}>
      <View style={styles.footerWrap}>
        <TouchableOpacity
          style={styles.footerFinishBtn}
          onPress={() => {
            onTabChange?.('practice');
            onNavigate?.('main');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.footerFinishBtnText}>Done learning? Click me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isIPad && styles.containerIPad]}>
      {isIPad ? (
        <IPadScaledPhoneColumn extraShrink={1.265}>
          <View style={styles.scaledGameBody}>
            {gameBody}
            <FeedbackOverlay ref={feedbackRef} />
          </View>
          {exitFooter}
        </IPadScaledPhoneColumn>
      ) : (
        <>
          <View style={styles.scaledGameBody}>
            {gameBody}
            <FeedbackOverlay ref={feedbackRef} />
          </View>
          {exitFooter}
        </>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  containerIPad: {
    maxWidth: '100%',
  },
  scaledGameBody: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 14,
    color: '#6a6a6a',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3a3a',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6a6a6a',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    minWidth: 104,
    paddingHorizontal: 8,
  },
  headerColRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerTimerText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#c9a961',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a3a3a',
  },
  gameArea: {
    flex: 1,
  },
  gameAreaContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  statusContainer: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 16,
    color: '#7a7a7a',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusTextBuzzed: {
    color: '#c9a961',
    fontWeight: '600',
  },
  questionBox: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    padding: 18,
    minHeight: 108,
    position: 'relative',
  },
  previouslyWrongIndicator: {
    position: 'absolute',
    top: -8,
    right: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 76, 76, 0.3)',
    backgroundColor: 'rgba(245, 239, 227, 0.95)',
  },
  previouslyWrongText: {
    fontSize: 11,
    color: '#8B4C4C',
    fontWeight: '600',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3a3a3a',
  },
  cursor: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#c9a961',
  },
  buzzerBtn: {
    width: 136,
    height: 136,
    borderRadius: 68,
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
    marginVertical: 4,
  },
  buzzerText: {
    color: '#c9a961',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
  },
  optionsGrid: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    rowGap: 10,
  },
  optionCard: {
    width: '48%',
    flexGrow: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    borderRadius: 10,
    padding: 14,
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#3a3a3a',
    lineHeight: 20,
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
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: 120,
  },
  starTip: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    color: '#8a6a3a',
    letterSpacing: 0.15,
    textAlign: 'center',
    maxWidth: 140,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.25)',
    backgroundColor: 'rgba(245, 239, 227, 0.85)',
  },
  footerWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  footerFinishBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(201, 169, 97, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.28)',
  },
  footerFinishBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6a5530',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  nextBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    backgroundColor: '#c9a961',
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
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3a3a',
    marginBottom: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    marginBottom: 36,
  },
  statCard: {
    flex: 1,
    minWidth: 132,
    minHeight: 120,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  statCardMastered: {
    backgroundColor: 'rgba(201, 169, 97, 0.14)',
    borderColor: 'rgba(201, 169, 97, 0.55)',
  },
  statCardWrong: {
    backgroundColor: 'rgba(176, 58, 46, 0.08)',
    borderColor: 'rgba(176, 58, 46, 0.4)',
  },
  statNumberBox: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 46,
    fontWeight: '800',
    lineHeight: 50,
  },
  statNumberMastered: {
    color: '#a8842f',
  },
  statNumberWrong: {
    color: '#9a3327',
  },
  statNumberFraction: {
    fontSize: 36,
    lineHeight: 40,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#6a6a6a',
    textTransform: 'uppercase',
  },
  primaryButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: '#c9a961',
    borderRadius: 10,
    marginBottom: 14,
    minWidth: 220,
    alignItems: 'center',
    shadowColor: '#9d856b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  restartButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    marginBottom: 15,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  restartButtonText: {
    color: '#3a3a3a',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 10,
    minWidth: 220,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    color: '#3a3a3a',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(201, 169, 97, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 169, 97, 0.3)',
  },
  guestBannerText: {
    fontSize: 13,
    color: '#3a3a3a',
    flex: 1,
  },
  guestSignInButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.5)',
  },
  guestSignInButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3a3a3a',
  },
  guestPromptContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  guestPromptText: {
    fontSize: 16,
    color: '#6a6a6a',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  signInPromptButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(201, 169, 97, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  signInPromptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a3a3a',
    letterSpacing: 0.5,
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
