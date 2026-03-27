import React, { useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getOrCreateUserSettings, updateSetting } from '../services/userSettingsService';
import { getAllWrongQuestions } from '../services/questionReviewService';

function AnimatedButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
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
    outputRange: ['rgba(255, 255, 255, 0.6)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.button, { backgroundColor }]}>
          <Text style={styles.buttonText}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SettingsScreen({ onNavigate, previousScreen }: { onNavigate?: (screen: string) => void; previousScreen?: string }) {
  const [wrongQuestionsOnly, setWrongQuestionsOnly] = React.useState(false);
  const [numTossups, setNumTossups] = React.useState(20);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [wrongQuestionCount, setWrongQuestionCount] = React.useState(0);

  // Extract loading logic into reusable function
  const loadSettingsData = React.useCallback(async () => {
    setIsLoading(true);
    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      const { data: settings, error } = await getOrCreateUserSettings(user.id);
      if (settings && !error) {
        setWrongQuestionsOnly(settings.wrong_questions_only);
        setNumTossups(settings.num_tossups);
      }
      
      // Fetch wrong question count (always refresh)
      const { data: wrongQuestions } = await getAllWrongQuestions(user.id, 1000);
      if (wrongQuestions) {
        setWrongQuestionCount(wrongQuestions.length);
      }
    }
    setIsLoading(false);
  }, []);

  // Load settings on mount AND whenever component becomes visible
  useEffect(() => {
    loadSettingsData();
  }, []); // Run on mount

  // Refresh data when navigating back to this screen
  useEffect(() => {
    if (previousScreen) {
      // If we came from another screen, refresh the data
      loadSettingsData();
    }
  }, [previousScreen, loadSettingsData]);

  // Handle toggle change and save to database
  const handleWrongQuestionsToggle = async (value: boolean) => {
    setWrongQuestionsOnly(value);
    
    if (userId) {
      await updateSetting(userId, 'wrong_questions_only', value);
    }
    
    // Auto-adjust number of questions when toggling
    if (value && wrongQuestionCount > 0) {
      // When toggling ON: set to wrong question count (capped at 50)
      const newNumQuestions = Math.min(wrongQuestionCount, 50);
      setNumTossups(newNumQuestions);
      if (userId) {
        await updateSetting(userId, 'num_tossups', newNumQuestions);
      }
    } else if (!value && numTossups < 5) {
      // When toggling OFF: ensure minimum is 5
      setNumTossups(5);
      if (userId) {
        await updateSetting(userId, 'num_tossups', 5);
      }
    }
  };

  // Handle number of tossups change
  const handleNumTossupsChange = async (newValue: number) => {
    // Calculate min and max based on wrong questions toggle
    const minQuestions = wrongQuestionsOnly ? Math.min(5, wrongQuestionCount) : 5;
    const maxQuestions = wrongQuestionsOnly ? Math.min(wrongQuestionCount, 50) : 50;
    // Clamp between minQuestions and maxQuestions
    const clampedValue = Math.max(minQuestions, Math.min(maxQuestions, newValue));
    setNumTossups(clampedValue);
    
    if (userId) {
      await updateSetting(userId, 'num_tossups', clampedValue);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Centered Content */}
      <View style={styles.contentContainer}>
        {/* Settings Title */}
        <Text style={styles.titleText}>Settings</Text>

        {/* Settings Options */}
        <View style={styles.settingsContainer}>
          {/* # of questions with counter */}
          <View style={styles.counterRow}>
            <Text style={styles.optionText}># of questions</Text>
            <View style={styles.counterControls}>
              <TouchableOpacity 
                style={styles.counterButton}
                onPress={() => handleNumTossupsChange(numTossups - 5)}
                activeOpacity={0.7}
              >
                <Text style={styles.counterButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{numTossups}</Text>
              <TouchableOpacity 
                style={styles.counterButton}
                onPress={() => handleNumTossupsChange(numTossups + 5)}
                activeOpacity={0.7}
              >
                <Text style={styles.counterButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {wrongQuestionsOnly && (
            <Text style={styles.helperText}>
              Max: {Math.min(wrongQuestionCount, 50)} (based on your wrong questions)
            </Text>
          )}

          {/* Wrong questions only with toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.optionText}>Wrong questions only</Text>
            <Switch
              value={wrongQuestionsOnly}
              onValueChange={handleWrongQuestionsToggle}
              trackColor={{ false: '#d4d4d4', true: '#c9a961' }}
              thumbColor={wrongQuestionsOnly ? '#d4b76a' : '#f4f3f4'}
              ios_backgroundColor="#d4d4d4"
            />
          </View>
        </View>
      </View>

      {/* Back Button - At Bottom */}
      <View style={styles.bottomContainer}>
        <AnimatedButton 
          label="Back" 
          onPress={() => onNavigate?.(previousScreen || 'main')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  contentContainer: {
    width: '100%',
    gap: 32,
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  settingsContainer: {
    gap: 24,
  },
  optionText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  helperText: {
    color: '#8b7355',
    fontSize: 12,
    marginTop: -16,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  counterButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3a3a3a',
    lineHeight: 24,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3a3a',
    minWidth: 40,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});