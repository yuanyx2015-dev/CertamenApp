import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

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

export function HomeMatchScreen({ onNavigate, previousScreen }: { onNavigate?: (screen: string) => void; previousScreen?: string }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots === '') return 'punctum';
        if (prevDots === 'punctum') return 'punctum punctum';
        if (prevDots === 'punctum punctum') return 'punctum punctum punctum';
        return '';
      });
    }, 500); // Change every 500ms

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Main Text - Centered in Middle */}
      <View style={styles.mainTextContainer}>
        <Text style={styles.mainText}>Waiting For Your Friend</Text>
        <Text style={styles.dotsText}>{dots}</Text>
      </View>

      {/* Instructions Text - At Bottom */}
      <View style={styles.bottomContainer}>
        <Text style={styles.instructionsText}>
          Want to play with a friend? Just have them enter your name on their "Join Match" screen to get started!
        </Text>
        {/* Exit Match Button */}
        <View style={styles.exitButtonContainer}>
          <AnimatedButton label="Exit Match" onPress={() => onNavigate?.('friendly')} />
        </View>
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
    paddingHorizontal: 32,
    position: 'relative',
  },
  mainTextContainer: {
    alignItems: 'center',
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    paddingHorizontal: 32,
  },
  mainText: {
    color: '#3a3a3a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  dotsText: {
    color: '#3a3a3a',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    minHeight: 28,
    marginTop: 28,
    fontStyle: 'italic',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
  },
  instructionsText: {
    color: '#7a7a7a',
    fontSize: 16,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },
  exitButtonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 32,
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