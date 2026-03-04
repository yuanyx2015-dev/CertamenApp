import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { getRandomQuestions, Question } from '../services/questionService';

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
  const [rank, setRank] = useState('TIRO (Beginner)');
  
  const charIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullTextRef = useRef('');

  // Load questions from database
  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      setLoadError(null);
      
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
    
    loadQuestions();
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
  };

  // Handle answer selection
  const handleAnswerSelect = (option: {text: string; isCorrect: boolean}) => {
    if (isAnswered) return;

    setIsAnswered(true);
    setSelectedAnswer(option.text);

    // Show full text
    setDisplayedText(fullTextRef.current);

    if (option.isCorrect) {
      setScore(score + 10);
      setStatusText('Correct! +10 points');
      
      // Update rank based on score
      const newScore = score + 10;
      if (newScore >= 40) setRank('VETERAN (Advanced)');
      else if (newScore >= 20) setRank('MILES (Intermediate)');
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
    };
  }, [currentQuestionIndex, isLoading, questions]);

  // Check if game is over
  const isGameOver = questions.length > 0 && currentQuestionIndex >= questions.length;

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E1F2F" />
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
              setRank('TIRO (Beginner)');
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
        <Text style={[
          styles.statusText,
          isBuzzed && styles.statusTextBuzzed
        ]}>
          {statusText}
        </Text>

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
                  option.text === selectedAnswer && !option.isCorrect && styles.optionWrong
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
    backgroundColor: '#fdf6e3',
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
    color: '#8E1F2F',
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
    borderBottomColor: '#d4af37',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  gameArea: {
    flex: 1,
  },
  gameAreaContent: {
    padding: 20,
    alignItems: 'center',
    minHeight: 600,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
    minHeight: 25,
  },
  statusTextBuzzed: {
    color: '#8E1F2F',
    fontWeight: '600',
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
    color: '#2c3e50',
    fontWeight: '500',
  },
  cursor: {
    fontWeight: 'bold',
    fontSize: 24,
  },
  buzzerBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#8E1F2F',
    borderWidth: 6,
    borderColor: '#fff',
    shadowColor: '#8E1F2F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  buzzerText: {
    color: 'white',
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
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#2c3e50',
  },
  optionCorrect: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  optionWrong: {
    backgroundColor: '#f8d7da',
    borderColor: '#dc3545',
  },
  optionTextCorrect: {
    color: '#155724',
    fontWeight: '600',
  },
  optionTextWrong: {
    color: '#721c24',
    fontWeight: '600',
  },
  nextBtn: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#2c3e50',
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nextBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
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
    color: '#2c3e50',
    marginBottom: 20,
  },
  gameOverScore: {
    fontSize: 24,
    color: '#2c3e50',
    marginBottom: 10,
  },
  gameOverRank: {
    fontSize: 20,
    color: '#8E1F2F',
    fontWeight: '600',
    marginBottom: 40,
  },
  restartButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: '#8E1F2F',
    borderRadius: 8,
    marginBottom: 15,
    minWidth: 200,
    alignItems: 'center',
  },
  restartButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
