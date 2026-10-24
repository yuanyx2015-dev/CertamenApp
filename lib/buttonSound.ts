import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let audioModeReady: Promise<void> | null = null;

function sharedPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(require('../assets/ui/button.wav'));
    player.volume = 0.46;
  }
  return player;
}

/** One short click for Home screen buttons. */
export function playButtonSound() {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }
  const current = sharedPlayer();
  current.pause();
  void current.seekTo(0).then(() => {
    current.play();
  });
}
