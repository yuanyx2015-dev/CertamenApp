import React from 'react';
import { StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useIPadScale, useIPadScaledStyles } from '../lib/layout';

const STAR_PATH =
  'M12 17.27l5.18 3.04-1.37-5.91 4.59-3.97-6.06-.52L12 4l-2.34 5.91-6.06.52 4.59 3.97-1.37 5.91L12 17.27z';

/** Brief pause after the star is full before advancing (keep short). */
export const MASTERED_CONFIRM_MS = 80;

/**
 * Hold-to-master star used by both game screens.
 * `filled` is the static fill before any animation; `progress` (0..1) drives the live overlay.
 * At full progress the star itself fills solid gold — no outer ring.
 */
export function StarIcon({ filled, progress }: { filled: number; progress: Animated.Value }) {
  const iPadScale = useIPadScale();
  const styles = useIPadScaledStyles(baseStyles);
  const svgSize = 48 * iPadScale;

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      {/* Outline / empty star */}
      <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24">
        <Path
          d={STAR_PATH}
          fill={filled > 0 ? '#c9a961' : 'rgba(255,255,255,0.6)'}
          stroke="#9d856b"
          strokeWidth={1}
        />
      </Svg>
      {/* Animated fill — star itself fills as you hold */}
      <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: progress }]}>
        <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill="#c9a961" stroke="#5c4a2e" strokeWidth={1.5} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
