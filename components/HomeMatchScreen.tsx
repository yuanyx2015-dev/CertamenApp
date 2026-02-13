import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function HomeMatchScreen() {
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
  },
  instructionsText: {
    color: '#7a7a7a',
    fontSize: 16,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },
});