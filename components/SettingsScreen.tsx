import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Animated } from 'react-native';

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

export function SettingsScreen({ onNavigate, previousScreen, onLogout }: { onNavigate?: (screen: string) => void; previousScreen?: string; onLogout?: () => void }) {
  const [wrongQuestionsOnly, setWrongQuestionsOnly] = React.useState(false);

  return (
    <View style={styles.container}>
      {/* Centered Content */}
      <View style={styles.contentContainer}>
        {/* Settings Title */}
        <Text style={styles.titleText}>Settings</Text>

        {/* Settings Options */}
        <View style={styles.settingsContainer}>
          {/* # of tossups */}
          <Text style={styles.optionText}># of tossups</Text>

          {/* Wrong questions only with toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.optionText}>Wrong questions only</Text>
            <Switch
              value={wrongQuestionsOnly}
              onValueChange={setWrongQuestionsOnly}
              trackColor={{ false: '#d4d4d4', true: 'rgba(234, 186, 175, 0.7)' }}
              thumbColor={wrongQuestionsOnly ? '#E5C66A' : '#f4f3f4'}
              ios_backgroundColor="#d4d4d4"
            />
          </View>
        </View>
      </View>

      {/* Back and Logout Buttons - At Bottom */}
      <View style={styles.bottomContainer}>
        {onLogout && (
          <View style={styles.logoutButtonContainer}>
            <AnimatedButton 
              label="Logout" 
              onPress={onLogout}
            />
          </View>
        )}
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  logoutButtonContainer: {
    width: '100%',
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