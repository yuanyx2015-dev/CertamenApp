import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Big green Roman-style checkmark, used as an answer-correct overlay. */
export function RomanCheckmark() {
  return (
    <Svg width="250" height="250" viewBox="0 0 250 250">
      <Path
        d="M 60 130 L 100 180 L 200 60"
        stroke="#7B8866"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M 65 130 L 100 175 L 195 65"
        stroke="#98A885"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
    </Svg>
  );
}

/** Big red Roman-style X, used as an answer-wrong overlay. */
export function RomanCross() {
  return (
    <Svg width="250" height="250" viewBox="0 0 250 250">
      <Path
        d="M 50 50 L 200 200"
        stroke="#8B4C4C"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 200 50 L 50 200"
        stroke="#8B4C4C"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 55 55 L 195 195"
        stroke="#A86464"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <Path
        d="M 195 55 L 55 195"
        stroke="#A86464"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </Svg>
  );
}

export interface FeedbackOverlayHandle {
  /** Fire the spring-in + auto-fade animation. Call once per answer reveal. */
  show: (kind: 'correct' | 'wrong') => void;
}

/**
 * Imperative overlay that renders the Roman checkmark/X with the spring + fade
 * animation used in Practice Mode. The parent owns a ref and calls `.show(...)`
 * when an answer is selected (or auto-resolved by a timeout).
 *
 * Pointer-events are disabled so it never blocks the underlying option grid.
 */
export const FeedbackOverlay = React.forwardRef<FeedbackOverlayHandle, {}>(
  function FeedbackOverlay(_props, ref) {
    const [visible, setVisible] = useState(false);
    const [kind, setKind] = useState<'correct' | 'wrong'>('correct');
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const sequenceRef = useRef<Animated.CompositeAnimation | null>(null);

    const show = useCallback(
      (next: 'correct' | 'wrong') => {
        if (sequenceRef.current) sequenceRef.current.stop();
        setKind(next);
        setVisible(true);
        scaleAnim.setValue(0);
        opacityAnim.setValue(0);

        const seq = Animated.sequence([
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(800),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]);

        sequenceRef.current = seq;
        seq.start(({ finished }) => {
          if (finished) setVisible(false);
        });
      },
      [opacityAnim, scaleAnim]
    );

    React.useImperativeHandle(ref, () => ({ show }), [show]);

    useEffect(() => {
      return () => {
        if (sequenceRef.current) sequenceRef.current.stop();
      };
    }, []);

    if (!visible) return null;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View
          style={kind === 'correct' ? styles.checkmark : styles.cross}
        >
          {kind === 'correct' ? <RomanCheckmark /> : <RomanCross />}
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  checkmark: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B8866',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cross: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B4C4C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
