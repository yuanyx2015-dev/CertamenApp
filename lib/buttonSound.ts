import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

type SoundId = 'button' | 'logo' | 'profile' | 'challenge' | 'review' | 'practice';

const SOURCES: Record<SoundId, number> = {
  button: require('../assets/ui/button.wav'),
  logo: require('../assets/ui/logo.wav'),
  profile: require('../assets/ui/tab-home.wav'),
  challenge: require('../assets/ui/tab-challenge.wav'),
  review: require('../assets/ui/tab-review.wav'),
  practice: require('../assets/ui/tab-practice.wav'),
};

const VOLUMES: Record<SoundId, number> = {
  button: 0.46,
  logo: 0.4,
  profile: 0.42,
  challenge: 0.42,
  review: 0.4,
  practice: 0.38,
};

const players = new Map<SoundId, AudioPlayer>();
let audioModeReady: Promise<void> | null = null;

function play(id: SoundId) {
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
    current.play();
  });
}

/** One short click for Home screen buttons. */
export function playButtonSound() {
  play('button');
}

/** E5 chime for the CertamenPrep logo and laurel, with a faint fourth below and major third above. */
export function playLogoSound() {
  play('logo');
}

/** Home F4, Challenge C5, Review G5, Practice D6. A faint fourth below and major third above colors each note. */
export function playTabSound(tab: 'profile' | 'challenge' | 'review' | 'practice') {
  play(tab);
}
