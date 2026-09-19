import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

const BAND_WIDTH = 52;
const BAND_GAP = 52;
const STRIPE = BAND_WIDTH + BAND_GAP;
const BOTTOM_FADE_H = 40;
const CREAM = '#f5efe3';
const STRIPE_FILL = 'rgba(138, 106, 58, 0.028)';
const DRIFT_MS = 32000;
const ANGLE_DEG = 28;
const LOOP_Y = STRIPE / Math.sin((ANGLE_DEG * Math.PI) / 180);

/**
 * Faint diagonal cloth bands for the cream parchment only.
 * Stop above the tab bar / Done-learning footer / meander.
 */
export function ClothBands({ bottomInset = 118 }: { bottomInset?: number }) {
  const { width, height } = useWindowDimensions();
  const size = Math.ceil(Math.hypot(width, height) * 1.2);
  const count = Math.ceil((size * 2) / STRIPE) + 4;
  const origin = size / 2;
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    drift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: LOOP_Y,
        duration: DRIFT_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: bottomInset }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: (height - size) / 2,
          left: (width - size) / 2,
          transform: [{ translateY: drift }],
        }}
      >
        <Svg width={size} height={size}>
          <G transform={`rotate(-${ANGLE_DEG} ${origin} ${origin})`}>
            {Array.from({ length: count }).map((_, i) => (
              <Rect
                key={i}
                x={i * STRIPE - size}
                y={-size}
                width={BAND_WIDTH}
                height={size * 3}
                fill={STRIPE_FILL}
              />
            ))}
          </G>
        </Svg>
      </Animated.View>
      <Svg width={width} height={BOTTOM_FADE_H} style={styles.bottomFade}>
        <Defs>
          <LinearGradient id="clothBottomFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CREAM} stopOpacity="0" />
            <Stop offset="1" stopColor={CREAM} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={BOTTOM_FADE_H} fill="url(#clothBottomFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
