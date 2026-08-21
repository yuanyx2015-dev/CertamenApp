import { Animated, Easing } from 'react-native';

/** Total length of the home-logo transition (out + in). */
export const HOME_LOGO_TRANSITION_MS = 1500;
const HALF_MS = HOME_LOGO_TRANSITION_MS / 2;

/** Peak scale while the wordmark sits in the center of the screen. */
export const HOME_LOGO_CENTER_SCALE = 2;

/** App icon path: starts a touch high, dips with the logo, returns to start. */
const APP_ICON_START_Y = -20;
const APP_ICON_LOW_Y = 16;

type PlayHomeLogoTransitionArgs = {
  logoScale: Animated.Value;
  logoTranslateY: Animated.Value;
  appIconTranslateY: Animated.Value;
  restOpacity: Animated.Value;
  translateYToCenter: number;
  onComplete: () => void;
};

/**
 * 1.5s home transition: brand lockup grows into the screen center while the
 * rest of the UI fades out, then returns with a strong ease-out deceleration.
 * Navigation to Home is started by the caller on tap so loading happens under
 * this cover. Returns a stop function for cleanup.
 */
export function playHomeLogoTransition({
  logoScale,
  logoTranslateY,
  appIconTranslateY,
  restOpacity,
  translateYToCenter,
  onComplete,
}: PlayHomeLogoTransitionArgs): () => void {
  logoScale.setValue(1);
  logoTranslateY.setValue(0);
  appIconTranslateY.setValue(APP_ICON_START_Y);
  restOpacity.setValue(1);

  const easing = Easing.inOut(Easing.cubic);
  // Stronger deceleration into rest — quick travel, soft landing, no overshoot.
  const returnEasing = Easing.out(Easing.poly(4));
  const native = { useNativeDriver: true as const };

  const toCenter = Animated.parallel([
    Animated.timing(logoScale, {
      toValue: HOME_LOGO_CENTER_SCALE,
      duration: HALF_MS,
      easing,
      ...native,
    }),
    Animated.timing(logoTranslateY, {
      toValue: translateYToCenter,
      duration: HALF_MS,
      easing,
      ...native,
    }),
    Animated.timing(appIconTranslateY, {
      toValue: APP_ICON_LOW_Y,
      duration: HALF_MS,
      easing,
      ...native,
    }),
    Animated.timing(restOpacity, {
      toValue: 0,
      duration: HALF_MS,
      easing,
      ...native,
    }),
  ]);

  const toHeader = Animated.parallel([
    Animated.timing(logoScale, {
      toValue: 1,
      duration: HALF_MS,
      easing: returnEasing,
      ...native,
    }),
    Animated.timing(logoTranslateY, {
      toValue: 0,
      duration: HALF_MS,
      easing: returnEasing,
      ...native,
    }),
    Animated.timing(appIconTranslateY, {
      toValue: APP_ICON_START_Y,
      duration: HALF_MS,
      easing: returnEasing,
      ...native,
    }),
    Animated.timing(restOpacity, {
      toValue: 1,
      duration: HALF_MS,
      easing,
      ...native,
    }),
  ]);

  let stopped = false;

  toCenter.start(({ finished }) => {
    if (stopped || !finished) return;
    toHeader.start(({ finished: done }) => {
      if (stopped || !done) return;
      onComplete();
    });
  });

  return () => {
    stopped = true;
    toCenter.stop();
    toHeader.stop();
  };
}
