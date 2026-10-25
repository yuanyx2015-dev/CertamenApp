import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const MUTE_KEY = 'sound_muted';

type SoundId =
  | 'button'
  | 'unmute'
  | 'cancel'
  | 'daily'
  | 'set10'
  | 'set20'
  | 'set30'
  | 'set40'
  | 'set50'
  | 'setStart'
  | 'logo'
  | 'profile'
  | 'challenge'
  | 'review'
  | 'practice';

const SOURCES: Record<SoundId, number> = {
  button: require('../assets/ui/button.wav'),
  unmute: require('../assets/ui/unmute.wav'),
  cancel: require('../assets/ui/cancel.wav'),
  daily: require('../assets/ui/daily.wav'),
  set10: require('../assets/ui/set-10.wav'),
  set20: require('../assets/ui/set-20.wav'),
  set30: require('../assets/ui/set-30.wav'),
  set40: require('../assets/ui/set-40.wav'),
  set50: require('../assets/ui/set-50.wav'),
  setStart: require('../assets/ui/set-start.wav'),
  logo: require('../assets/ui/logo.wav'),
  profile: require('../assets/ui/tab-home.wav'),
  challenge: require('../assets/ui/tab-challenge.wav'),
  review: require('../assets/ui/tab-review.wav'),
  practice: require('../assets/ui/tab-practice.wav'),
};

const VOLUMES: Record<SoundId, number> = {
  button: 0.46,
  unmute: 0.46,
  cancel: 0.5,
  daily: 0.46,
  set10: 0.34,
  set20: 0.34,
  set30: 0.34,
  set40: 0.32,
  set50: 0.32,
  setStart: 0.36,
  logo: 0.4,
  profile: 0.42,
  challenge: 0.42,
  review: 0.4,
  practice: 0.38,
};

const players = new Map<SoundId, AudioPlayer>();
let audioModeReady: Promise<void> | null = null;

let muted = false;
let muteTouched = false;
const muteListeners = new Set<(muted: boolean) => void>();

void AsyncStorage.getItem(MUTE_KEY)
  .then((value) => {
    if (muteTouched || value !== '1') return;
    muted = true;
    pauseUiSounds();
    muteListeners.forEach((listener) => listener(true));
  })
  .catch(() => undefined);

export function isSoundMuted() {
  return muted;
}

export function subscribeSoundMuted(listener: (muted: boolean) => void) {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

export function setSoundMuted(next: boolean) {
  muteTouched = true;
  muted = next;
  if (next) pauseUiSounds();
  muteListeners.forEach((listener) => listener(next));
  void AsyncStorage.setItem(MUTE_KEY, next ? '1' : '0').catch(() => undefined);
}

function pauseUiSounds() {
  for (const player of players.values()) {
    player.pause();
  }
}

function play(id: SoundId) {
  if (muted) return;
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }
  let current = players.get(id);
  if (!current) {
    current = createAudioPlayer(SOURCES[id]);
    current.volume = VOLUMES[id];
    players.set(id, current);
  }
  current.pause();
  void current.seekTo(0).then(() => {
    if (muted) return;
    current.play();
  });
}

/** One short click for Home screen buttons. */
export function playButtonSound() {
  play('button');
}

/** The Home click, lowered two semitones. Used when sound is turned back on. */
export function playUnmuteSound() {
  play('unmute');
}

/** Deeper pop for Cancel on Log Out and Delete Account. */
export function playCancelSound() {
  play('cancel');
}

/** Daily Challenge click, centered on E with softer notes beside it. */
export function playDailySound() {
  play('daily');
}

const SET_SIZE_SOUNDS = {
  10: 'set10',
  20: 'set20',
  30: 'set30',
  40: 'set40',
  50: 'set50',
} as const;

/** Questions-per-set clicks: 10 C5, 20 D5, 30 E5, 40 F5, 50 G5, each with a soft 7th, dim 4th, and 5th. */
export function playSetSizeSound(size: keyof typeof SET_SIZE_SOUNDS) {
  play(SET_SIZE_SOUNDS[size]);
}

/** A5, C#6, E5, D5 arpeggio for Start #-question set. */
export function playStartSetArpeggio() {
  play('setStart');
}

/** E5 chime for the CertamenPrep logo and laurel, with a faint fourth below and major third above. */
export function playLogoSound() {
  play('logo');
}

/** Home F4, Challenge C5, Review G5, Practice D6. A faint fourth below and major third above colors each note. */
export function playTabSound(tab: 'profile' | 'challenge' | 'review' | 'practice') {
  play(tab);
}
