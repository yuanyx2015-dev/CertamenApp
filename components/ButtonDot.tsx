import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Absolutely-positioned circle indicator pinned to the left edge of any button.
 * Place it as a direct child of the button's inner View / Animated.View.
 * It stretches top-to-bottom to find the vertical centre automatically.
 */
export function ButtonDot({ color = '#c9a961' }: { color?: string }) {
  return (
    <View style={styles.anchor} pointerEvents="none">
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 17,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
