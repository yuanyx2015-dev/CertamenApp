import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

const BAND_WIDTH = 52;
const BAND_GAP = 52;
const STRIPE = BAND_WIDTH + BAND_GAP;
const BOTTOM_FADE_H = 40;
const CREAM = '#f5efe3';

/**
 * Faint diagonal cloth bands for the cream parchment only.
 * Stop above the tab bar / Done-learning footer / meander.
 */
export function ClothBands({ bottomInset = 118 }: { bottomInset?: number }) {
  const { width, height } = useWindowDimensions();
  const size = Math.ceil(Math.hypot(width, height) * 1.2);
  const count = Math.ceil((size * 2) / STRIPE) + 4;
  const origin = size / 2;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: bottomInset }]}>
      <Svg
        width={size}
        height={size}
        style={{
          position: 'absolute',
          top: (height - size) / 2,
          left: (width - size) / 2,
        }}
      >
        <G transform={`rotate(-28 ${origin} ${origin})`}>
          {Array.from({ length: count }).map((_, i) => (
            <Rect
              key={i}
              x={i * STRIPE - size}
              y={-size}
              width={BAND_WIDTH}
              height={size * 3}
              fill="rgba(138, 106, 58, 0.04)"
            />
          ))}
        </G>
      </Svg>
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
