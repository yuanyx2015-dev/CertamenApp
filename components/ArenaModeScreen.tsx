import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Text } from '../lib/AppText';
import { FitScrollView } from './FitScrollView';
import { ArenaSettingsPane } from './ArenaSettingsPane';
import {
  duckSounds,
  playButtonSound,
  playCancelSound,
  playDailySound,
  playNextSound,
  playStartSetArpeggio,
  playTickSound,
  unduckSounds,
} from '../lib/buttonSound';
import { getCurrentUser } from '../services/authService';
import { getProfileByEmail } from '../services/profileService';
import {
  ARENA_DEFAULT_SETTINGS,
  arenaCreateMatch,
  arenaDequeue,
  arenaDismissForfeitNotice,
  arenaEnqueue,
  arenaJoinMatch,
  arenaMyStats,
  arenaPoll,
  arenaPoolCount,
  arenaReconcile,
  readArenaName,
  writeArenaName,
  type ArenaSettings,
  type ArenaStats,
} from '../services/arenaService';

const HIDE_FORFEIT_KEY = 'arena_hide_forfeit_notice';
/** Restores the size these buttons had before they were scaled down. */
const HUB_BUTTON_PRESS_SCALE = 18 / 16;

function HubMatchButton({
  label,
  kind,
  disabled,
  centerShift,
  onPress,
}: {
  label: string;
  kind: 'gold' | 'outline';
  disabled?: boolean;
  /** How far right the grown button must move so it sits on the screen center. */
  centerShift: number;
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const translateX = scale.interpolate({
    inputRange: [1, HUB_BUTTON_PRESS_SCALE],
    outputRange: [0, centerShift],
  });

  const grow = () => {
    setPressed(true);
    Animated.spring(scale, {
      toValue: HUB_BUTTON_PRESS_SCALE,
      useNativeDriver: true,
      speed: 22,
      bounciness: 3,
    }).start();
  };
  const shrink = () => {
    setPressed(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 3,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={grow}
      onPressOut={shrink}
      onPress={onPress}
      style={[styles.hubPressable, pressed && styles.hubPressableHot]}
    >
      <Animated.View
        style={[
          kind === 'gold' ? styles.createBtn : styles.hubOutlineBtn,
          disabled && styles.createBtnBusy,
          { transform: [{ scale }, { translateX }] },
        ]}
      >
        <Text style={kind === 'gold' ? styles.createBtnText : styles.hubOutlineBtnText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function NameBackIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M9.5 3.2 L5 8 L9.5 12.8"
        stroke="#6a6a6a"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function SettingsGearIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill="#3a3a3a"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
      />
    </Svg>
  );
}

const INK = '#6b4e2a';
const INK_DEEP = '#543c22';
const BAND = '#8a6840';
const CREST = '#a67c3d';
const GOLD = '#c9a961';
const CLOAK = '#7a5730';
const GROUND = '#8a6a3a';
const BLADE = '#f3efe6';
const BLADE_EDGE = '#6a5538';

const THIGH = 12;
const SHIN = 12;
const STRIDE = 5.2;
const HIP_Y = 46.6;
const GROUND_Y = 69.6;
const REAR_HIP = 19.5;
const LEAD_HIP = 26.2;
const MARCH_MS = 1000;
const PLUME =
  'M25.2 16.2 C23.2 10.4 18.2 7.2 13.2 8.2 C16.6 8.2 18.2 10.4 20.6 11.2 C18.2 11.6 17.4 14 20.8 14.4 C20.2 15 23.2 14.6 25.2 17.2 Z';
const PLUME_TALL =
  'M25 15.4 C23.4 6.2 19.2 1.2 15.2 0.4 C17.8 2.8 17.2 6 19.6 7.2 C17.2 7 15.2 9.2 18.2 10.4 C16.4 10.6 17.2 13.2 20.6 13.2 C19.2 12.2 22.2 11.4 24.2 15.8 Z';

type MarcherKind = 'miles' | 'signifer' | 'centurion';

type LegPose = {
  kneeX: number;
  kneeY: number;
  footX: number;
  footY: number;
  plant: number;
};

function solveLeg(hx: number, hy: number, phase: number): LegPose {
  const p = ((phase % 1) + 1) % 1;
  let fx: number;
  let fy: number;
  let plant: number;
  if (p < 0.5) {
    const u = p / 0.5;
    fx = hx + STRIDE * (1 - 2 * u);
    fy = GROUND_Y;
    plant = 1 - u;
  } else {
    const u = (p - 0.5) / 0.5;
    fx = hx + STRIDE * (-1 + 2 * u);
    fy = GROUND_Y - Math.sin(u * Math.PI) * 7.2;
    plant = 0;
  }
  let dx = fx - hx;
  let dy = fy - hy;
  let dist = Math.hypot(dx, dy);
  const max = THIGH + SHIN - 0.15;
  const min = Math.abs(THIGH - SHIN) + 0.4;
  if (dist > max) {
    dx *= max / dist;
    dy *= max / dist;
    dist = max;
  } else if (dist < min) {
    dx *= min / dist;
    dy *= min / dist;
    dist = min;
  }
  const footAngle = Math.atan2(dx, dy);
  const cosA = Math.max(-1, Math.min(1, (THIGH * THIGH + dist * dist - SHIN * SHIN) / (2 * THIGH * dist)));
  // Positive offset puts the knee ahead of the foot, the way a march bends.
  const thigh = footAngle + Math.acos(cosA);
  return {
    kneeX: hx + Math.sin(thigh) * THIGH,
    kneeY: hy + Math.cos(thigh) * THIGH,
    footX: hx + dx,
    footY: hy + dy,
    plant,
  };
}

function MarcherLeg({ hipX, pose }: { hipX: number; pose: LegPose }) {
  return (
    <G>
      <Path
        d={`M${hipX} ${HIP_Y} L${pose.kneeX} ${pose.kneeY}`}
        stroke={INK}
        strokeWidth={4.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M${pose.kneeX} ${pose.kneeY} L${pose.footX} ${pose.footY}`}
        stroke={INK}
        strokeWidth={3.7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M${pose.footX - 1.6} ${pose.footY - 0.2} L${pose.footX + 5.4} ${pose.footY + 0.35} L${pose.footX + 5.2} ${pose.footY + 1.7} L${pose.footX - 1.8} ${pose.footY + 1.35} Z`}
        fill={INK_DEEP}
      />
    </G>
  );
}

function Marcher({ kind, phase }: { kind: MarcherKind; phase: number }) {
  const rear = solveLeg(REAR_HIP, HIP_Y, phase);
  const lead = solveLeg(LEAD_HIP, HIP_Y, phase + 0.5);
  return (
    <G>
      {(
        [
          ['rear', rear],
          ['lead', lead],
        ] as const
      ).map(([name, leg]) =>
        leg.plant < 0.08 ? null : (
          <Path
            key={name}
            d={`M${leg.footX - 7} ${leg.footY + 0.4} h3.2 M${leg.footX - 9.5} ${leg.footY + 2} h4.4`}
            stroke={GROUND}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
            opacity={leg.plant * 0.45}
          />
        )
      )}
      {kind === 'centurion' ? (
        <Path
          d="M19.2 30 C12.4 32.4 10.2 39 13.6 47.2 L18.6 43 C16.4 38.6 16.8 34 20.6 31 Z"
          fill={CLOAK}
        />
      ) : null}
      <MarcherLeg hipX={REAR_HIP} pose={rear} />
      <MarcherLeg hipX={LEAD_HIP} pose={lead} />
      <Path d="M18.2 43.2 L20.4 43.2 L19.8 56.2 L17.6 56.2 Z" fill={INK} />
      <Path d="M21.2 43 L23.5 43 L23.8 57.4 L21.5 57.4 Z" fill={INK} />
      <Path d="M24.4 42.8 L26.7 42.8 L27.8 56.8 L25.5 56.8 Z" fill={INK} />
      <Path d="M27.5 42.6 L29.8 42.4 L31.2 55.4 L28.9 55.6 Z" fill={INK} />
      <Path d="M16.8 28.4 L30.2 27.4 L29.8 43.2 L17.4 44 Z" fill={INK} />
      <Path
        d="M17.6 32.2 H29.2 M17.7 35.8 H29 M17.8 39.2 H28.8"
        stroke={BAND}
        strokeWidth={1.25}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M16.6 41.2 H30.4 V44 H16.4 Z" fill={INK_DEEP} />
      <Path d="M16.2 27.2 C16.2 24.6 21.4 23.6 29.6 24.8 L29.4 28.6 L17.2 29.4 Z" fill={INK} />
      {kind === 'signifer' ? null : (
        <G>
          <Path
            d="M16.2 26.4 H34.6 C36 26.4 36.8 27.6 36.8 29 V49.2 C36.8 51.2 35.6 52.4 34 52.4 H17 C15.4 52.4 14.6 51.2 14.6 49.4 V28.8 C14.6 27.4 15.2 26.4 16.2 26.4 Z"
            fill={INK_DEEP}
          />
          <Path d="M17.4 28.2 H33.6 V50.6 H17.4 Z" fill={INK} />
          <Path d="M25.5 28.4 V50.4" stroke={BAND} strokeWidth={0.9} fill="none" />
          <Circle cx={25.5} cy={39.2} r={3.05} fill={GOLD} />
          <Circle cx={25.5} cy={39.2} r={1.25} fill={INK_DEEP} />
        </G>
      )}
      <Path d="M20.6 25.2 L27.2 24.8 L26.8 28 L20.4 28.4 Z" fill={INK} />
      <Path d={kind === 'centurion' ? PLUME_TALL : PLUME} fill={CREST} />
      <Path
        d="M18.2 24.6 C18.2 17.4 23.4 14.2 29.6 16.4 C33.4 17.8 34.6 21.6 33.2 24.4 L27.6 25.2 L21.2 25.6 Z"
        fill={INK}
      />
      <Path d="M17.4 19.4 L13.2 21.4 L14.6 25.2 L18.4 23.2 Z" fill={INK_DEEP} />
      <Path d="M29.2 18.2 L31.8 19.2 L31.4 22.4 L28.6 21.6 Z" fill={INK_DEEP} />
      {kind === 'miles' ? (
        <G>
          <Path d="M35.2 31 L52 12" stroke={INK_DEEP} strokeWidth={1.3} strokeLinecap="round" fill="none" />
          <Path d="M52 12 L50.8 15.2 L48.9 13.6 Z" fill={INK_DEEP} />
        </G>
      ) : null}
      {kind === 'signifer' ? (
        <G>
          <Path d="M50 43.5 L50 7.2" stroke={INK_DEEP} strokeWidth={1.45} strokeLinecap="round" fill="none" />
          {[15.4, 22.2, 29].map((cy) => (
            <G key={cy}>
              <Circle cx={50} cy={cy} r={2.2} fill={GOLD} />
              <Circle cx={50} cy={cy} r={0.8} fill={INK_DEEP} />
            </G>
          ))}
          <Path d="M50 7 L48.4 3.6 L51.6 3.6 Z" fill={GOLD} />
          <Path d="M28.4 34.6 L48.2 40.4 L49.4 37.6 L30.2 32 Z" fill={INK} />
        </G>
      ) : null}
      {kind === 'centurion' ? (
        <G>
          <Path d="M35.8 43.5 L38.7 43 L38.2 39.4 L34.8 40.5 Z" fill={INK} />
          <Path d="M39.7 41.9 L63 34.9 L64.5 34.2 L62.9 34.3 L39.1 39.7 Z" fill={BLADE} stroke={BLADE_EDGE} strokeWidth={0.35} />
          <Path d="M41 40.4 L60.6 35.2" stroke="#d9d0c2" strokeWidth={0.4} fill="none" />
          <Path d="M39.2 43.1 L40.4 42.8 L39.3 38.6 L38.1 38.9 Z" fill={BLADE_EDGE} />
          <Path d="M34.8 43 L38.8 42 L38.3 40.1 L34.3 41.2 Z" fill="#3c2b1e" />
          <Path d="M35.7 42.8 L35.2 40.9 M36.8 42.5 L36.3 40.7 M37.8 42.2 L37.3 40.4" stroke="#6d5340" strokeWidth={0.45} fill="none" />
          <Circle cx={33.1} cy={42.5} r={1.55} fill="#3c2b1e" />
          <Circle cx={33.1} cy={42.5} r={0.45} fill={GOLD} />
        </G>
      ) : null}
    </G>
  );
}

/** Ink bounds of each figure, so the gap between silhouettes can be equal. */
const FIGURE_BOUNDS: Record<MarcherKind, { left: number; right: number }> = {
  miles: { left: 12.5, right: 38 },
  signifer: { left: 12.5, right: 53 },
  centurion: { left: 10.2, right: 68.5 },
};

const MARCH_KINDS: MarcherKind[] = ['miles', 'miles', 'signifer', 'centurion'];
const FIGURE_GAP = 28;
const MARCH_WIDTH = 270;

const MARCHERS = (() => {
  const widths = MARCH_KINDS.map((kind) => FIGURE_BOUNDS[kind].right - FIGURE_BOUNDS[kind].left);
  const total = widths.reduce((sum, width) => sum + width, 0) + FIGURE_GAP * (MARCH_KINDS.length - 1);
  let cursor = (MARCH_WIDTH - total) / 2;
  return MARCH_KINDS.map((kind, index) => {
    const x = cursor - FIGURE_BOUNDS[kind].left;
    cursor += widths[index] + FIGURE_GAP;
    return { kind, x };
  });
})();

function LegionMarch() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      setPhase(((Date.now() - start) % MARCH_MS) / MARCH_MS);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const step = STRIDE * 2;
  const shift = (phase * step * 2) % step;
  const roadY = GROUND_Y + 2;

  return (
    <View style={styles.legionClip}>
      <Svg width={270} height={82} viewBox="0 0 270 78">
        <Path d={`M0 ${roadY} H270`} stroke={GROUND} strokeWidth={1.25} opacity={0.72} fill="none" />
        {Array.from({ length: 28 }).map((_, i) => {
          const x = i * step - shift;
          return (
            <Path
              key={i}
              d={`M${x} ${GROUND_Y + 4.3} h5.2`}
              stroke={GROUND}
              strokeWidth={1.45}
              strokeLinecap="round"
              fill="none"
              opacity={0.42}
            />
          );
        })}
        {MARCHERS.map((marcher, index) => (
          <G key={`${marcher.kind}-${index}`} transform={`translate(${marcher.x} 0)`}>
            <Marcher kind={marcher.kind} phase={phase} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

export function ArenaModeScreen({
  isGuestMode,
  onStartMatch,
}: {
  isGuestMode?: boolean;
  onStartMatch: (matchId: string) => void;
}) {
  const [name, setName] = useState(readArenaName);
  const [homeName, setHomeName] = useState('');
  const [stats, setStats] = useState<ArenaStats | null>(null);
  const [pane, setPane] = useState<'home' | 'create' | 'join' | 'wait' | 'settings'>('home');
  const [settings, setSettings] = useState<ArenaSettings>(ARENA_DEFAULT_SETTINGS);
  const [available, setAvailable] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForfeit, setShowForfeit] = useState(false);

  const applyName = (value: string) => {
    const next = value.slice(0, 32);
    setName(next);
    writeArenaName(next);
  };

  const loadStats = useCallback(async () => {
    const data = await arenaMyStats();
    setStats(data);
    const hidden = await AsyncStorage.getItem(HIDE_FORFEIT_KEY);
    if (data.pending_forfeit_notice && hidden !== '1') setShowForfeit(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isGuestMode) {
        const user = await getCurrentUser();
        if (user && !user.is_anonymous) {
          let displayName = user.user_metadata?.name || user.email?.split('@')[0] || '';
          if (user.email) {
            const { data: profileData } = await getProfileByEmail(user.email);
            if (profileData) {
              displayName = profileData.display_name || profileData.username || displayName;
            }
          }
          const home = displayName.trim().slice(0, 32);
          if (!cancelled && home) {
            setHomeName(home);
            if (!readArenaName()) applyName(home);
          }
        }
      }
      const rec = await arenaReconcile();
      if (cancelled) return;
      if (rec.match_id) {
        onStartMatch(rec.match_id);
        return;
      }
      await loadStats();
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuestMode, loadStats, onStartMatch]);

  useEffect(() => {
    if (pane !== 'create' && pane !== 'settings') return;
    let cancelled = false;
    void arenaPoolCount(settings).then((pool) => {
      if (cancelled || !pool.ok) return;
      const max = Math.max(5, Math.min(50, pool.available ?? 50));
      setAvailable(pool.available ?? null);
      setSettings((prev) =>
        prev.question_count > max ? { ...prev, question_count: max } : prev
      );
    });
    return () => {
      cancelled = true;
    };
  }, [pane, settings.categories, settings.difficulties, settings.question_count]);

  useEffect(() => {
    if (pane !== 'wait') return;
    const timer = setInterval(() => {
      void arenaPoll().then((row) => {
        if (row.match_id) onStartMatch(row.match_id);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onStartMatch, pane]);

  useEffect(() => {
    if (!showForfeit) return;
    duckSounds();
    return () => unduckSounds();
  }, [showForfeit]);

  const requireName = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      Alert.alert('Choose a name', 'Enter a name.');
      return null;
    }
    writeArenaName(trimmed);
    return trimmed;
  };

  const winRate = () => {
    const games = stats?.games_played ?? 0;
    const wins = stats?.wins ?? 0;
    if (games <= 0) return '—';
    return `${Math.round((wins / games) * 100)}%`;
  };

  const dismissForfeit = async (forever: boolean) => {
    if (forever) await AsyncStorage.setItem(HIDE_FORFEIT_KEY, '1');
    await arenaDismissForfeitNotice();
    setShowForfeit(false);
  };

  const forfeitModal = (
    <Modal visible={showForfeit} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>You left a match</Text>
          <Text style={styles.modalBody}>
            Closing the app or losing the connection counts as a forfeit. That match was recorded as a loss.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              playButtonSound();
              void dismissForfeit(false);
            }}
          >
            <Text style={styles.primaryBtnText}>Understood</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => {
              playCancelSound();
              void dismissForfeit(true);
            }}
          >
            <Text style={styles.textBtnLabel}>Don’t show this again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (pane === 'wait') {
    return (
      <View style={styles.center}>
        <LegionMarch />
        <Text style={styles.waitTitle}>Waiting for an opponent</Text>
        <Text style={styles.waitBody}>The arena stays open until another player steps in.</Text>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            playCancelSound();
            void arenaDequeue();
            setPane('home');
          }}
        >
          <Text style={styles.secondaryBtnText}>Leave the queue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (pane === 'settings') {
    return (
      <FitScrollView contentContainerStyle={styles.settingsScroll} showsVerticalScrollIndicator={false}>
        {forfeitModal}
        <ArenaSettingsPane
          settings={settings}
          available={available}
          onChange={setSettings}
          onBack={() => setPane('create')}
        />
      </FitScrollView>
    );
  }

  return (
    <View style={styles.screen}>
    <FitScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {forfeitModal}
      <View style={styles.settingsRow}>
        <TouchableOpacity
          style={[styles.settingsButton, pane !== 'create' && styles.settingsButtonHidden]}
          disabled={pane !== 'create'}
          onPress={() => {
            playDailySound();
            setPane('settings');
          }}
        >
          <SettingsGearIcon />
          <Text style={styles.settingsButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Arena</Text>
      {!isGuestMode && stats && !stats.guest && (
        <View style={styles.statRow}>
          <Stat label="Wins" value={String(stats.wins ?? 0)} />
          <Stat label="Games" value={String(stats.games_played ?? 0)} />
          <Stat label="Win rate" value={winRate()} />
          <Stat label="Ties" value={String(stats.ties ?? 0)} />
          <Stat label="Forfeits" value={String(stats.forfeits ?? 0)} />
        </View>
      )}
      {isGuestMode && (
        <Text style={styles.guestNote}>Sign in from the logo if you want a record kept.</Text>
      )}

      <View style={styles.nameBlock}>
        <Text style={[styles.label, styles.nameLabel]}>Name in the arena</Text>
        <View style={styles.nameRow}>
          <TextInput
            value={name}
            onChangeText={applyName}
            placeholder={isGuestMode ? 'Choose a name' : 'Your name'}
            placeholderTextColor="#a89880"
            maxLength={32}
            style={styles.input}
          />
          {!isGuestMode && !!homeName && (
            <TouchableOpacity
              style={styles.nameBack}
              onPress={() => {
                playTickSound();
                applyName(homeName);
              }}
              accessibilityRole="button"
              accessibilityLabel="Use your home name"
            >
              <NameBackIcon />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {pane === 'home' && (
        <View style={styles.hubActionsRow}>
        <View style={styles.hubActions}>
          <HubMatchButton
            label="Create a match"
            kind="gold"
            centerShift={!isGuestMode && homeName ? 22 : 0}
            onPress={() => {
              playButtonSound();
              setPane('create');
            }}
          />
          <HubMatchButton
            label="Join a match"
            kind="outline"
            centerShift={!isGuestMode && homeName ? 22 : 0}
            onPress={() => {
              playTickSound();
              setPane('join');
            }}
          />
          <HubMatchButton
            label="Find a random match"
            kind="outline"
            disabled={busy}
            centerShift={!isGuestMode && homeName ? 22 : 0}
            onPress={() => {
              const trimmed = requireName();
              if (!trimmed) return;
              playNextSound();
              setBusy(true);
              void arenaEnqueue(trimmed).then((row) => {
                setBusy(false);
                if (!row.ok) {
                  Alert.alert('Arena', row.error ?? 'Could not join the queue.');
                  return;
                }
                if (row.match_id) onStartMatch(row.match_id);
                else setPane('wait');
              });
            }}
          />
        </View>
        {!isGuestMode && !!homeName ? <View style={styles.hubActionsSpacer} /> : null}
        </View>
      )}

      {pane === 'join' && (
        <View style={styles.actions}>
          <Text style={styles.label}>Room code</Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^IVXLCDM]/g, '').slice(0, 7))}
            autoCapitalize="characters"
            placeholder="Enter the host's code"
            placeholderTextColor="#a89880"
            style={styles.input}
          />
          <TouchableOpacity
            style={styles.goldBtn}
            disabled={busy}
            onPress={() => {
              const trimmed = requireName();
              if (!trimmed) return;
              playStartSetArpeggio();
              setBusy(true);
              void arenaJoinMatch(code, trimmed).then((row) => {
                setBusy(false);
                if (!row.ok || !row.match_id) {
                  Alert.alert('Arena', row.error ?? 'Could not join.');
                  return;
                }
                onStartMatch(row.match_id);
              });
            }}
          >
            <Text style={styles.goldBtnText}>Enter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => {
              playCancelSound();
              setPane('home');
            }}
          >
            <Text style={styles.textBtnLabel}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {pane === 'create' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.goldBtn}
            disabled={busy}
            onPress={() => {
              const trimmed = requireName();
              if (!trimmed) return;
              playStartSetArpeggio();
              setBusy(true);
              void arenaCreateMatch(trimmed, settings).then((row) => {
                setBusy(false);
                if (!row.ok || !row.match_id) {
                  Alert.alert('Arena', row.error ?? 'Could not create the match.');
                  return;
                }
                onStartMatch(row.match_id);
              });
            }}
          >
            {busy ? (
              <ActivityIndicator color="#f5efe3" />
            ) : (
              <Text style={styles.goldBtnText}>Open the room</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => {
              playCancelSound();
              setPane('home');
            }}
          >
            <Text style={styles.textBtnLabel}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </FitScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scroll: {
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
    width: '100%',
  },
  settingsScroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: '#f0e6d3',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsButtonHidden: {
    opacity: 0,
  },
  settingsButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.25,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: {
    color: '#3a3a3a',
    fontSize: 25,
    letterSpacing: 0.3,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 0,
  },
  guestNote: { textAlign: 'center', color: '#6a6a6a', marginBottom: 4, fontSize: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, color: '#6a6a6a', fontWeight: '600' },
  statLabel: { fontSize: 13, color: '#6a6a6a', marginTop: 2, textAlign: 'center' },
  nameBlock: { gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameBack: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0e6d3',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
  },
  label: { color: '#3a3a3a', fontSize: 17, marginBottom: 0, marginTop: 0, letterSpacing: 0.2 },
  nameLabel: { marginLeft: 1 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#3a3a3a',
    backgroundColor: 'rgba(255,255,255,0.35)',
    fontSize: 18,
    flex: 1,
  },
  actions: { marginTop: 8, gap: 10 },
  hubActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  hubActions: {
    flex: 1,
    gap: 16,
  },
  hubPressable: {
    width: '100%',
  },
  hubPressableHot: {
    zIndex: 2,
  },
  hubActionsSpacer: {
    width: 36,
  },
  createBtn: {
    backgroundColor: '#c9a961',
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.26,
  },
  hubOutlineBtn: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 58, 0.7)',
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: 'center',
  },
  hubOutlineBtnText: {
    color: '#4a3728',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.26,
  },
  createBtnBusy: { opacity: 0.6 },
  primaryBtn: {
    backgroundColor: '#8a6a3a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#f5efe3', fontSize: 20, fontWeight: '600' },
  goldBtn: {
    backgroundColor: '#c9a961',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'center',
  },
  goldBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.26,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 58, 0.7)',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  secondaryBtnText: {
    color: '#4a3728',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.26,
  },
  textBtn: { alignItems: 'center', paddingVertical: 8 },
  textBtnLabel: { color: '#8a6a3a', fontSize: 14 },
  legionClip: {
    height: 88,
    width: 270,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  waitTitle: { fontSize: 22, color: '#4a3728', fontWeight: '600', textAlign: 'center' },
  waitBody: { color: '#8a6a3a', textAlign: 'center', marginVertical: 10, marginBottom: 22 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(40, 28, 16, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#f5efe3',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.6)',
  },
  modalTitle: { fontSize: 20, color: '#4a3728', fontWeight: '600', marginBottom: 8 },
  modalBody: { color: '#6b5b45', fontSize: 15, lineHeight: 21, marginBottom: 16 },
});
