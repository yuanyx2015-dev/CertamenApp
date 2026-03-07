import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { getRandomQuestions, Question } from '../services/questionService';
import { getCurrentUser } from '../services/authService';
import { getOrCreateUserStats, updateUserScore } from '../services/userStatsService';

const { width } = Dimensions.get('window');

interface PracticeGameScreenProps {
  onNavigate?: (screen: string) => void;
  previousScreen?: string;
}

export function PracticeGameScreen({ onNavigate, previousScreen }: PracticeGameScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<Array<{text: string; isCorrect: boolean}>>([]);
  const [statusText, setStatusText] = useState('Loading questions...');
  const [rank, setRank] = useState('Miles');
  const [timeRemaining, setTimeRemaining] = useState(15);
  
  const charIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullTextRef = useRef('');

  // Load questions from database
  useEffect(() => {
    const loadQuestionsAndStats = async () => {
      setIsLoading(true);
      setLoadError(null);
      
      // Load user stats first
      const user = await getCurrentUser();
      if (user) {
        const { data: stats } = await getOrCreateUserStats(user.id);
        if (stats) {
          setScore(stats.score);
          setRank(stats.rank);
        }
      }
      
      // Get 10 random questions from database (any category, any difficulty)
      const { data, error } = await getRandomQuestions(undefined, undefined, 10);
      
      if (error) {
        console.error('Error loading questions:', error);
        setLoadError('Failed to load questions from database');
        setIsLoading(false);
        return;
      }
      
      if (!data || data.length === 0) {
        setLoadError('No questions found in database');
        setIsLoading(false);
        return;
      }
      
      setQuestions(data);
      setIsLoading(false);
      setStatusText('Ready...');
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

    if (option.isCorrect) {
      const newScore = score + 10;
      setScore(newScore);
      setStatusText('Correct! +10 points');
      
      // Update rank based on new score
      const newRank = calculateRank(newScore);
      setRank(newRank);

      // Save to database
      const user = await getCurrentUser();
      if (user) {
        await updateUserScore(user.id, newScore, newRank);
      }
    } else {
      setStatusText('Wrong! Better luck next time.');
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
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentQuestionIndex, isLoading, questions]);

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
          <Text style={styles.gameOverScore}>Final Score: {score} / {questions.length * 10}</Text>
          <Text style={styles.gameOverRank}>Rank: {rank}</Text>
          
          <TouchableOpacity 
            style={styles.restartButton}
            onPress={() => {
              setCurrentQuestionIndex(0);
              setScore(0);
              setRank('Miles');
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
        <Text style={styles.headerText}>Rank: {rank}</Text>
        <Text style={styles.headerText}>Score: {score}</Text>
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
    justifyContent: 'space-between',
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
    justifyContent: 'space-between',
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
});
