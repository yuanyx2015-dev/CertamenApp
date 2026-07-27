import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  isIPad,
  PHONE_CONTENT_MAX_WIDTH,
  getIPadContentScale,
  IPadScaleContext,
} from '../lib/layout';

/**
 * On iPhone: pass-through (scale = 1).
 * On iPad: lay out at phone proportions but at a larger native size
 * (fill-width × 0.85 / extraShrink) so text is re-rendered at the final
 * font size — not bitmap-stretched via transform (which looks blurry).
 *
 * Children must use `useIPadScaledStyles(...)` (or multiply sizes with
 * `useIPadScale()`) so paddings/fonts match this column width.
 *
 * @param extraShrink Divide the scale by this (e.g. 1.15). iPhone ignores this.
 */
export function IPadScaledPhoneColumn({
  children,
  extraShrink = 1,
}: {
  children: React.ReactNode;
  extraShrink?: number;
}) {
  const { width: windowWidth } = useWindowDimensions();

  if (!isIPad) {
    return (
      <IPadScaleContext.Provider value={1}>
        <View style={styles.phoneRoot}>{children}</View>
      </IPadScaleContext.Provider>
    );
  }

  const shrink = extraShrink > 0 ? extraShrink : 1;
  const scale = getIPadContentScale(windowWidth) / shrink;

  return (
    <IPadScaleContext.Provider value={scale}>
      <View style={styles.iPadOuter}>
        <View
          style={[
            styles.iPadInner,
            { width: PHONE_CONTENT_MAX_WIDTH * scale },
          ]}
        >
          {children}
        </View>
      </View>
    </IPadScaleContext.Provider>
  );
}

const styles = StyleSheet.create({
  phoneRoot: {
    flex: 1,
    width: '100%',
  },
  iPadOuter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iPadInner: {
    flex: 1,
    maxWidth: '100%',
  },
});
