import React from 'react';
import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { fontFamilyForRole, type TextRole } from './fonts';

function childrenLookLikeBrand(children: React.ReactNode): boolean {
  if (typeof children === 'string') {
    // Only the bare product name — not sentences that merely mention it.
    return /^certamen\s*prep[!?.]*$/i.test(children.trim());
  }
  if (Array.isArray(children)) {
    return children.some(childrenLookLikeBrand);
  }
  return false;
}

function resolveRole(
  face: TextRole | undefined,
  style: StyleProp<TextStyle>,
  children: React.ReactNode
): TextRole {
  if (face) return face;
  if (childrenLookLikeBrand(children)) return 'brand';
  const flat = StyleSheet.flatten(style) || {};
  const size = typeof flat.fontSize === 'number' ? flat.fontSize : 16;
  // Big headings / titles → Cardo; subheads and UI copy stay Spectral.
  if (size >= 22) return 'title';
  return 'body';
}

export type AppTextProps = TextProps & {
  /** Force face: title=Cardo, body=Spectral, brand=Cormorant Garamond. */
  face?: TextRole;
};

/**
 * Drop-in `Text` with app typography:
 * - titles (large) → Cardo
 * - body / subheads / buttons → Spectral
 * - “CertamenPrep” → Cormorant Garamond
 *
 * Sizes stay exactly as written in each stylesheet; this only picks the face.
 */
export function Text({ face, style, children, ...rest }: AppTextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const resolvedRole = resolveRole(face, style, children);
  const family = fontFamilyForRole(resolvedRole, flat.fontWeight);

  return (
    <RNText
      {...rest}
      style={[
        style,
        {
          fontFamily: family,
          // Weight is baked into the face file; keep platform from double-bolding.
          fontWeight: 'normal',
        },
      ]}
    >
      {children}
    </RNText>
  );
}
