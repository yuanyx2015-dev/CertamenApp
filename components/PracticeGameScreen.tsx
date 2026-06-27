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
  Modal,
} from 'react-native';
import { getRandomQuestions, Question } from '../services/questionService';
import { getCurrentUser } from '../services/authService';
import { getOrCreateUserStats, updateUserScore } from '../services/userStatsService';
import {
  getOrCreateUserSettings,
  type UserSettingsScope,
  type UserSettings,
} from '../services/userSettingsService';
import { markQuestionAsWrong, getAllWrongQuestions, isQuestionWrong } from '../services/questionReviewService';
import { masterQuestion, getMasteredCount } from '../services/userMasteredService';
import {
  shouldShowReviewPrompt,
  markReviewPromptShown,
  confirmReview,
} from '../lib/appReview';
import { FeedbackOverlay } from './RomanFeedback';
import type { FeedbackOverlayHandle } from './RomanFeedback';
import { StarIcon } from './StarIcon';
/** After the tossup finishes typing, the player must buzz within this many seconds or the tossup is scored incorrect. */
const PRE_BUZZ_SECONDS = 10;
/** Hold duration on the star to master a question. */
const HOLD_TO_MASTER_MS = 1000;

interface PracticeGameScreenProps {
  onNavigate?: (screen: string) => void;
  previousScreen?: string;
  isGuestMode?: boolean;
  /** When set, all tossups use this difficulty only (Rank-up / story Practice pickers). Rank-based mix when null. */
  fixedDifficulty?: 'easy' | 'medium' | 'hard' | null;
  /** Local tossup settings: rank-up vs practice (Story) buckets. */
  settingsScope?: UserSettingsScope;
  /** Story Practice: category slug from the six-tile picker. */
  storyPracticeCategory?: string | null;
}

export function PracticeGameScreen({
  onNavigate,
  previousScreen,
  isGuestMode,
  fixedDifficulty = null,
  settingsScope = 'rank-up',
  storyPracticeCategory = null,
}: PracticeGameScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sessionScore, setSessionScore] = useState(0); // Score for this game session only
  const [cumulativeScore, setCumulativeScore] = useState(0); // Total user score from database
  const [displayedText, setDisplayedText] = useState('');
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<Array<{text: string; isCorrect: boolean}>>([]);
  const [statusText, setStatusText] = useState('Loading questions...');
  const [rank, setRank] = useState('Miles');
  const [timeRemaining, setTimeRemaining] = useState(5);
  /** Countdown after the full question is shown; null = not running (still streaming or already buzzed/resolved). */
  const [preBuzzSecondsRemaining, setPreBuzzSecondsRemaining] = useState<number | null>(null);
  const [isWrongQuestionsMode, setIsWrongQuestionsMode] = useState(false); // Track if using wrong questions mode
  const [isPreviouslyWrong, setIsPreviouslyWrong] = useState(false); // Track if current question was previously answered wrong
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false); // Whether the current question was answered correctly
  const [justMastered, setJustMastered] = useState(false); // Current question has been marked mastered
  const [showReviewModal, setShowReviewModal] = useState(false); // Custom "rate the app" popup
  /** Bumped by "Try Again" to re-run the loader with the SAME mode/settings. */
  const [reloadNonce, setReloadNonce] = useState(0);

  const charIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preBuzzIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullTextRef = useRef('');
  const feedbackRef = useRef<FeedbackOverlayHandle>(null);
  const isBuzzedRef = useRef(false);
  const isAnsweredRef = useRef(false);
  const questionsRef = useRef<Question[]>([]);
  const currentQuestionIndexRef = useRef(0);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Practice Mode (settingsScope='practice') is intentionally read-only:
   *   - no wrong-answer tracking
   *   - no score updates
   *   - no rank updates
   * It's just difficulty + category gameplay.
   */
  const isPracticeMode = settingsScope === 'practice';
  const skipProfileScoring = isGuestMode || isPracticeMode;
  const skipWrongTracking = isWrongQuestionsMode || isGuestMode || isPracticeMode;

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
      setSessionScore(0);
      
      // Load user stats and settings first (skip for guest mode)
      let currentRank = 'Miles';
      let totalQuestions = 20; // Default
      let wrongQuestionsOnly = false;
      let user = null;
      let settingsForScope: UserSettings | null = null;

      if (!isGuestMode) {
        user = await getCurrentUser();
        if (user) {
          const { data: stats } = await getOrCreateUserStats(user.id);
          if (stats) {
            setCumulativeScore(stats.score); // Store cumulative score
            setRank(stats.rank);
            currentRank = stats.rank;
          }

          const { data: settings } = await getOrCreateUserSettings(user.id, settingsScope);
          settingsForScope = settings ?? null;
          if (settings) {
            totalQuestions = settings.num_tossups;
            wrongQuestionsOnly = settings.wrong_questions_only;
            setIsWrongQuestionsMode(wrongQuestionsOnly);
          }
        }
      } else {
        const { data: settings } = await getOrCreateUserSettings('guest', settingsScope);
        settingsForScope = settings ?? null;
        if (settings) {
          totalQuestions = settings.num_tossups;
        }
      }

      const practiceSessionDifficulty =
        settingsScope === 'practice'
          ? settingsForScope?.practice_session_difficulty ?? 'easy'
          : null;

      const allQuestions: Question[] = [];
      const seenIds = new Set<string>(); // Extra safeguard to prevent duplicates

      const difficultyForFilters =
        settingsScope === 'practice' && storyPracticeCategory
          ? practiceSessionDifficulty
          : fixedDifficulty;

      try {
        if (wrongQuestionsOnly && !isGuestMode && user) {
          const fetchCap = Math.max(totalQuestions * 4, 120);
          const { data: wrongQuestions, error: wrongError } = await getAllWrongQuestions(
            user.id,
            fetchCap
          );
          if (wrongError) throw wrongError;
          let pool = wrongQuestions ?? [];
          if (storyPracticeCategory) {
            pool = pool.filter((q) => q.category === storyPracticeCategory);
          }
          if (difficultyForFilters) {
            pool = pool.filter((q) => q.difficulty === difficultyForFilters);
          }
          const picked = shuffleArray(pool).slice(0, totalQuestions);
          if (picked.length > 0) {
            picked.forEach((q) => {
              if (!seenIds.has(q.id)) {
                allQuestions.push(q);
                seenIds.add(q.id);
              }
            });
          } else if (wrongQuestions && wrongQuestions.length > 0 && difficultyForFilters) {
            setLoadError(
              'It seems as if there are no wrong questions for this category in your selected difficulty. Change settings or practice more in this category!'
            );
            setIsLoading(false);
            return;
          } else {
            setLoadError('You have no wrong questions to review! Try practicing normally first.');
            setIsLoading(false);
            return;
          }
        } else if (
          settingsScope === 'practice' &&
          storyPracticeCategory &&
          practiceSessionDifficulty
        ) {
          const { data: catQuestions, error } = await getRandomQuestions(
            storyPracticeCategory,
            practiceSessionDifficulty,
            totalQuestions
          );
          if (error) throw error;
          if (catQuestions) {
            catQuestions.forEach((q) => {
              if (!seenIds.has(q.id)) {
                allQuestions.push(q);
                seenIds.add(q.id);
              }
            });
          }
        } else if (fixedDifficulty) {
          const { data: fixedQuestions, error } = await getRandomQuestions(
            undefined,
            fixedDifficulty,
            totalQuestions
          );
          if (error) throw error;
          if (fixedQuestions) {
            fixedQuestions.forEach((q) => {
              if (!seenIds.has(q.id)) {
                allQuestions.push(q);
                seenIds.add(q.id);
              }
            });
          }
        } else {
          // Rank-based mix across difficulties
          const distribution = getQuestionDistribution(currentRank, totalQuestions);

          const difficulties: Array<{ level: 'easy' | 'medium' | 'hard'; count: number }> = [
            { level: 'easy', count: distribution.easy },
            { level: 'medium', count: distribution.medium },
            { level: 'hard', count: distribution.hard },
          ];

          for (const { level, count } of difficulties) {
            if (count > 0) {
              const { data: questions, error } = await getRandomQuestions(undefined, level, count);
              if (error) throw error;
              if (questions) {
                questions.forEach((q) => {
                  if (!seenIds.has(q.id)) {
                    allQuestions.push(q);
                    seenIds.add(q.id);
                  }
                });
              }
            }
          }
        }
        
        if (allQuestions.length === 0) {
          setLoadError('No questions found in database');
          setIsLoading(false);
          return;
        }
        
        // Shuffle all questions together
        const shuffledQuestions = shuffleArray(allQuestions);
        setQuestions(shuffledQuestions);
        setIsLoading(false);
        setStatusText('Ready...');
        
      } catch (error) {
        console.error('Error loading questions:', error);
        setLoadError('Failed to load questions from database');
        setIsLoading(false);
      }
    };
    
    loadQuestionsAndStats();
  }, [isGuestMode, fixedDifficulty, settingsScope, storyPracticeCategory, reloadNonce]);

  // Shuffle function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const pointsForQuestionDifficulty = (d: Question['difficulty'] | undefined): number => {
    if (d === 'medium') return 15;
    if (d === 'hard') return 25;
    return 10;
  };

  const maxPointsForQuestions = (qs: Question[]): number =>
    qs.reduce((sum, q) => sum + pointsForQuestionDifficulty(q.difficulty), 0);

  // Calculate rank based on cumulative score
  const calculateRank = (totalScore: number): string => {
    if (totalScore >= 10000) return 'Legatus Legionis';
    if (totalScore >= 7000) return 'Praefectus Castrorum';
    if (totalScore >= 5000) return 'Primus Pilus';
    if (totalScore >= 3000) return 'Centurio';
    if (totalScore >= 1500) return 'Optio';
    if (totalScore >= 500) return 'Decanus';
    return 'Miles';
  };

  // Get question difficulty distribution based on rank
  const getQuestionDistribution = (rank: string, totalQuestions: number = 10) => {
    const distributions: Record<string, { easy: number; medium: number; hard: number }> = {
      'Miles': { easy: 0.8, medium: 0.2, hard: 0 },
      'Decanus': { easy: 0.6, medium: 0.4, hard: 0 },
      'Optio': { easy: 0.4, medium: 0.4, hard: 0.2 },
      'Centurio': { easy: 0.2, medium: 0.4, hard: 0.4 },
      'Primus Pilus': { easy: 0, medium: 0.4, hard: 0.6 },
      'Praefectus Castrorum': { easy: 0, medium: 0.2, hard: 0.8 },
      'Legatus Legionis': { easy: 0, medium: 0, hard: 1.0 }
    };

    const distribution = distributions[rank] || distributions['Miles'];
    
    return {
      easy: Math.round(totalQuestions * distribution.easy),
      medium: Math.round(totalQuestions * distribution.medium),
      hard: Math.round(totalQuestions * distribution.hard)
    };
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
    setPreBuzzSecondsRemaining(PRE_BUZZ_SECONDS);
    preBuzzIntervalRef.current = setInterval(() => {
      setPreBuzzSecondsRemaining((prev) => {
        if (prev === null || prev <= 0) return prev;
        if (prev <= 1) {
          clearPreBuzzTimer();
          void handleNoBuzzInTime();
          return null;
        }
        return prev - 1;
      });
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
    setJustMastered(false);
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

    // Prepare shuffled options
    const options = [
      { text: currentQuestion.correct_answer, isCorrect: true },
      { text: currentQuestion.wrong_answers[0], isCorrect: false },
      { text: currentQuestion.wrong_answers[1], isCorrect: false },
      { text: currentQuestion.wrong_answers[2], isCorrect: false }
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
    setTimeRemaining(5);

    // Start 5-second countdown timer
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (prevTime <= 1) {
          // Time's up! Auto-mark as wrong
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          handleTimeUp();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000); // Decrease every second
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
      if (skipProfileScoring) {
        setStatusText('Correct!');
      } else if (isWrongQuestionsMode) {
        setStatusText('Correct!');
      } else {
        const pointsAwarded = pointsForQuestionDifficulty(
          questions[currentQuestionIndex]?.difficulty
        );
        const newSessionScore = sessionScore + pointsAwarded;
        setSessionScore(newSessionScore);
        setStatusText(`Correct! +${pointsAwarded} points`);

        const user = await getCurrentUser();
        if (user) {
          const newCumulativeScore = cumulativeScore + pointsAwarded;
          const newRank = calculateRank(newCumulativeScore);
          const { error } = await updateUserScore(user.id, newCumulativeScore, newRank);
          if (!error) {
            setCumulativeScore(newCumulativeScore);
            setRank(newRank);
          }
        }
      }
    } else {
      setStatusText('Wrong! Better luck next time.');
      if (!skipWrongTracking) {
        const user = await getCurrentUser();
        if (user && questions[currentQuestionIndex]) {
          await markQuestionAsWrong(user.id, questions[currentQuestionIndex].id);
        }
      }
    }
  };

  // Next question
  const nextQuestion = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  // Mark the current (correctly answered) question as mastered, then advance.
  const fireMaster = async () => {
    if (justMastered) return;
    setJustMastered(true);
    const user = await getCurrentUser();
    const q = questions[currentQuestionIndex];
    if (user && q) {
      await masterQuestion(user.id, q.id);
    }
    nextQuestion();
  };

  const handleStarPressIn = () => {
    if (!lastAnswerCorrect || justMastered) return;
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
  };

  const handleStarPressOut = () => {
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
      
      // Reset game state for fresh start on next entry
      // This ensures a new game starts when user returns
    };
  }, [currentQuestionIndex, isLoading, questions]);

  // Check if game is over
  const isGameOver = questions.length > 0 && currentQuestionIndex >= questions.length;

  // At the end of a real (scored) set, decide whether to show the custom "rate the app" popup:
  // first set ever, then again each time mastered questions reach 10/20/30..., until the user rates.
  useEffect(() => {
    if (!(isGameOver && !isGuestMode && !isPracticeMode && !isWrongQuestionsMode)) return;
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const { data: masteredCount } = await getMasteredCount(user.id);
      const count = masteredCount ?? 0;
      const show = await shouldShowReviewPrompt(count);
      if (show && !cancelled) {
        await markReviewPromptShown(count);
        setShowReviewModal(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGameOver, isGuestMode, isPracticeMode, isWrongQuestionsMode]);

  const handleRateApp = async () => {
    setShowReviewModal(false);
    await confirmReview();
  };

  const handleReviewNotNow = () => {
    setShowReviewModal(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
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
      <View style={styles.container}>
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
      <View style={styles.container}>
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Practice Complete!</Text>
          {!isWrongQuestionsMode && !skipProfileScoring && (
            <Text style={styles.gameOverScore}>
              Final Score: {sessionScore} / {maxPointsForQuestions(questions)}
            </Text>
          )}
          {!isGuestMode && <Text style={styles.gameOverRank}>Rank: {rank}</Text>}
          
          {/* Guest Sign-In Prompt */}
          {isGuestMode && (
            <View style={styles.guestPromptContainer}>
              <Text style={styles.guestPromptText}>
                Sign in to save your score and track your rank!
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
            style={styles.restartButton}
            onPress={() => setReloadNonce((n) => n + 1)}
          >
            <Text style={styles.restartButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => onNavigate?.('main')}
          >
            <Text style={styles.backButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>

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

  return (
    <View style={styles.container}>
      {/* Guest Mode Banner */}
      {isGuestMode && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>Playing as Guest - Sign in to save progress</Text>
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
        <View style={styles.headerColRight}>
          {!isWrongQuestionsMode && !isGuestMode && (
            <Text style={styles.headerText}>Score: {sessionScore}</Text>
          )}
        </View>
      </View>

      {/* Game Area */}
      <ScrollView 
        style={styles.gameArea}
        contentContainerStyle={styles.gameAreaContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Text */}
        <View style={styles.statusContainer}>
          <Text style={[
            styles.statusText,
            isBuzzed && styles.statusTextBuzzed
          ]}>
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
            {!isBuzzed && !isAnswered && charIndexRef.current < fullTextRef.current.length && (
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
                  option.text === selectedAnswer && !option.isCorrect && styles.optionWrong,
                  !selectedAnswer && option.isCorrect && styles.optionCorrect // Highlight correct answer when time runs out
                ]}
              >
                <Text style={[
                  styles.optionText,
                  option.isCorrect && styles.optionTextCorrect,
                  option.text === selectedAnswer && !option.isCorrect && styles.optionTextWrong
                ]}>
                  {option.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {isAnswered && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={nextQuestion}
            >
              <Text style={styles.nextBtnText}>Next Question →</Text>
            </TouchableOpacity>

            {isPracticeMode && !isGuestMode && lastAnswerCorrect && (
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
            )}
          </View>
        )}
      </ScrollView>

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
  gameArea: {
    flex: 1,
  },
  gameAreaContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 18,
    paddingBottom: 24,
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
  questionBox: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
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
    fontSize: 16,
    lineHeight: 24,
    color: '#3a3a3a',
  },
  cursor: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#c9a961',
  },
  buzzerBtn: {
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
    fontSize: 14,
    textAlign: 'center',
    color: '#3a3a3a',
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
    marginTop: 8,
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
    letterSpacing: 0.3,
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
    marginBottom: 20,
    letterSpacing: 1,
    textAlign: 'center',
  },
  gameOverScore: {
    fontSize: 24,
    color: '#3a3a3a',
    marginBottom: 10,
  },
  gameOverRank: {
    fontSize: 20,
    color: '#c9a961',
    fontWeight: '600',
    marginBottom: 40,
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
    borderRadius: 8,
    minWidth: 200,
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
