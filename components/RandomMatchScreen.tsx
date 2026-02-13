import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export function RandomMatchScreen() {
  const textPosition = useRef(new Animated.Value(0)).current;
  const emojiPosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create smooth cyclic animation for text (moves right, back to center, left, back to center)
    const textAnimation = Animated.loop(
      Animated.sequence([
        // Move right
        Animated.timing(textPosition, {
          toValue: 20,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Come back to center
        Animated.timing(textPosition, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Move left
        Animated.timing(textPosition, {
          toValue: -20,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Come back to center
        Animated.timing(textPosition, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Create smooth cyclic animation for emoji (moves opposite direction)
    const emojiAnimation = Animated.loop(
      Animated.sequence([
        // Move left (opposite of text)
        Animated.timing(emojiPosition, {
          toValue: -20,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Come back to center
        Animated.timing(emojiPosition, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Move right
        Animated.timing(emojiPosition, {
          toValue: 20,
          duration: 1000,
          useNativeDriver: true,
        }),
        // Come back to center
        Animated.timing(emojiPosition, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    textAnimation.start();
    emojiAnimation.start();

    return () => {
      textAnimation.stop();
      emojiAnimation.stop();
    };
  }, [textPosition, emojiPosition]);

  return (
    <View style={styles.container}>
      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Your Name Card - Top */}
        <View style={styles.playerCard}>
          <Text style={styles.playerText}>[Your Name]</Text>
        </View>

        {/* Loading Dots */}
        <View style={styles.dotsContainer}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Opponent Name Card - Bottom */}
        <View style={styles.playerCard}>
          <Text style={styles.playerText}>[Your Opponent's Name]</Text>
        </View>

        {/* Searching Text with Animation */}
        <Animated.Text 
          style={[
            styles.searchingText,
            { transform: [{ translateX: textPosition }] }
          ]}
        >
          Searching For The Enemy
        </Animated.Text>

        {/* Binocular Emoji with Animation */}
        <Animated.Text 
          style={[
            styles.emojiText,
            { transform: [{ translateX: emojiPosition }] }
          ]}
        >
          🔍
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 40,
  },
  playerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 200,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
  },
  playerText: {
    color: '#3a3a3a',
    fontSize: 15,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3a3a3a',
  },
  searchingText: {
    color: '#3a3a3a',
    fontSize: 22,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontWeight: '500',
  },
  emojiText: {
    fontSize: 40,
    textAlign: 'center',
  },
});