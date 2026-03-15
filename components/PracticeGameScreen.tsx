import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Animated } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { getRandomQuestions, Question } from '../services/questionService';
import { getCurrentUser } from '../services/authService';
import { getOrCreateUserStats, updateUserScore } from '../services/userStatsService';
import { getOrCreateUserSettings } from '../services/userSettingsService';
import { markQuestionAsWrong } from '../services/questionReviewService';

const { width, height } = Dimensions.get('window');

// Ornate Roman-style Checkmark
function RomanCheckmark() {
  return (
    <Svg width="250" height="250" viewBox="0 0 250 250">
      {/* Main checkmark stroke with Roman style */}
      <Path
        d="M 60 130 L 100 180 L 200 60"
        stroke="#7B8866"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Inner highlight for depth */}
      <Path
        d="M 65 130 L 100 175 L 195 65"
        stroke="#98A885"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
    </Svg>
  );
}

// Ornate Roman-style X
function RomanCross() {
  return (
    <Svg width="250" height="250" viewBox="0 0 250 250">
      {/* Main X strokes with Roman style */}
      <Path
        d="M 50 50 L 200 200"
        stroke="#8B4C4C"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 200 50 L 50 200"
        stroke="#8B4C4C"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Inner highlight for depth */}
      <Path
        d="M 55 55 L 195 195"
        stroke="#A86464"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <Path
        d="M 195 55 L 55 195"
        stroke="#A86464"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </Svg>
  );
}

interface PracticeGameScreenProps {
  onNavigate?: (screen: string) => void;
  previousScreen?: string;
}

export function PracticeGameScreen({ onNavigate, previousScreen }: PracticeGameScreenProps) {
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
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [showFeedbackIcon, setShowFeedbackIcon] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  
  const charIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullTextRef = useRef('');
  const feedbackScaleAnim = useRef(new Animated.Value(0)).current;
  const feedbackOpacityAnim = useRef(new Animated.Value(0)).current;

  // Load questions from database
  useEffect(() => {
    const loadQuestionsAndStats = async () => {
      setIsLoading(true);
      setLoadError(null);
      
      // Load user stats and settings first
      let currentRank = 'Miles';
      let totalQuestions = 20; // Default
      const user = await getCurrentUser();
      if (user) {
        const { data: stats } = await getOrCreateUserStats(user.id);
        if (stats) {
          setCumulativeScore(stats.score); // Store cumulative score
          setRank(stats.rank);
          currentRank = stats.rank;
        }
        
        // Get user settings for number of tossups
        const { data: settings } = await getOrCreateUserSettings(user.id);
        if (settings) {
          totalQuestions = settings.num_tossups;
        }
      }
      
      // Get question distribution based on rank
      const distribution = getQuestionDistribution(currentRank, totalQuestions);
      
      // Fetch questions for each difficulty level
      // Note: Each difficulty query returns unique questions, and since each question
      // has only one difficulty level, there won't be duplicates across queries.
      const allQuestions: Question[] = [];
      const seenIds = new Set<string>(); // Extra safeguard to prevent duplicates
      
      try {
        // Fetch easy questions
        if (distribution.easy > 0) {
          const { data: easyQuestions, error: easyError } = await getRandomQuestions(
            undefined, 
            'easy', 
            distribution.easy
          );
          if (easyError) throw easyError;
          if (easyQuestions) {
            // Filter out any duplicates (defensive programming)
            easyQuestions.forEach(q => {
              if (!seenIds.has(q.id)) {
                allQuestions.push(q);
                seenIds.add(q.id);
              }
            });
          }
        }
        
        // Fetch medium questions
        if (distribution.medium > 0) {
          const { data: mediumQuestions, error: mediumError } = await getRandomQuestions(
            undefined, 
            'medium', 
            distribution.medium
          );
          if (mediumError) throw mediumError;
          if (mediumQuestions) {
            mediumQuestions.forEach(q => {
              if (!seenIds.has(q.id)) {
                allQuestions.push(q);
                seenIds.add(q.id);
              }
            });
          }
        }
        
        // Fetch hard questions
        if (distribution.hard > 0) {
          const { data: hardQuestions, error: hardError } = await getRandomQuestions(
            undefined, 
            'hard', 
            distribution.hard
          );
          if (hardError) throw hardError;
          if (hardQuestions) {
            hardQuestions.forEach(q => {
              if (!seenIds.has(q.id)) {
                allQuestions.push(q);
                seenIds.add(q.id);
              }
            });
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
  }, []);

  // Shuffle function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

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

  // Start question
  const startQuestion = () => {
    if (currentQuestionIndex >= questions.length) {
      // Game over
      setStatusText('Practice Complete!');
      return;
    }

    // Reset state
    setIsBuzzed(false);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setDisplayedText('');
    charIndexRef.current = 0;
    setStatusText('Reading question...');

    const currentQuestion = questions[currentQuestionIndex];
    fullTextRef.current = currentQuestion.question_text;

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
      }
    }, 50); // 50ms per character
  };

  // Handle buzz
  const handleBuzz = () => {
    if (isBuzzed || isAnswered) return;

    // Stop streaming immediately
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    setIsBuzzed(true);
    setStatusText('Buzzed! Select your answer...');
    setTimeRemaining(15);

    // Start 15-second countdown timer
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

  // Handle time running out
  const handleTimeUp = () => {
    if (isAnswered) return;

    setIsAnswered(true);
    setSelectedAnswer(null); // No answer was selected
    setDisplayedText(fullTextRef.current);
    setStatusText("Time's up! No answer selected.");
  };

  // Trigger feedback animation
  const triggerFeedbackAnimation = (isCorrect: boolean) => {
    setIsCorrectAnswer(isCorrect);
    setShowFeedbackIcon(true);
    
    // Reset animation values
    feedbackScaleAnim.setValue(0);
    feedbackOpacityAnim.setValue(0);
    
    // Animate in and out
    Animated.sequence([
      Animated.parallel([
        Animated.spring(feedbackScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(800), // Show for 800ms
      Animated.timing(feedbackOpacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFeedbackIcon(false);
    });
  };

  // Handle answer selection
  const handleAnswerSelect = async (option: {text: string; isCorrect: boolean}) => {
    if (isAnswered) return;

    // Stop the timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    setIsAnswered(true);
    setSelectedAnswer(option.text);

    // Show full text
    setDisplayedText(fullTextRef.current);

    // Trigger feedback animation
    triggerFeedbackAnimation(option.isCorrect);

    if (option.isCorrect) {
      const newSessionScore = sessionScore + 10;
      setSessionScore(newSessionScore);
      setStatusText('Correct! +10 points');
      
      // Update cumulative score in database
      const user = await getCurrentUser();
      if (user) {
        const newCumulativeScore = cumulativeScore + 10;
        const newRank = calculateRank(newCumulativeScore);
        const { error } = await updateUserScore(user.id, newCumulativeScore, newRank);
        if (!error) {
          setCumulativeScore(newCumulativeScore);
          setRank(newRank);
        }
      }
    } else {
      setStatusText('Wrong! Better luck next time.');
      
      // Track wrong answer in database
      const user = await getCurrentUser();
      if (user && questions[currentQuestionIndex]) {
        await markQuestionAsWrong(user.id, questions[currentQuestionIndex].id);
      }
    }
  };

  // Next question
  const nextQuestion = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
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
      
      // Reset game state for fresh start on next entry
      // This ensures a new game starts when user returns
    };
  }, [currentQuestionIndex, isLoading, questions]);

  // Additional cleanup on unmount to ensure fresh game on return
  useEffect(() => {
    return () => {
      // This cleanup runs when user exits the practice game screen
      // All state will be reset on next mount, ensuring a new game starts
      console.log('Practice game ended - will start fresh on next entry');
    };
  }, []);

  // Check if game is over
  const isGameOver = questions.length > 0 && currentQuestionIndex >= questions.length;

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
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
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
          <Text style={styles.gameOverScore}>Final Score: {sessionScore} / {questions.length * 10}</Text>
          <Text style={styles.gameOverRank}>Rank: {rank}</Text>
          
          <TouchableOpacity 
            style={styles.restartButton}
            onPress={async () => {
              // Reset game state
              setCurrentQuestionIndex(0);
              setSessionScore(0); // Reset session score
              setQuestions([]);
              setIsLoading(true);
              
              // Reload questions and stats for a fresh game
              const user = await getCurrentUser();
              let currentRank = 'Miles';
              let totalQuestions = 20; // Default
              
              if (user) {
                const { data: stats } = await getOrCreateUserStats(user.id);
                if (stats) {
                  setCumulativeScore(stats.score);
                  setRank(stats.rank);
                  currentRank = stats.rank;
                }
                
                // Get user settings for number of tossups
                const { data: settings } = await getOrCreateUserSettings(user.id);
                if (settings) {
                  totalQuestions = settings.num_tossups;
                }
              }
              
              // Get new questions based on current rank and settings
              const distribution = getQuestionDistribution(currentRank, totalQuestions);
              const allQuestions: Question[] = [];
              const seenIds = new Set<string>(); // Prevent duplicates within this game
              
              try {
                if (distribution.easy > 0) {
                  const { data: easyQuestions } = await getRandomQuestions(undefined, 'easy', distribution.easy);
                  if (easyQuestions) {
                    easyQuestions.forEach(q => {
                      if (!seenIds.has(q.id)) {
                        allQuestions.push(q);
                        seenIds.add(q.id);
                      }
                    });
                  }
                }
                if (distribution.medium > 0) {
                  const { data: mediumQuestions } = await getRandomQuestions(undefined, 'medium', distribution.medium);
                  if (mediumQuestions) {
                    mediumQuestions.forEach(q => {
                      if (!seenIds.has(q.id)) {
                        allQuestions.push(q);
                        seenIds.add(q.id);
                      }
                    });
                  }
                }
                if (distribution.hard > 0) {
                  const { data: hardQuestions } = await getRandomQuestions(undefined, 'hard', distribution.hard);
                  if (hardQuestions) {
                    hardQuestions.forEach(q => {
                      if (!seenIds.has(q.id)) {
                        allQuestions.push(q);
                        seenIds.add(q.id);
                      }
                    });
                  }
                }
                
                if (allQuestions.length > 0) {
                  setQuestions(shuffleArray(allQuestions));
                }
              } catch (error) {
                console.error('Error reloading questions:', error);
              }
              
              setIsLoading(false);
              setStatusText('Ready...');
            }}
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Question {currentQuestionIndex + 1}/{questions.length}</Text>
        <Text style={styles.headerText}>Score: {sessionScore}</Text>
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
          {isBuzzed && !isAnswered && (
            <Text style={styles.timerText}>Time: {timeRemaining}s</Text>
          )}
        </View>

        {/* Question Box */}
        <View style={styles.questionBox}>
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

        {/* Next Button */}
        {isAnswered && (
          <TouchableOpacity 
            style={styles.nextBtn}
            onPress={nextQuestion}
          >
            <Text style={styles.nextBtnText}>Next Question →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Feedback Icon Overlay */}
      {showFeedbackIcon && (
        <Animated.View 
          style={[
            styles.feedbackOverlay,
            {
              opacity: feedbackOpacityAnim,
              transform: [{ scale: feedbackScaleAnim }],
            },
          ]}
          pointerEvents="none"
        >
          {isCorrectAnswer ? (
            // Ornate Roman Green Checkmark
            <View style={styles.checkmark}>
              <RomanCheckmark />
            </View>
          ) : (
            // Ornate Roman Red X
            <View style={styles.cross}>
              <RomanCross />
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5efe3',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#c9a961',
    marginBottom: 15,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Changed from 'space-between' for more spacing
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#c9a961',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 30, // Add explicit gap between items
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3a3a3a',
  },
  gameArea: {
    flex: 1,
  },
  gameAreaContent: {
    padding: 20,
    alignItems: 'center',
    minHeight: 600,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 15,
    minHeight: 50,
  },
  statusText: {
    fontSize: 16,
    color: '#7a7a7a',
    fontStyle: 'italic',
    minHeight: 25,
  },
  statusTextBuzzed: {
    color: '#c9a961',
    fontWeight: '600',
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c9a961',
    marginTop: 5,
  },
  questionBox: {
    width: '100%',
    maxWidth: 600,
    minHeight: 150,
    marginBottom: 30,
  },
  questionText: {
    fontSize: 20,
    lineHeight: 32,
    color: '#3a3a3a',
    fontWeight: '500',
  },
  cursor: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#c9a961',
  },
  buzzerBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 4,
    borderColor: '#c9a961',
    shadowColor: '#c9a961',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  buzzerText: {
    color: '#c9a961',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    gap: 15,
  },
  optionCard: {
    width: width > 600 ? 285 : (width - 55) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    padding: 20,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#3a3a3a',
  },
  optionCorrect: {
    backgroundColor: 'rgba(201, 169, 97, 0.2)',
    borderColor: '#c9a961',
    borderWidth: 3,
  },
  optionWrong: {
    backgroundColor: 'rgba(157, 133, 107, 0.15)',
    borderColor: '#9d856b',
    borderWidth: 3,
  },
  optionTextCorrect: {
    color: '#8b7355',
    fontWeight: '600',
  },
  optionTextWrong: {
    color: '#6a5a4a',
    fontWeight: '600',
  },
  nextBtn: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nextBtnText: {
    color: '#3a3a3a',
    fontSize: 18,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  checkmark: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B8866',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cross: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B4C4C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
