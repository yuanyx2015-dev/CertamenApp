import React, { createContext, useContext, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * True only on iPad. Never true on iPhone — use this to gate tablet-only UI.
 */
export const isIPad = Platform.OS === 'ios' && Platform.isPad;

/** Phone content column width used across main screens. */
export const PHONE_CONTENT_MAX_WIDTH = 448;

/** Side inset when computing the base fill-width scale on iPad. */
export const IPAD_SCALE_SIDE_INSET = 24;

/**
 * Extra shrink so the scaled phone UI isn't edge-to-edge huge.
 * Final scale = fillWidthScale * this factor.
 */
export const IPAD_SCALE_FACTOR = 0.85;

/** iPad content scale for a given window width (1 on non-iPad). */
export function getIPadContentScale(windowWidth: number): number {
  if (!isIPad) return 1;
  const fill =
    (windowWidth - IPAD_SCALE_SIDE_INSET * 2) / PHONE_CONTENT_MAX_WIDTH;
  return fill * IPAD_SCALE_FACTOR;
}

/** Current iPad content scale inside an `IPadScaledPhoneColumn` (1 on iPhone). */
export const IPadScaleContext = createContext(1);

export function useIPadScale(): number {
  return useContext(IPadScaleContext);
}

/** Length props that should be multiplied when natively sizing for iPad. */
const SCALE_KEYS = new Set([
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'top',
  'left',
  'right',
  'bottom',
  'gap',
  'rowGap',
  'columnGap',
  'shadowRadius',
  'textShadowRadius',
]);

type AnyStyle = ViewStyle | TextStyle | ImageStyle;

/** Multiply length-like style values by `scale` (leaves flex/colors/strings alone). */
export function scaleStyleObject<T extends AnyStyle>(style: T, scale: number): T {
  if (scale === 1 || style == null) return style;
  const out: Record<string, unknown> = { ...style };
  for (const key of Object.keys(out)) {
    if (!SCALE_KEYS.has(key)) continue;
    const value = out[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value * scale;
    }
  }
  if (
    out.shadowOffset &&
    typeof out.shadowOffset === 'object' &&
    out.shadowOffset != null
  ) {
    const offset = out.shadowOffset as { width?: number; height?: number };
    out.shadowOffset = {
      width: typeof offset.width === 'number' ? offset.width * scale : offset.width,
      height:
        typeof offset.height === 'number' ? offset.height * scale : offset.height,
    };
  }
  return out as T;
}

/**
 * Re-create a StyleSheet at the current iPad scale so fonts/spacing are drawn
 * at their final size (sharp) instead of bitmap-upscaled via transform.
 *
 * @param scaleOverride Use when this component *owns* the `IPadScaledPhoneColumn`
 *   (context isn't available yet). Prefer context for nested screens.
 */
export function useIPadScaledStyles<T extends Record<string, AnyStyle>>(
  sheet: T,
  scaleOverride?: number
): T {
  const contextScale = useIPadScale();
  const scale = scaleOverride ?? contextScale;
  return useMemo(() => {
    if (scale === 1) return sheet;
    const scaled: Record<string, AnyStyle> = {};
    for (const key of Object.keys(sheet)) {
      scaled[key] = scaleStyleObject(
        StyleSheet.flatten(sheet[key]) as AnyStyle,
        scale
      );
    }
    return scaled as T;
  }, [sheet, scale]);
}

/**
 * Same scale formula as `IPadScaledPhoneColumn` — for screens that own the column
 * and need styles before the context provider mounts.
 */
export function useIPadColumnScale(extraShrink = 1): number {
  const { width } = useWindowDimensions();
  if (!isIPad) return 1;
  const shrink = extraShrink > 0 ? extraShrink : 1;
  return getIPadContentScale(width) / shrink;
}

/** Convenience: content scale for this window, ignoring column extraShrink. */
export function useWindowIPadScale(): number {
  const { width } = useWindowDimensions();
  return getIPadContentScale(width);
}
