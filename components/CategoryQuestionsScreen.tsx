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
import {
  AI_TUTOR_DAILY_LIMIT,
  AI_TUTOR_MAX_QUESTION_CHARS,
  buildContextualTutorPrompt,
  maxFollowUpCharsForContext,
} from '../constants/aiTutor';
import { getQuestionExplanation } from '../services/aiExplanationService';
import { askAITutor, getAITutorUsage } from '../services/aiTutorService';

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
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customAnswer, setCustomAnswer] = useState<string | null>(null);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [remainingQuestions, setRemainingQuestions] = useState(AI_TUTOR_DAILY_LIMIT);

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

      // Load remaining custom questions
      const { data: usage } = await getAITutorUsage(user.id);
      if (usage) {
        setRemainingQuestions(usage.remaining_questions);
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

  const handleExplainQuestion = async (questionText: string, correctAnswer: string, questionId: string) => {
    // Toggle off if already expanded
    if (expandedQuestionId === questionId) {
      setExpandedQuestionId(null);
      setAiExplanation(null);
      setCustomQuestion('');
      setCustomAnswer(null);
      return;
    }

    setExpandedQuestionId(questionId);
    setIsLoadingExplanation(true);
    setAiExplanation(null);
    setCustomQuestion('');
    setCustomAnswer(null);

    const { data, error } = await getQuestionExplanation(
      questionText,
      correctAnswer,
      questionId
    );

    setIsLoadingExplanation(false);

    if (error || !data) {
      Alert.alert('Error', 'Failed to get AI explanation. Please try again.');
      setExpandedQuestionId(null);
      return;
    }

    setAiExplanation(data.explanation);
  };

  const handleAskCustomQuestion = async (questionText: string, correctAnswer: string) => {
    if (!customQuestion.trim() || !userId) return;

    if (remainingQuestions <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        'You have used your 2 custom questions for today. Come back tomorrow!'
      );
      return;
    }

    const maxFollow = maxFollowUpCharsForContext(questionText, correctAnswer);
    const trimmed = customQuestion.trim();
    if (trimmed.length > maxFollow) {
      Alert.alert(
        'Follow-up too long',
        maxFollow === 0
          ? 'This review item is too long to add an AI follow-up (500 character server limit).'
          : `Shorten your note to ${maxFollow} characters for this question.`
      );
      return;
    }

    setIsLoadingCustom(true);

    const contextualQuestion = buildContextualTutorPrompt(
      questionText,
      correctAnswer,
      trimmed
    );

    if (contextualQuestion.length > AI_TUTOR_MAX_QUESTION_CHARS) {
      Alert.alert(
        'Follow-up too long',
        `The combined text must stay under ${AI_TUTOR_MAX_QUESTION_CHARS} characters.`
      );
      setIsLoadingCustom(false);
      return;
    }

    const { data, error } = await askAITutor(userId, contextualQuestion);

    setIsLoadingCustom(false);

    if (error || !data) {
      const msg =
        typeof error === 'string'
          ? error
          : 'Failed to get answer from AI. Please try again.';
      Alert.alert('Error', msg);
      return;
    }

    if (data.limitReached) {
      Alert.alert('Daily Limit Reached', data.message || 'You have reached your daily limit.');
      setRemainingQuestions(0);
      return;
    }

    setCustomAnswer(data.answer);
    setRemainingQuestions(data.remainingQuestions);
    setCustomQuestion('');
  };

  const categoryNames: Record<string, string> = {
    mythology: 'Mythology',
    history: 'History',
    language: 'Language',
    literature: 'Literature',
    'culture-life': 'Culture & Life',
    'living-latin': 'Living Latin',
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
      <Text style={styles.title}>{categoryNames[category] ?? category} Review</Text>
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
          displayedQuestions.map((question) => {
            const followUpMax = maxFollowUpCharsForContext(
              question.question_text,
              question.correct_answer
            );
            return (
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

              {/* AI Explanation Section */}
              {expandedQuestionId === question.id && (
                <View style={styles.explanationContainer}>
                  {isLoadingExplanation ? (
                    <View style={styles.explanationLoading}>
                      <ActivityIndicator size="small" color="#c9a961" />
                      <Text style={styles.explanationLoadingText}>Getting AI explanation...</Text>
                    </View>
                  ) : aiExplanation ? (
                    <>
                      <Text style={styles.explanationText}>{aiExplanation}</Text>
                      
                      {/* Custom Question Input */}
                      <View style={styles.customQuestionContainer}>
                        <Text style={styles.customQuestionLabel}>
                          {remainingQuestions > 0
                            ? `Have a follow-up question? You have ${remainingQuestions} remaining question${
                                remainingQuestions !== 1 ? 's' : ''
                              } today`
                            : 'No remaining questions for today, try again in a day!'}
                          {followUpMax > 0
                            ? ` · up to ${followUpMax} chars`
                            : ' · follow-up unavailable (question too long)'}
                        </Text>
                        <View style={styles.customQuestionRow}>
                          <TextInput
                            style={styles.customQuestionInput}
                            placeholder="Ask about this question..."
                            placeholderTextColor="#999"
                            value={customQuestion}
                            onChangeText={setCustomQuestion}
                            maxLength={followUpMax > 0 ? followUpMax : 1}
                            editable={
                              !isLoadingCustom &&
                              remainingQuestions > 0 &&
                              followUpMax > 0
                            }
                          />
                          <TouchableOpacity
                            style={[
                              styles.askButton,
                              (!customQuestion.trim() ||
                                isLoadingCustom ||
                                remainingQuestions <= 0 ||
                                followUpMax <= 0) &&
                                styles.askButtonDisabled,
                            ]}
                            onPress={() => handleAskCustomQuestion(question.question_text, question.correct_answer)}
                            disabled={
                              !customQuestion.trim() ||
                              isLoadingCustom ||
                              remainingQuestions <= 0 ||
                              followUpMax <= 0
                            }
                          >
                            <Text style={styles.askButtonText}>Ask</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Custom Answer */}
                        {isLoadingCustom && (
                          <View style={styles.customAnswerLoading}>
                            <ActivityIndicator size="small" color="#c9a961" />
                            <Text style={styles.customAnswerLoadingText}>Getting answer...</Text>
                          </View>
                        )}
                        {customAnswer && (
                          <View style={styles.customAnswerBox}>
                            <Text style={styles.customAnswerText}>{customAnswer}</Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : null}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.explainButton}
                  onPress={() => handleExplainQuestion(question.question_text, question.correct_answer, question.id)}
                >
                  <Text style={styles.explainButtonText}>
                    {expandedQuestionId === question.id ? '✕ Hide' : '🤖 Explain with AI'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.markCorrectButton}
                  onPress={() => handleMarkCorrect(question.id)}
                >
                  <Text style={styles.markCorrectButtonText}>
                    ✓ Mark as Mastered
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          })
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
  explanationContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#c9a961',
    borderRadius: 6,
  },
  explanationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explanationLoadingText: {
    fontSize: 14,
    color: '#6a6a6a',
    fontStyle: 'italic',
  },
  explanationText: {
    fontSize: 14,
    color: '#3a3a3a',
    lineHeight: 20,
    marginBottom: 12,
  },
  customQuestionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.3)',
  },
  customQuestionLabel: {
    fontSize: 12,
    color: '#6a6a6a',
    marginBottom: 8,
    fontWeight: '500',
  },
  customQuestionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customQuestionInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    fontSize: 14,
    color: '#3a3a3a',
  },
  askButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#c9a961',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  askButtonDisabled: {
    backgroundColor: '#ccc',
  },
  askButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  customAnswerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  customAnswerLoadingText: {
    fontSize: 14,
    color: '#6a6a6a',
    fontStyle: 'italic',
  },
  customAnswerBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#fff',
    borderLeftWidth: 3,
    borderLeftColor: '#c9a961',
    borderRadius: 6,
  },
  customAnswerText: {
    fontSize: 14,
    color: '#3a3a3a',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  explainButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(201, 169, 97, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.4)',
    borderRadius: 8,
    alignItems: 'center',
  },
  explainButtonText: {
    fontSize: 14,
    color: '#8a7040',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  markCorrectButton: {
    flex: 1,
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
