import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View
} from 'react-native';
import { Text } from '../lib/AppText';

type BrandIntroOverlayProps = {
  visible: boolean;
  onFinished: () => void;
};

/**
 * Short brand lockup shown when entering Home after login / cold start / resume.
 * Motto matches the CertamenPrep web site: "Practice like it's real."
 */
export function BrandIntroOverlay({ visible, onFinished }: BrandIntroOverlayProps) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.9)).current;
  const contentTranslateY = useRef(new Animated.Value(10)).current;
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!visible) return;

    finishedRef.current = false;
    overlayOpacity.setValue(1);
    contentOpacity.setValue(0);
    contentScale.setValue(0.9);
    contentTranslateY.setValue(10);

    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const enter = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const exit = Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 400,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });

    enter.start(({ finished }) => {
      if (!finished) return;
      holdTimer = setTimeout(() => {
        exit.start(({ finished: exitFinished }) => {
          if (exitFinished && !finishedRef.current) {
            finishedRef.current = true;
            onFinishedRef.current();
          }
        });
      }, 950);
    });

    return () => {
      if (holdTimer) clearTimeout(holdTimer);
      enter.stop();
      exit.stop();
    };
  }, [visible, overlayOpacity, contentOpacity, contentScale, contentTranslateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="CertamenPrep. Practice like it's real."
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ scale: contentScale }, { translateY: contentTranslateY }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.icon}
            accessibilityIgnoresInvertColors
          />
        </View>
        <Text style={styles.lockup}>
          <Text face="brand" style={styles.brand}>
            CertamenPrep
          </Text>
          <Text style={styles.separator}>{' • '}</Text>
          <Text style={styles.motto}>Practice like it's real.</Text>
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5efe3',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconWrap: {
    marginBottom: 22,
    shadowColor: '#3a2a1a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  icon: {
    width: 112,
    height: 112,
    borderRadius: 24,
  },
  lockup: {
    textAlign: 'center',
    lineHeight: 30,
  },
  brand: {
    // Cormorant wordmark: sized up so it holds the line against the motto.
    fontSize: 25,
    fontWeight: '600',
    color: '#c9a569',
    letterSpacing: 0.7,
  },
  separator: {
    fontSize: 16,
    color: '#9d856b',
  },
  motto: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#6a6a6a',
    letterSpacing: 0.15,
  },
});
