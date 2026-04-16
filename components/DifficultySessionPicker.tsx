import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

export const DIFFICULTY_OPTIONS: {
  id: 'easy' | 'medium' | 'hard';
  label: string;
  description: string;
}[] = [
  { id: 'easy', label: 'Easy', description: 'Every tossup is easy difficulty.' },
  { id: 'medium', label: 'Medium', description: 'Every tossup is medium difficulty.' },
  { id: 'hard', label: 'Hard', description: 'Every tossup is hard difficulty.' },
];

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
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, { width: '100%' }]}>
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

type NavigateFn = (
  screen: string,
  category?: string,
  practiceDifficulty?: 'easy' | 'medium' | 'hard'
) => void;

export function DifficultySessionPicker({
  onNavigate,
  showHints = true,
}: {
  onNavigate?: NavigateFn;
  /** Per-difficulty subtext (e.g. "Every tossup is easy…"). Off for Practice Mode. */
  showHints?: boolean;
}) {
  return (
    <View style={styles.optionsColumn}>
      {DIFFICULTY_OPTIONS.map(({ id, label, description }) => (
        <View key={id} style={[styles.optionBlock, !showHints && styles.optionBlockCompact]}>
          <AnimatedButton label={label} onPress={() => onNavigate?.('practice-game', undefined, id)} />
          {showHints ? <Text style={styles.hintText}>{description}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export const difficultyPickerStyles = StyleSheet.create({
  optionsColumn: {
    width: '100%',
    gap: 18,
    marginTop: 4,
  },
  optionBlock: {
    width: '100%',
    gap: 6,
  },
  optionBlockCompact: {
    gap: 0,
  },
  hintText: {
    color: '#8a8a8a',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
});

const styles = difficultyPickerStyles;
