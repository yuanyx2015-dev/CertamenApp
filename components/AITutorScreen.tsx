import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { AI_TUTOR_DAILY_LIMIT } from '../constants/aiTutor';
import { getCurrentUser } from '../services/authService';
import { askAITutor, getAITutorUsage } from '../services/aiTutorService';

interface Message {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface AITutorScreenProps {
  onNavigate?: (screen: string) => void;
}

export function AITutorScreen({ onNavigate }: AITutorScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remainingQuestions, setRemainingQuestions] = useState(AI_TUTOR_DAILY_LIMIT);
  const [userId, setUserId] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadUsageInfo();
  }, []);

  const loadUsageInfo = async () => {
    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      
      const { data } = await getAITutorUsage(user.id);
      if (data) {
        setRemainingQuestions(data.remaining_questions);
      }
    }
  };

  const handleSendQuestion = async () => {
    if (!inputText.trim() || isLoading || !userId) return;

    if (remainingQuestions <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        `You have used all ${AI_TUTOR_DAILY_LIMIT} custom questions for today. Come back tomorrow for more!`
      );
      return;
    }

    const question = inputText.trim();
    
    // Validate length
    if (question.length > 500) {
      Alert.alert('Question Too Long', 'Please keep your question under 500 characters.');
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Call AI
    const { data, error } = await askAITutor(userId, question);

    setIsLoading(false);

    if (error || !data) {
      const msg =
        typeof error === 'string'
          ? error
          : 'Failed to get answer from AI tutor. Please try again.';
      Alert.alert('Error', msg);
      return;
    }

    if (data.limitReached) {
      Alert.alert('Daily Limit Reached', data.message || 'You have reached your daily limit.');
      setRemainingQuestions(0);
      return;
    }

    // Add AI response
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      text: data.answer,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMessage]);
    setRemainingQuestions(data.remainingQuestions);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI Tutor</Text>
        <Text style={styles.subtitle}>
          Ask me anything about Certamen!
        </Text>
        <View style={styles.limitBadge}>
          <Text style={styles.limitText}>
            {remainingQuestions} question{remainingQuestions !== 1 ? 's' : ''} remaining today
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>👋 Welcome!</Text>
            <Text style={styles.emptyText}>
              I'm your AI Certamen tutor. Ask me about:
            </Text>
            <Text style={styles.exampleText}>• Roman & Greek mythology</Text>
            <Text style={styles.exampleText}>• Ancient Roman history</Text>
            <Text style={styles.exampleText}>• Latin language & grammar</Text>
            <Text style={styles.exampleText}>• Roman literature</Text>
            <Text style={styles.exampleText}>• Daily life in Rome</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.type === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.type === 'user' ? styles.userText : styles.aiText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))
        )}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#c9a961" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask your question..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!isLoading && remainingQuestions > 0}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isLoading || remainingQuestions <= 0) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendQuestion}
          disabled={!inputText.trim() || isLoading || remainingQuestions <= 0}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {remainingQuestions <= 0 && (
        <View style={styles.limitReachedBanner}>
          <Text style={styles.limitReachedText}>
            Daily limit reached. Come back tomorrow!
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 169, 97, 0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3a3a3a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6a6a6a',
    textAlign: 'center',
    marginTop: 4,
  },
  limitBadge: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(201, 169, 97, 0.15)',
    borderRadius: 12,
  },
  limitText: {
    fontSize: 12,
    color: '#8a7040',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 32,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6a6a6a',
    marginBottom: 16,
    textAlign: 'center',
  },
  exampleText: {
    fontSize: 14,
    color: '#8a8a8a',
    marginVertical: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#c9a961',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#3a3a3a',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6a6a6a',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.3)',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 15,
    color: '#3a3a3a',
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#c9a961',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  limitReachedBanner: {
    backgroundColor: '#d98080',
    padding: 12,
    alignItems: 'center',
  },
  limitReachedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
