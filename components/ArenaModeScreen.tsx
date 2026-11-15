import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { G, Path } from 'react-native-svg';
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

const LEGION_INK = '#8a6a3a';

/** Four in-place march poses. Lead leg reaches forward, then the other. */
const LEGION_POSES = [
  {
    rear: 'M 15 40 L 18 40 L 9 58 L 5 58 Z',
    lead: 'M 20 40 L 23 40 L 32 57 L 27 58 Z',
    bob: 0,
  },
  {
    rear: 'M 15 40 L 18 40 L 16 58 L 12 58 Z',
    lead: 'M 20 40 L 23 40 L 25 51 L 21 51 Z',
    bob: -1.4,
  },
  {
    rear: 'M 15 40 L 18 40 L 28 58 L 24 58 Z',
    lead: 'M 20 40 L 23 40 L 12 57 L 8 57 Z',
    bob: 0,
  },
  {
    rear: 'M 15 40 L 18 40 L 17 51 L 13 51 Z',
    lead: 'M 20 40 L 23 40 L 24 58 L 20 58 Z',
    bob: -1.4,
  },
];

function LegionMarch() {
  const ground = React.useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ground, {
        toValue: -16,
        duration: 320,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    const id = setInterval(() => setStep((s) => (s + 1) % LEGION_POSES.length), 180);
    return () => {
      loop.stop();
      clearInterval(id);
    };
  }, [ground]);

  const pose = LEGION_POSES[step];

  return (
    <View style={styles.legionClip}>
      <Svg width={270} height={74} viewBox="0 0 270 74">
        {Array.from({ length: 5 }).map((_, i) => (
          <G key={i} transform={`translate(${8 + i * 52}, ${pose.bob})`}>
            <Path d="M 16 8 L 20 1 L 31 6 L 27 11 L 18 8 Z" fill={LEGION_INK} />
            <Path d="M 12 13 C 12 8 18 7 23 8 C 29 9 31 13 30 17 L 14 17 C 12 17 12 15 12 13 Z" fill={LEGION_INK} />
            <Path d="M 13 17 L 26 17 L 25 36 L 14 36 Z" fill={LEGION_INK} />
            <Path d="M 22 20 L 34 21 C 36 22 36 24 36 27 L 36 41 C 36 43 34 44 32 44 L 22 43 Z" fill={LEGION_INK} />
            <Path d="M 14 35 L 25 35 L 26 42 L 23 38 L 21 43 L 18 38 L 16 43 L 13 38 Z" fill={LEGION_INK} />
            <Path d="M 23 18 L 31 3 L 33 4 L 25 19 Z" fill={LEGION_INK} />
            <Path d={pose.rear} fill={LEGION_INK} />
            <Path d={pose.lead} fill={LEGION_INK} />
          </G>
        ))}
      </Svg>
      <Animated.View style={[styles.legionGround, { transform: [{ translateX: ground }] }]}>
        <Svg width={512} height={12} viewBox="0 0 512 12">
          <Path d="M 0 1 H 512" stroke={LEGION_INK} strokeWidth={1.3} opacity={0.7} />
          {Array.from({ length: 32 }).map((_, i) => (
            <Path
              key={i}
              d={`M ${i * 16} 5 H ${i * 16 + 7}`}
              stroke={LEGION_INK}
              strokeWidth={1.7}
              opacity={0.45}
            />
          ))}
        </Svg>
      </Animated.View>
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
    height: 86,
    width: 270,
    overflow: 'hidden',
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  legionGround: {
    position: 'absolute',
    left: 0,
    bottom: 2,
    height: 12,
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
