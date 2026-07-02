import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const CONFETTI_COLORS = ['#c9a961', '#d4b76a', '#5c2d42', '#6b3a52', '#ffffff', '#f5efe3'];
const PARTICLES_PER_BURST = 10;
const DURATION_MS = 2400;
const TOAST_VISIBLE_MS = 1500;

/** Laurel wreath center sits in RomanBackground headerContainer (top ~114). */
const LAUREL_ORIGIN_Y = 114;
const LAUREL_SPREAD_X = 72;

interface ParticleSpec {
  id: string;
  color: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  rotation: number;
  delay: number;
}

interface AnimatedParticle extends ParticleSpec {
  progress: Animated.Value;
}

function buildParticles(screenWidth: number): ParticleSpec[] {
  const centerX = screenWidth / 2;
  const origins = [
    { x: centerX - LAUREL_SPREAD_X, y: LAUREL_ORIGIN_Y + 4 },
    { x: centerX, y: LAUREL_ORIGIN_Y - 6 },
    { x: centerX + LAUREL_SPREAD_X, y: LAUREL_ORIGIN_Y + 4 },
  ];

  const particles: ParticleSpec[] = [];

  origins.forEach((origin, burstIndex) => {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const angleDeg = 235 + Math.random() * 70 + burstIndex * 4;
      const angle = (angleDeg * Math.PI) / 180;
      const speed = 55 + Math.random() * 95;
      const dx = Math.cos(angle) * speed * (0.7 + Math.random() * 0.6);
      const dy = Math.sin(angle) * speed + 90 + Math.random() * 130;

      particles.push({
        id: `${burstIndex}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        width: 5 + Math.random() * 5,
        height: 3 + Math.random() * 4,
        originX: origin.x + (Math.random() - 0.5) * 14,
        originY: origin.y + (Math.random() - 0.5) * 10,
        dx,
        dy,
        rotation: (Math.random() - 0.5) * 720,
        delay: burstIndex * 60 + Math.random() * 80,
      });
    }
  });

  return particles;
}

function ConfettiParticle({ particle }: { particle: AnimatedParticle }) {
  const translateX = particle.progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, particle.dx * 0.55, particle.dx],
  });
  const translateY = particle.progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, particle.dy * 0.35, particle.dy],
  });
  const opacity = particle.progress.interpolate({
    inputRange: [0, 0.12, 0.65, 1],
    outputRange: [0, 1, 0.85, 0],
  });
  const scale = particle.progress.interpolate({
    inputRange: [0, 0.15, 0.4, 1],
    outputRange: [0.2, 1.15, 1, 0.65],
  });
  const rotate = particle.progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.rotation}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: particle.originX - particle.width / 2,
          top: particle.originY - particle.height / 2,
          width: particle.width,
          height: particle.height,
          backgroundColor: particle.color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
        },
      ]}
    />
  );
}

function StreakConfettiOverlay({ activeKey }: { activeKey: number }) {
  const { width } = useWindowDimensions();
  const [animatedParticles, setAnimatedParticles] = useState<AnimatedParticle[]>([]);

  useEffect(() => {
    if (activeKey === 0) return;

    const specs = buildParticles(width);
    const particles: AnimatedParticle[] = specs.map((spec) => ({
      ...spec,
      progress: new Animated.Value(0),
    }));
    setAnimatedParticles(particles);

    const animations = particles.map((particle) =>
      Animated.timing(particle.progress, {
        toValue: 1,
        duration: DURATION_MS,
        delay: particle.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();

    const cleanup = setTimeout(() => setAnimatedParticles([]), DURATION_MS + 400);
    return () => clearTimeout(cleanup);
  }, [activeKey, width]);

  if (animatedParticles.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {animatedParticles.map((particle) => (
        <ConfettiParticle key={particle.id} particle={particle} />
      ))}
    </View>
  );
}

function StreakToast({ message, toastKey }: { message: string; toastKey: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (toastKey === 0 || !message) return;

    opacity.setValue(0);
    translateY.setValue(-8);

    let holdTimer: ReturnType<typeof setTimeout>;

    const fadeIn = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const fadeOut = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -6,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    fadeIn.start(() => {
      holdTimer = setTimeout(() => fadeOut.start(), TOAST_VISIBLE_MS);
    });

    return () => {
      clearTimeout(holdTimer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [message, opacity, toastKey, translateY]);

  if (toastKey === 0 || !message) return null;

  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    </View>
  );
}

interface StreakConfettiContextValue {
  celebrate: (message: string) => void;
}

const StreakConfettiContext = createContext<StreakConfettiContextValue>({
  celebrate: () => {},
});

export function StreakConfettiProvider({ children }: { children: React.ReactNode }) {
  const [celebration, setCelebration] = useState<{ key: number; message: string }>({
    key: 0,
    message: '',
  });

  const celebrate = useCallback((message: string) => {
    setCelebration((prev) => ({ key: prev.key + 1, message }));
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <StreakConfettiContext.Provider value={value}>
      {children}
      <StreakConfettiOverlay activeKey={celebration.key} />
      <StreakToast message={celebration.message} toastKey={celebration.key} />
    </StreakConfettiContext.Provider>
  );
}

export function useStreakConfetti() {
  return useContext(StreakConfettiContext);
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
    borderRadius: 1,
  },
  toastWrap: {
    position: 'absolute',
    top: 148,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 35,
  },
  toast: {
    backgroundColor: 'rgba(92, 45, 66, 0.92)',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    shadowColor: '#3a3a3a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 320,
  },
  toastText: {
    color: '#f5efe3',
    fontSize: 15,
    letterSpacing: 0.4,
    textAlign: 'center',
    fontWeight: '500',
  },
});
