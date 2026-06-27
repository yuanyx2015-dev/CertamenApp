import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const STAR_PATH =
  'M12 17.27l5.18 3.04-1.37-5.91 4.59-3.97-6.06-.52L12 4l-2.34 5.91-6.06.52 4.59 3.97-1.37 5.91L12 17.27z';

/**
 * Hold-to-master star used by both game screens.
 * `filled` is the static fill before any animation; `progress` (0..1) drives the live overlay.
 */
export function StarIcon({ filled, progress }: { filled: number; progress: Animated.Value }) {
  return (
    <View style={styles.wrap}>
      {/* Outline (always visible) */}
      <Svg width={48} height={48} viewBox="0 0 24 24">
        <Path
          d={STAR_PATH}
          fill={filled > 0 ? '#c9a961' : 'rgba(255,255,255,0.6)'}
          stroke="#9d856b"
          strokeWidth={1}
        />
      </Svg>
      {/* Animated fill overlay using opacity */}
      <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: progress }]}>
        <Svg width={48} height={48} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill="#c9a961" stroke="#7d6543" strokeWidth={1} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 48,
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
