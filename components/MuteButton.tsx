import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { isIPad } from '../lib/layout';
import { isSoundMuted, playButtonSound, setSoundMuted, subscribeSoundMuted } from '../lib/buttonSound';

const GOLD = '#c9a569';
const SHADOW = 'rgba(55, 40, 18, 0.4)';

function SpeakerMark({ muted, color }: { muted: boolean; color: string }) {
  return (
    <>
      <Path
        fill={color}
        d="M3.2 9.92Q3.2 9.2 3.92 9.2L5.88 9.2Q6.6 9.2 7.12 8.7L10.68 5.3Q11.2 4.8 11.2 5.52L11.2 18.48Q11.2 19.2 10.68 18.7L7.12 15.3Q6.6 14.8 5.88 14.8L3.92 14.8Q3.2 14.8 3.2 14.08Z"
      />
      {muted ? (
        <Path
          d="M14.6 8.2l6.2 7.6M20.8 8.2l-6.2 7.6"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : (
        <>
          <Path
            d="M15.2 9a3.4 3.4 0 0 1 0 6"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M17.6 6.6a6.4 6.4 0 0 1 0 10.8"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </>
  );
}

function SpeakerIcon({ muted, size }: { muted: boolean; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" style={styles.shadow}>
        <SpeakerMark muted={muted} color={SHADOW} />
      </Svg>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <SpeakerMark muted={muted} color={GOLD} />
      </Svg>
    </View>
  );
}

/** Top-left control. Silences every app sound, including the intro. */
export function MuteButton() {
  const [muted, setMuted] = useState(isSoundMuted);

  useEffect(() => subscribeSoundMuted(setMuted), []);

  return (
    <TouchableOpacity
      style={[styles.button, isIPad && styles.buttonIPad]}
      onPress={() => {
        if (muted) {
          setSoundMuted(false);
          playButtonSound();
        } else {
          setSoundMuted(true);
        }
      }}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Unmute' : 'Mute'}
      accessibilityState={{ selected: muted }}
    >
      <SpeakerIcon muted={muted} size={isIPad ? 44 : 34} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 87,
    left: 26,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 120,
    elevation: 120,
  },
  shadow: {
    position: 'absolute',
    left: -0.6,
    top: 0.6,
  },
  buttonIPad: {
    top: 99,
    left: 34,
    width: 60,
    height: 60,
  },
});
