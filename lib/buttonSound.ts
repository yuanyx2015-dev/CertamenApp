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
  | 'type'
  | 'slide';

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
  slide: require('../assets/ui/slide.wav'),
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
  slide: 0.2,
};

const players = new Map<SoundId, AudioPlayer>();
const oneShotVolumes = new Map<AudioPlayer, number>();
const clickPairs = new Map<SoundId, [AudioPlayer, AudioPlayer]>();
const clickIndex = new Map<SoundId, number>();
/** One intro tick is 3175 samples. The file is 250 of them, end to end. */
const TYPE_MS = (250 * 3175 / 44100) * 1000;
const typePlayers: AudioPlayer[] = [];
let typeActive = 0;
let typeOn = false;
let typeToken = 0;
let typeHandoff: ReturnType<typeof setTimeout> | null = null;
let slideOn = false;
let audioModeReady: Promise<void> | null = null;
let masterToken = 0;
let masterFade: ReturnType<typeof setInterval> | null = null;

let muted = false;
let muteTouched = false;
let duckDepth = 0;
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

/** Pauses the typing tick while a popup is up. Other sounds sit quieter underneath it. */
export function duckSounds() {
  duckDepth += 1;
  if (duckDepth > 1) return;
  for (const player of typePlayers) player.pause();
  for (const [player, volume] of oneShotVolumes) {
    player.volume = volume * 0.35;
  }
}

/** Brings the typing tick back after the last popup closes. */
export function unduckSounds() {
  duckDepth = Math.max(0, duckDepth - 1);
  if (duckDepth > 0) return;
  for (const [id, player] of players) {
    player.volume = VOLUMES[id];
  }
  for (const [player, volume] of oneShotVolumes) {
    player.volume = volume;
  }
  if (!typeOn || muted) return;
  const current = typePlayers[typeActive];
  if (!current) return;
  current.volume = VOLUMES.type;
  current.play();
}

function clearTypeHandoff() {
  if (typeHandoff) clearTimeout(typeHandoff);
  typeHandoff = null;
}

function pauseUiSounds() {
  typeOn = false;
  slideOn = false;
  typeToken += 1;
  clearTypeHandoff();
  for (const player of players.values()) {
    player.pause();
  }
  for (const player of oneShotVolumes.keys()) {
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

function clickPair(id: SoundId): [AudioPlayer, AudioPlayer] {
  let pair = clickPairs.get(id);
  if (!pair) {
    const make = () => {
      const player = createAudioPlayer(SOURCES[id]);
      player.volume = VOLUMES[id];
      oneShotVolumes.set(player, VOLUMES[id]);
      return player;
    };
    pair = [make(), make()];
    clickPairs.set(id, pair);
    clickIndex.set(id, 0);
    players.set(id, pair[0]);
    void pair[0].seekTo(0);
    void pair[1].seekTo(0);
  }
  return pair;
}

function play(id: SoundId) {
  if (muted) return;
  ensureAudioMode();
  const pair = clickPair(id);
  const index = clickIndex.get(id) ?? 0;
  const player = pair[index];
  player.volume = VOLUMES[id];
  player.play();
  const idle = 1 - index;
  clickIndex.set(id, idle);
  players.set(id, pair[idle]);
  void pair[idle].seekTo(0);
}

/** One short click for Home screen buttons. */
export function playButtonSound() {
  play('button');
}

/** Builds the click ahead of time so the first press does not wait on the player. */
export function warmButtonSound() {
  clickPair('button');
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
    if (duckDepth === 0 && !muted) next.play();
    else next.pause();
    prev.pause();
    void prev.seekTo(0);
    scheduleTypeHandoff(token);
  }, TYPE_MS - 30);
}

/** Starts the typing loop. Extra calls while it is already going do nothing. */
export function startTypewriter() {
  if (muted) return;
  ensureAudioMode();
  if (typeOn) return;
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
    if (duckDepth === 0) first.play();
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

/** Deeper pop for cancel actions outside the account dialogs. */
export function playCancelSound() {
  play('cancel');
}

function slidePlayer() {
  let current = players.get('slide');
  if (!current) {
    current = createAudioPlayer(SOURCES.slide);
    current.loop = true;
    current.volume = VOLUMES.slide;
    oneShotVolumes.set(current, VOLUMES.slide);
    players.set('slide', current);
    void current.seekTo(0);
  }
  return current;
}

/** Soft noise while the delete slider is moving. */
export function startSlideSound() {
  if (muted || slideOn) return;
  ensureAudioMode();
  slideOn = true;
  const current = slidePlayer();
  current.volume = VOLUMES.slide;
  current.play();
}

/** Stops the delete slider as soon as the finger lifts. */
export function stopSlideSound() {
  if (!slideOn && !players.get('slide')) return;
  slideOn = false;
  const current = players.get('slide');
  if (!current) return;
  current.pause();
  void current.seekTo(0);
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

const COUNT_PITCHES = [10, 20, 30, 40, 50] as const;

/** The question-count stepper. The pitch follows the number. */
export function playCountPitch(count: number) {
  const nearest = COUNT_PITCHES.reduce((best, size) =>
    Math.abs(size - count) < Math.abs(best - count) ? size : best
  );
  playSetSizeSound(nearest);
}

/** Easy, Medium, and Hard. Medium sits between the other two. */
export function playDifficultySound(id: string) {
  if (id === 'easy') playTickSound();
  else if (id === 'hard') playNextSound();
  else playSetSizeSound(30);
}

/** One pitch per category, in list order. The last one uses the Settings chime. */
export function playCategorySound(index: number) {
  const pitch = COUNT_PITCHES[index];
  if (pitch) playSetSizeSound(pitch);
  else playDailySound();
}

/** Ascend's C5 as a soft trumpet: da, then dadaaa on a C dominant chord, with a fading echo. */
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
