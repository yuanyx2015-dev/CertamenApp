import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { isSoundMuted, subscribeSoundMuted } from '../lib/buttonSound';
import { ClothBands } from './ClothBands';
import { Text } from '../lib/AppText';

type BrandIntroOverlayProps = {
  visible: boolean;
  onFinished: () => void;
};

/**
 * Brand intro after login, cold start, guest continue, or return from background.
 * Logo, typed name, motto, then a ring and a fade into the app.
 */

const NAME = 'CertamenPrep';
const MOTTO = "Practice like it's real.";

/** Matches the spacing baked into assets/cac/tick.wav. */
const LETTER_MS = 72;

const LOGO = 170;
const LOGO_AT = 280;
const LOGO_MS = 760;
const DING_AT = LOGO_AT + 140;
const SHEEN_AT = 700;
const SHEEN_MS = 720;
const TYPE_AT = 1160;
const RULE_AT = TYPE_AT + (NAME.length - 1) * LETTER_MS + 200;
const RULE_MS = 480;
const MOTTO_AT = RULE_AT + 400;
const MOTTO_MS = 560;
const RING_AT = MOTTO_AT + MOTTO_MS + 100;
const PRESS_MS = 280;
const PRESS_HOLD_MS = 620;
const BLOOM_AT = RING_AT + PRESS_MS + PRESS_HOLD_MS;
const BLOOM_MS = 820;

const PARCHMENT = '#f5efe3';
const GOLD = '#c9a569';

function arm(player: AudioPlayer) {
  player.pause();
  void player.seekTo(0);
}

function playArmed(player: AudioPlayer) {
  if (isSoundMuted()) return;
  player.play();
}

export function BrandIntroOverlay({ visible, onFinished }: BrandIntroOverlayProps) {
  const { width } = useWindowDimensions();
  const ticks = useAudioPlayer(require('../assets/cac/tick.wav'));
  // Ring continues past the old cutoff and fades to silence.
  const ring = useAudioPlayer(require('../assets/cac/ring.wav'));
  const ding = useAudioPlayer(require('../assets/cac/ding.wav'));

  const [nameCount, setNameCount] = useState(0);
  const [showCaret, setShowCaret] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const mottoOpacity = useRef(new Animated.Value(0)).current;
  const mottoY = useRef(new Animated.Value(8)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.92)).current;
  const lockupScale = useRef(new Animated.Value(1)).current;
  const caretOpacity = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const players = useRef({ ticks, ring, ding });
  players.current = { ticks, ring, ding };

  useEffect(() => {
    return subscribeSoundMuted((next) => {
      if (!next) return;
      players.current.ticks.pause();
      players.current.ring.pause();
      players.current.ding.pause();
    });
  }, []);

  useEffect(() => {
    ticks.volume = 0.14;
    ring.volume = 0.48;
    ding.volume = 0.36;
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
  }, [ticks, ring, ding]);

  useEffect(() => {
    if (!showCaret) {
      caretOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showCaret, caretOpacity]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    finishedRef.current = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const running: Animated.CompositeAnimation[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) fn();
        }, ms)
      );
    };
    const start = (animation: Animated.CompositeAnimation) => {
      running.push(animation);
      animation.start();
    };
    const finish = () => {
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      onFinishedRef.current();
    };

    setNameCount(0);
    setShowCaret(false);
    overlayOpacity.setValue(1);
    logoOpacity.setValue(0);
    logoScale.setValue(0.94);
    sheen.setValue(0);
    rule.setValue(0);
    mottoOpacity.setValue(0);
    mottoY.setValue(8);
    ringOpacity.setValue(0);
    ringScale.setValue(0.92);
    lockupScale.setValue(1);
    arm(players.current.ticks);
    arm(players.current.ring);
    arm(players.current.ding);

    later(LOGO_AT, () => {
      start(
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: LOGO_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1,
            duration: LOGO_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );
    });

    later(DING_AT - 120, () => arm(players.current.ding));
    later(DING_AT, () => playArmed(players.current.ding));

    later(SHEEN_AT, () => {
      start(
        Animated.timing(sheen, {
          toValue: 1,
          duration: SHEEN_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        })
      );
    });

    later(TYPE_AT - 120, () => arm(players.current.ticks));
    later(TYPE_AT, () => {
      setShowCaret(true);
      playArmed(players.current.ticks);
    });
    for (let i = 0; i < NAME.length; i += 1) {
      later(TYPE_AT + i * LETTER_MS, () => setNameCount(i + 1));
    }

    later(RULE_AT, () => {
      setShowCaret(false);
      start(
        Animated.timing(rule, {
          toValue: 1,
          duration: RULE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        })
      );
    });

    later(MOTTO_AT, () => {
      start(
        Animated.parallel([
          Animated.timing(mottoOpacity, {
            toValue: 1,
            duration: MOTTO_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(mottoY, {
            toValue: 0,
            duration: MOTTO_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );
    });

    later(RING_AT - 180, () => arm(players.current.ring));
    later(RING_AT, () => {
      playArmed(players.current.ring);
      ringOpacity.setValue(0.55);
      ringScale.setValue(0.92);
      start(
        Animated.parallel([
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 1.42,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 0.9,
            duration: PRESS_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );
    });

    later(BLOOM_AT, () => {
      start(
        Animated.parallel([
          Animated.timing(lockupScale, {
            toValue: 3.05,
            duration: BLOOM_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: BLOOM_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );
    });

    later(BLOOM_AT + BLOOM_MS, finish);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      running.forEach((animation) => animation.stop());
      players.current.ding.pause();
      players.current.ticks.pause();
      players.current.ring.pause();
    };
  }, [
    visible,
    overlayOpacity,
    logoOpacity,
    logoScale,
    sheen,
    rule,
    mottoOpacity,
    mottoY,
    ringOpacity,
    ringScale,
    lockupScale,
  ]);

  const sheenX = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-LOGO * 1.35, LOGO * 2.4],
  });
  const sheenFade = sheen.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [1, 1, 0],
  });
  const fit = Math.min(1, (width - 40) / 430);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="CertamenPrep. Practice like it's real."
    >
      <View pointerEvents="none" style={styles.stripes}>
        <ClothBands bottomInset={0} />
      </View>
      <View style={[styles.fit, { transform: [{ scale: fit }] }]} pointerEvents="none">
        <Animated.View style={[styles.lockup, { transform: [{ scale: lockupScale }] }]}>
          <View style={styles.logoSlot}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                { opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.logoShadow,
                { opacity: logoOpacity, transform: [{ scale: logoScale }] },
              ]}
            >
              <View style={styles.logoClip}>
                <Image
                  source={require('../assets/icon.png')}
                  style={styles.logo}
                  accessibilityIgnoresInvertColors
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.sheen,
                    {
                      opacity: sheenFade,
                      transform: [{ translateX: sheenX }, { rotate: '16deg' }],
                    },
                  ]}
                />
              </View>
            </Animated.View>
          </View>

          <View style={styles.nameSlot}>
            <Text face="brand" style={[styles.name, styles.nameSpacer]}>
              {NAME}
            </Text>
            <View style={styles.nameRow}>
              <Text face="brand" style={styles.name}>
                {NAME.slice(0, nameCount)}
              </Text>
              {showCaret ? <Animated.View style={[styles.caret, { opacity: caretOpacity }]} /> : null}
            </View>
          </View>

          <View style={styles.ruleSlot}>
            <Animated.View style={[styles.rule, { transform: [{ scaleX: rule }] }]} />
          </View>

          <Animated.View style={{ opacity: mottoOpacity, transform: [{ translateY: mottoY }] }}>
            <Text face="body" style={styles.motto}>
              {MOTTO}
            </Text>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PARCHMENT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
    overflow: 'hidden',
  },
  stripes: {
    ...StyleSheet.absoluteFillObject,
  },
  fit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
  },
  logoSlot: {
    width: LOGO,
    height: LOGO,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  ring: {
    position: 'absolute',
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    borderWidth: 2,
    borderColor: GOLD,
  },
  logoShadow: {
    shadowColor: '#3a2a1a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  logoClip: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO * 0.2,
    overflow: 'hidden',
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  sheen: {
    position: 'absolute',
    top: -LOGO * 0.25,
    width: LOGO * 0.18,
    height: LOGO * 1.5,
    backgroundColor: 'rgba(255, 248, 230, 0.42)',
  },
  nameSlot: {
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  nameRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 54,
    fontWeight: '600',
    color: GOLD,
    letterSpacing: 0.6,
  },
  nameSpacer: {
    opacity: 0,
  },
  caret: {
    width: 2,
    height: 46,
    marginLeft: 2,
    backgroundColor: GOLD,
  },
  ruleSlot: {
    height: 2,
    width: 224,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: {
    height: 2,
    width: 224,
    backgroundColor: GOLD,
  },
  motto: {
    fontSize: 25,
    fontStyle: 'italic',
    color: '#6a6a6a',
    letterSpacing: 0.2,
  },
});
