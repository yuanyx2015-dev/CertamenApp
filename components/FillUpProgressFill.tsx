import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const FILL_LIGHT = '#e8d6a8';
const FILL_DARK = '#c9a961';

/**
 * Gold progress fill that starts empty and eases to `progress` (0..1).
 * Colour starts light and darkens as the bar extends.
 * Labels stay static — this is visual only.
 */
export function FillUpProgressFill({
  progress,
  style,
  ready = true,
}: {
  progress: number;
  style?: StyleProp<ViewStyle>;
  /** Keep the bar empty until the screen is actually visible (e.g. after brand intro). */
  ready?: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (!ready) {
      t.setValue(0);
      return;
    }
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ready, clamped, t]);

  const width = t.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${clamped * 100}%`],
  });

  const backgroundColor = t.interpolate({
    inputRange: [0, 1],
    outputRange: [FILL_LIGHT, FILL_DARK],
  });

  return <Animated.View style={[style, { width, backgroundColor }]} />;
}
