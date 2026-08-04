import { useFonts } from 'expo-font';
import { Cardo_400Regular, Cardo_700Bold } from '@expo-google-fonts/cardo';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Spectral_400Regular,
  Spectral_500Medium,
  Spectral_600SemiBold,
  Spectral_700Bold,
} from '@expo-google-fonts/spectral';

/** Loaded PostScript-style family keys used in `fontFamily` styles. */
export const fonts = {
  title: 'Cardo_400Regular',
  titleBold: 'Cardo_700Bold',
  body: 'Spectral_400Regular',
  bodyMedium: 'Spectral_500Medium',
  bodySemiBold: 'Spectral_600SemiBold',
  bodyBold: 'Spectral_700Bold',
  brand: 'CormorantGaramond_400Regular',
  brandSemiBold: 'CormorantGaramond_600SemiBold',
  brandBold: 'CormorantGaramond_700Bold',
} as const;

export type TextRole = 'body' | 'title' | 'brand';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Cardo_400Regular,
    Cardo_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Spectral_400Regular,
    Spectral_500Medium,
    Spectral_600SemiBold,
    Spectral_700Bold,
  });
  return loaded;
}

function weightNumber(fontWeight: string | number | undefined): number {
  if (fontWeight == null) return 400;
  if (typeof fontWeight === 'number') return fontWeight;
  switch (fontWeight) {
    case 'bold':
    case '700':
      return 700;
    case '600':
    case 'semibold':
      return 600;
    case '500':
    case 'medium':
      return 500;
    case 'normal':
    case '400':
      return 400;
    case '300':
    case 'light':
      return 300;
    default: {
      const n = parseInt(fontWeight, 10);
      return Number.isFinite(n) ? n : 400;
    }
  }
}

/** Map role + numeric weight to a loaded face (avoids synthetic bold glitches). */
export function fontFamilyForRole(role: TextRole, fontWeight?: string | number): string {
  const w = weightNumber(fontWeight);
  if (role === 'brand') {
    if (w >= 700) return fonts.brandBold;
    if (w >= 600) return fonts.brandSemiBold;
    return fonts.brand;
  }
  if (role === 'title') {
    return w >= 600 ? fonts.titleBold : fonts.title;
  }
  if (w >= 700) return fonts.bodyBold;
  if (w >= 600) return fonts.bodySemiBold;
  if (w >= 500) return fonts.bodyMedium;
  return fonts.body;
}
