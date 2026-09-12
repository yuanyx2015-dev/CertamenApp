import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const FADE_H = 36;
const CREAM = '#f5efe3';

/** Softens the join between the striped parchment and the game header. */
export function GameHeaderFade() {
  const { width } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Svg width={width} height={FADE_H}>
        <Defs>
          <LinearGradient id="headerFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CREAM} stopOpacity="0" />
            <Stop offset="1" stopColor={CREAM} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={FADE_H} fill="url(#headerFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: FADE_H,
    marginTop: -FADE_H,
    zIndex: 2,
  },
});
