import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const MUTE_KEY = 'sound_muted';

type SoundId =
  | 'button'
  | 'tick'
  | 'buzz'
  | 'correct'
  | 'wrong'
  | 'next'
  | 'master'
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
  | 'ascendChallenge'
  | 'review'
  | 'practice'
  | 'arena'
  | 'type';

const SOURCES: Record<SoundId, number> = {
  button: require('../assets/ui/button.wav'),
  tick: require('../assets/ui/tick.wav'),
  buzz: require('../assets/ui/buzz.wav'),
  correct: require('../assets/ui/correct.wav'),
  wrong: require('../assets/ui/wrong.wav'),
  next: require('../assets/ui/next.wav'),
  master: require('../assets/ui/master-reed.wav'),
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
  ascendChallenge: require('../assets/ui/tab-ascend-challenge.wav'),
  review: require('../assets/ui/tab-review.wav'),
  practice: require('../assets/ui/tab-practice.wav'),
  arena: require('../assets/ui/tab-arena.wav'),
  type: require('../assets/ui/type.wav'),
};

const VOLUMES: Record<SoundId, number> = {
  button: 0.46,
  tick: 0.28,
  buzz: 0.48,
  correct: 0.42,
  wrong: 0.4,
  next: 0.4,
  master: 0.42,
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
  ascendChallenge: 0.42,
  review: 0.4,
  practice: 0.38,
  arena: 0.4,
  type: 0.22,
};

const players = new Map<SoundId, AudioPlayer>();
/** One intro tick is 3175 samples. The file is 250 of them, end to end. */
const TYPE_MS = (250 * 3175 / 44100) * 1000;
const typePlayers: AudioPlayer[] = [];
let typeActive = 0;
let typeOn = false;
let typeToken = 0;
let typeHandoff: ReturnType<typeof setTimeout> | null = null;
let audioModeReady: Promise<void> | null = null;
let masterToken = 0;
let masterFade: ReturnType<typeof setInterval> | null = null;

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

function clearTypeHandoff() {
  if (typeHandoff) clearTimeout(typeHandoff);
  typeHandoff = null;
}

function pauseUiSounds() {
  typeOn = false;
  typeToken += 1;
  clearTypeHandoff();
  for (const player of players.values()) {
    player.pause();
  }
  for (const player of typePlayers) {
    player.pause();
  }
}

function ensureAudioMode() {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }
}

function play(id: SoundId) {
  if (muted) return;
  ensureAudioMode();
  let current = players.get(id);
  if (!current) {
    current = createAudioPlayer(SOURCES[id]);
    players.set(id, current);
  }
  current.volume = VOLUMES[id];
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

function typePlayer(index: number) {
  let current = typePlayers[index];
  if (!current) {
    current = createAudioPlayer(SOURCES.type);
    current.loop = false;
    current.volume = VOLUMES.type;
    typePlayers[index] = current;
  }
  return current;
}

/**
 * The player restarts by seeking to the beginning when a clip ends, and that seek
 * leaves a gap. A second player is already waiting at the start, and takes over
 * in the silence after a tick so the run never breaks.
 */
function scheduleTypeHandoff(token: number) {
  clearTypeHandoff();
  typeHandoff = setTimeout(() => {
    if (!typeOn || token !== typeToken) return;
    const prev = typePlayer(typeActive);
    typeActive = 1 - typeActive;
    const next = typePlayer(typeActive);
    next.volume = VOLUMES.type;
    next.play();
    prev.pause();
    void prev.seekTo(0);
    scheduleTypeHandoff(token);
  }, TYPE_MS - 30);
}

/** Starts the typing loop. Extra calls while it is already going do nothing. */
export function startTypewriter() {
  if (muted) return;
  ensureAudioMode();
  if (typeOn) {
    typePlayer(0).volume = VOLUMES.type;
    typePlayer(1).volume = VOLUMES.type;
    return;
  }
  typeOn = true;
  const token = ++typeToken;
  typeActive = 0;
  const first = typePlayer(0);
  const second = typePlayer(1);
  first.volume = VOLUMES.type;
  second.volume = VOLUMES.type;
  first.pause();
  second.pause();
  void Promise.all([first.seekTo(0), second.seekTo(0)]).then(() => {
    if (!typeOn || token !== typeToken) return;
    first.play();
    scheduleTypeHandoff(token);
  });
}

/** Stops the typing loop. */
export function stopTypewriter() {
  if (!typeOn && typePlayers.length === 0) return;
  typeOn = false;
  typeToken += 1;
  clearTypeHandoff();
  for (const player of typePlayers) player.pause();
}

/** The Home click, a fourth lower, for the pre-buzz and answer timers. */
export function playTickSound() {
  play('tick');
}

/** Intro ring with a shorter fade, for the BUZZ button. */
export function playBuzzSound() {
  play('buzz');
}

/** Rising chime when an answer is correct. */
export function playCorrectSound() {
  play('correct');
}

/** Falling chime when an answer is wrong. */
export function playWrongSound() {
  play('wrong');
}

/** Short step up for Next and Continue. */
export function playNextSound() {
  play('next');
}

function masterPlayer() {
  let current = players.get('master');
  if (!current) {
    current = createAudioPlayer(SOURCES.master);
    players.set('master', current);
  }
  return current;
}

/**
 * Reed slide for Hold to master. A softer fifth below G4, through G4,
 * to a softer fourth above. Runs from the press until release or mastery.
 */
export function playMasterSound() {
  if (muted) return;
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }
  if (masterFade) {
    clearInterval(masterFade);
    masterFade = null;
  }
  const token = ++masterToken;
  const current = masterPlayer();
  current.volume = VOLUMES.master;
  current.pause();
  void current.seekTo(0).then(() => {
    if (muted || token !== masterToken) return;
    current.play();
  });
}

/** Stops the hold slide when the finger lifts before the star is mastered. */
export function stopMasterSound() {
  masterToken += 1;
  const current = players.get('master');
  if (!current) return;
  if (masterFade) clearInterval(masterFade);
  const start = current.volume;
  let step = 0;
  masterFade = setInterval(() => {
    step += 1;
    current.volume = start * (1 - step / 4);
    if (step < 4) return;
    if (masterFade) clearInterval(masterFade);
    masterFade = null;
    current.pause();
    current.volume = VOLUMES.master;
  }, 8);
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

/** Home F4, Ascend C5, Arena G5, Training D6. Each is a fifth above the last. */
export function playTabSound(tab: 'profile' | 'challenge' | 'review' | 'arena' | 'practice') {
  play(tab);
}

/**
 * Challenge and Review inside Ascend share Ascend's C5.
 * Challenge leans on the fourth below; Review leans on the third above.
 */
export function playAscendPaneSound(pane: 'challenge' | 'review') {
  play(pane === 'challenge' ? 'ascendChallenge' : 'review');
}
