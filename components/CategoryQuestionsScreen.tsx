import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from '../lib/AppText';
import { FitScrollView } from './FitScrollView';
import { getCurrentUser } from '../services/authService';
import { 
  getWrongQuestionsByCategory,
  QuestionWithStats 
} from '../services/questionReviewService';
import { masterQuestion } from '../services/userMasteredService';
import {
  AI_TUTOR_DAILY_LIMIT,
  AI_TUTOR_MAX_QUESTION_CHARS,
  buildContextualTutorPrompt,
  maxFollowUpCharsForContext,
} from '../constants/aiTutor';
import { getQuestionExplanation } from '../services/aiExplanationService';
import { askAITutor, getAITutorUsage } from '../services/aiTutorService';
import { useIPadScaledStyles } from '../lib/layout';

interface CategoryQuestionsScreenProps {
  onNavigate?: (screen: string) => void;
  category: string;
}

/** Neutral “[?]” mark — avoid Gemini/third-party brand marks in the button. */
function ExplainAiIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15">
      <Rect
        x={1.25}
        y={1.25}
        width={12.5}
        height={12.5}
        rx={2.5}
        stroke="#8a7040"
        strokeWidth={1.4}
        fill="none"
      />
      <Path
        d="M5.4 5.6 C5.4 4.35 6.35 3.55 7.5 3.55 C8.65 3.55 9.6 4.35 9.6 5.45 C9.6 6.35 9.05 6.85 8.35 7.3 C7.7 7.7 7.35 8.05 7.35 8.75"
        stroke="#8a7040"
        strokeWidth={1.35}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M7.35 11.15 V11.2"
        stroke="#8a7040"
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Crisp check — SVG so Spectral doesn’t offset a text “✓”. */
function MasteredCheckIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15">
      <Path
        d="M2.8 7.6 L6.1 10.8 L12.2 3.9"
        stroke="#4a7a4a"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CategoryQuestionsScreen({ onNavigate, category }: CategoryQuestionsScreenProps) {
  const styles = useIPadScaledStyles(baseStyles);
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

  /** Mirrors expandedQuestionId so async AI handlers can detect a question switch. */
  const expandedQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    expandedQuestionIdRef.current = expandedQuestionId;
  }, [expandedQuestionId]);

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

  const handleMarkMastered = async (questionId: string) => {
    if (!userId) return;

    // Atomic master_question RPC: removes from user_wrong_answers AND inserts
    // into user_mastered_answers, so Profile / Challenge progress all update.
    const { error } = await masterQuestion(userId, questionId);

    if (error) {
      Alert.alert('Error', 'Failed to master this question. Please try again.');
      return;
    }

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

    // The user expanded a different question (or collapsed) while this was in
    // flight — discard this stale response so it can't show under the wrong card.
    if (expandedQuestionIdRef.current !== questionId) return;

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

    setCustomAnswer(null);
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

  const categoryLabel = categoryNames[category] ?? category;
  const wrongCount = wrongQuestions.length;
  const wrongCountLabel =
    wrongCount === 1
      ? 'You have 1 wrong question'
      : `You have ${wrongCount} wrong questions`;

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
      <View style={styles.headerSection} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.topBackButton}
          onPress={() => onNavigate?.('reviewCategories')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.topBackButtonText}>‹ All categories</Text>
        </TouchableOpacity>
        <View style={styles.headerBlock} pointerEvents="none">
          <Text style={styles.title}>{categoryLabel}</Text>
          <Text style={styles.subtitle}>{wrongCountLabel}</Text>
        </View>
      </View>

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
      <FitScrollView 
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
                      <View
                        style={styles.explanationScroll}
                        onStartShouldSetResponder={() => true}
                      >
                        <ScrollView
                          style={styles.explanationScrollInner}
                          contentContainerStyle={styles.explanationScrollContent}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                          persistentScrollbar
                          scrollEventThrottle={16}
                        >
                          <Text style={styles.explanationText}>{aiExplanation}</Text>
                        </ScrollView>
                      </View>
                      
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
                            {isLoadingCustom ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.askButtonText}>Ask</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        
                        {isLoadingCustom && (
                          <View style={styles.customAnswerLoading}>
                            <ActivityIndicator size="small" color="#c9a961" />
                            <Text style={styles.customAnswerLoadingText}>
                              AI tutor is thinking…
                            </Text>
                          </View>
                        )}
                        {!isLoadingCustom && customAnswer && (
                          <View style={styles.customAnswerBox}>
                            <View
                              style={styles.customAnswerScroll}
                              onStartShouldSetResponder={() => true}
                            >
                              <ScrollView
                                style={styles.customAnswerScrollInner}
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                                persistentScrollbar
                                scrollEventThrottle={16}
                              >
                                <Text style={styles.customAnswerText}>{customAnswer}</Text>
                              </ScrollView>
                            </View>
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
                  {expandedQuestionId === question.id ? (
                    <Text style={styles.explainButtonText}>✕ Hide</Text>
                  ) : (
                    <View style={styles.buttonInner}>
                      <ExplainAiIcon />
                      <Text style={styles.explainButtonText}>Explain with AI</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.markCorrectButton}
                  onPress={() => handleMarkMastered(question.id)}
                >
                  <View style={styles.buttonInner}>
                    <MasteredCheckIcon />
                    <Text style={styles.markCorrectButtonText}>Mark as Mastered</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            );
          })
        )}
      </FitScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 0,
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
  topBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 2,
    marginBottom: 2,
    zIndex: 2,
  },
  topBackButtonText: {
    fontSize: 15,
    color: '#8a6a3a',
    letterSpacing: 0.1,
    fontWeight: '500',
  },
  headerSection: {
    zIndex: 2,
  },
  headerBlock: {
    paddingTop: 0,
    paddingBottom: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    color: '#3a3a3a',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6a6a6a',
    letterSpacing: 0.15,
    textAlign: 'center',
    marginBottom: 0,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fdfcf9',
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
    padding: 12,
    backgroundColor: '#fcfaf7',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    marginBottom: 8,
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
    letterSpacing: 0.8,
    fontWeight: '500',
  },
  questionText: {
    fontSize: 17,
    color: '#3a3a3a',
    lineHeight: 26,
    marginBottom: 12,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  answerLabel: {
    fontSize: 15,
    color: '#6a6a6a',
    fontWeight: '500',
  },
  answerText: {
    fontSize: 15,
    color: '#c9a961',
    fontWeight: '500',
  },
  explanationContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f1e8d6',
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
  explanationScroll: {
    maxHeight: 140,
    marginBottom: 10,
  },
  explanationScrollInner: {
    maxHeight: 140,
  },
  explanationScrollContent: {
    paddingRight: 8,
  },
  explanationText: {
    fontSize: 15,
    color: '#3a3a3a',
    lineHeight: 23,
  },
  customQuestionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.3)',
  },
  customQuestionLabel: {
    fontSize: 13,
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
    minWidth: 64,
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
    gap: 10,
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a961',
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
  customAnswerScroll: {
    maxHeight: 180,
  },
  customAnswerScrollInner: {
    maxHeight: 180,
  },
  customAnswerText: {
    fontSize: 15,
    color: '#3a3a3a',
    lineHeight: 23,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  explainButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eee3cc',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.4)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  explainButtonText: {
    fontSize: 15,
    color: '#8a7040',
    letterSpacing: 0.15,
    fontWeight: '500',
    flexShrink: 1,
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
    justifyContent: 'center',
  },
  markCorrectButtonText: {
    fontSize: 15,
    color: '#4a7a4a',
    letterSpacing: 0.15,
    fontWeight: '500',
    flexShrink: 1,
  },
});
