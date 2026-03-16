import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getCategoryStats, CategoryStats } from '../services/questionReviewService';

// Simple reusable animated button component
function AnimatedCategoryButton({ 
  label, 
  wrongQuestions,
  isEnabled,
  onPress 
}: { 
  label: string; 
  wrongQuestions: number;
  isEnabled: boolean;
  onPress: () => void;
}) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!isEnabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.timing(bgColorAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!isEnabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(bgColorAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isEnabled ? 'rgba(255, 255, 255, 0.6)' : 'rgba(200, 200, 200, 0.3)',
      isEnabled ? 'rgba(201, 169, 97, 0.25)' : 'rgba(200, 200, 200, 0.3)'
    ],
  });

  return (
    <Animated.View style={{ transform: [{ scale: isEnabled ? scaleAnim : 1 }], opacity: isEnabled ? 1 : 0.5 }}>
      <TouchableOpacity 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={isEnabled ? 1 : 0.7}
      >
        <Animated.View style={[styles.categoryButton, { backgroundColor }]}>
          <Text style={[styles.categoryLabel, !isEnabled && styles.disabledLabel]}>{label}</Text>
          {isEnabled && wrongQuestions > 0 && (
            <Text style={styles.wrongText}>{wrongQuestions} to review</Text>
          )}
          {isEnabled && wrongQuestions === 0 && (
            <Text style={styles.statsText}>No questions to review</Text>
          )}
          {!isEnabled && (
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ReviewCategoryScreen({ onNavigate }: { onNavigate?: (screen: string, category?: string) => void }) {
  const [mythologyWrongCount, setMythologyWrongCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCategoryStats();
  }, []);

  const loadCategoryStats = async () => {
    setIsLoading(true);
    
    const user = await getCurrentUser();
    if (user) {
      const { data: stats } = await getCategoryStats(user.id);
      if (stats) {
        const mythologyStats = stats.find(s => s.category === 'mythology');
        setMythologyWrongCount(mythologyStats?.wrong_questions || 0);
      }
    }
    
    setIsLoading(false);
  };

  const handleCategoryPress = (category: string, isEnabled: boolean) => {
    if (!isEnabled) {
      Alert.alert('Coming Soon!', 'Developers are still working on this category. Stay tuned!');
      return;
    }
    onNavigate?.('categoryQuestions', category);
  };

  // All categories with their enabled status
  const categories = [
    { key: 'mythology', label: 'Mythology', enabled: true, wrongCount: mythologyWrongCount },
    { key: 'history', label: 'History', enabled: false, wrongCount: 0 },
    { key: 'language', label: 'Language', enabled: false, wrongCount: 0 },
    { key: 'literature', label: 'Literature', enabled: false, wrongCount: 0 },
    { key: 'life', label: 'Daily Life', enabled: false, wrongCount: 0 },
    { key: 'general', label: 'General', enabled: false, wrongCount: 0 },
  ];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c9a961" />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Review Questions</Text>
        <Text style={styles.subtitle}>Choose a category to review</Text>
        
        <View style={styles.categoriesGrid}>
          {categories.map((category) => (
            <View key={category.key} style={styles.categoryButtonWrapper}>
              <AnimatedCategoryButton
                label={category.label}
                wrongQuestions={category.wrongCount}
                isEnabled={category.enabled}
                onPress={() => handleCategoryPress(category.key, category.enabled)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 32,
    paddingHorizontal: 24,
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
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    color: '#3a3a3a',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6a6a6a',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 32,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  categoryButtonWrapper: {
    width: '47%',
  },
  categoryButton: {
    width: '100%',
    aspectRatio: 1.2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryLabel: {
    fontSize: 16,
    color: '#3a3a3a',
    letterSpacing: 0.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  disabledLabel: {
    color: '#999',
  },
  statsText: {
    fontSize: 12,
    color: '#6a6a6a',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  wrongText: {
    fontSize: 12,
    color: '#c9a961',
    letterSpacing: 0.3,
    fontWeight: '500',
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 11,
    color: '#999',
    letterSpacing: 0.3,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
