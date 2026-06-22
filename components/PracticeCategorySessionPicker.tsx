import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
const PRACTICE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'mythology', label: 'Mythology' },
  { key: 'history', label: 'History' },
  { key: 'language', label: 'Language' },
  { key: 'literature', label: 'Literature' },
  { key: 'culture-life', label: 'Culture & Life' },
  { key: 'living-latin', label: 'Living Latin' },
];

function CategoryBox({ label, onPress }: { label: string; onPress: () => void }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(201, 169, 97, 0.12)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '47%' }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.categoryButton, { backgroundColor }]}>
          <Text style={styles.categoryLabel}>{label}</Text>
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

export function PracticeCategorySessionPicker({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.grid}>
      {PRACTICE_CATEGORIES.map(({ key, label }) => (
        <CategoryBox
          key={key}
          label={label}
          onPress={() => onNavigate?.('practice-game', key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  categoryButton: {
    width: '100%',
    aspectRatio: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    fontSize: 15,
    color: '#3a3a3a',
    letterSpacing: 0.4,
    fontWeight: '500',
    textAlign: 'center',
  },
});
