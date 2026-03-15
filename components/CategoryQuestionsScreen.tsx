import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TextInput,
  Alert
} from 'react-native';
import { getCurrentUser } from '../services/authService';
import { 
  getWrongQuestionsByCategory,
  markQuestionAsCorrect,
  QuestionWithStats 
} from '../services/questionReviewService';

interface CategoryQuestionsScreenProps {
  onNavigate?: (screen: string) => void;
  category: string;
}

export function CategoryQuestionsScreen({ onNavigate, category }: CategoryQuestionsScreenProps) {
  const [wrongQuestions, setWrongQuestions] = useState<QuestionWithStats[]>([]);
  const [displayedQuestions, setDisplayedQuestions] = useState<QuestionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    loadQuestions();
  }, [category]);

  useEffect(() => {
    filterQuestions();
  }, [searchText, wrongQuestions]);

  const loadQuestions = async () => {
    setIsLoading(true);
    
    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      
      // Load wrong questions
      const { data: wrong } = await getWrongQuestionsByCategory(user.id, category, 200);
      if (wrong) {
        setWrongQuestions(wrong);
      }
    }
    
    setIsLoading(false);
  };

  const filterQuestions = () => {
    let questions = wrongQuestions;
    
    if (searchText.trim()) {
      questions = questions.filter(q => 
        q.question_text.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    setDisplayedQuestions(questions);
  };

  const handleMarkCorrect = async (questionId: string) => {
    if (!userId) return;

    const { error } = await markQuestionAsCorrect(userId, questionId);
    
    if (error) {
      Alert.alert('Error', 'Failed to remove question from review list');
      return;
    }

    // Reload questions
    await loadQuestions();
  };

  const categoryNames: Record<string, string> = {
    mythology: 'Mythology',
    history: 'History',
    language: 'Language',
    literature: 'Literature',
    life: 'Daily Life',
    general: 'General'
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c9a961" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>{categoryNames[category]} Review</Text>
      <Text style={styles.subtitle}>{wrongQuestions.length} question{wrongQuestions.length !== 1 ? 's' : ''} to review</Text>

      {/* Search Bar */}
      {wrongQuestions.length > 0 && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      )}

      {/* Questions List */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {displayedQuestions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchText ? 'No questions match your search' : 
               wrongQuestions.length === 0 ? 'No questions to review yet!\nKeep practicing to see questions here.' :
               'No questions found'}
            </Text>
          </View>
        ) : (
          displayedQuestions.map((question) => (
            <View key={question.id} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Text style={styles.difficultyBadge}>
                  {question.difficulty}
                </Text>
                {question.times_wrong && question.times_wrong > 1 && (
                  <Text style={styles.timesWrongBadge}>
                    Wrong {question.times_wrong}x
                  </Text>
                )}
              </View>
              
              <Text style={styles.questionText}>
                {question.question_text}
              </Text>
              
              <View style={styles.answerRow}>
                <Text style={styles.answerLabel}>Answer:</Text>
                <Text style={styles.answerText}>{question.correct_answer}</Text>
              </View>

              <TouchableOpacity
                style={styles.markCorrectButton}
                onPress={() => handleMarkCorrect(question.id)}
              >
                <Text style={styles.markCorrectButtonText}>
                  ✓ Mark as Mastered
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    color: '#3a3a3a',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6a6a6a',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    fontSize: 16,
    color: '#3a3a3a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  questionCard: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  difficultyBadge: {
    fontSize: 12,
    color: '#c9a961',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '500',
  },
  timesWrongBadge: {
    fontSize: 12,
    color: '#d98080',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  questionText: {
    fontSize: 16,
    color: '#3a3a3a',
    lineHeight: 24,
    marginBottom: 12,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  answerLabel: {
    fontSize: 14,
    color: '#6a6a6a',
    fontWeight: '500',
  },
  answerText: {
    fontSize: 14,
    color: '#c9a961',
    fontWeight: '500',
  },
  markCorrectButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(100, 180, 100, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100, 180, 100, 0.4)',
    borderRadius: 8,
    alignItems: 'center',
  },
  markCorrectButtonText: {
    fontSize: 14,
    color: '#4a7a4a',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
});
