import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '../lib/AppText';
import { FitScrollView } from './FitScrollView';
import {
  playBuzzSound,
  playCorrectSound,
  playNextSound,
  playWrongSound,
  startTypewriter,
  stopTypewriter,
} from '../lib/buttonSound';
import {
  arenaAnswer,
  arenaAnswerExpired,
  arenaBuzz,
  arenaDismissForfeitNotice,
  arenaHeartbeat,
  arenaLeave,
  arenaMyStats,
  arenaOpenLive,
  arenaReadingExpired,
  arenaRematch,
  arenaReview,
  arenaStartMatch,
  arenaTapNext,
  arenaToScoreboard,
  arenaView,
  subscribeArenaMatch,
  type ArenaReviewQuestion,
  type ArenaView,
} from '../services/arenaService';

const HIDE_FORFEIT_KEY = 'arena_hide_forfeit_notice';

function resultLine(view: ArenaView): string {
  const me = view.role;
  if (view.result === 'tie') return 'The round is a tie.';
  if (view.result === 'double_forfeit') return 'Both players left the arena.';
  if (view.result === 'host_forfeit') {
    return me === 'host' ? 'You forfeited.' : `${view.host_name} forfeited. You take the win.`;
  }
  if (view.result === 'guest_forfeit') {
    return me === 'guest' ? 'You forfeited.' : `${view.guest_name ?? 'Your rival'} forfeited. You take the win.`;
  }
  if (view.result === 'host_win') return me === 'host' ? 'You win.' : `${view.host_name} wins.`;
  if (view.result === 'guest_win') return me === 'guest' ? 'You win.' : `${view.guest_name ?? 'Your rival'} wins.`;
  return '';
}

export function ArenaMatchScreen({
  matchId,
  onExit,
}: {
  matchId: string;
  onExit: () => void;
}) {
  const [view, setView] = useState<ArenaView | null>(null);
  const [shown, setShown] = useState(0);
  const [tick, setTick] = useState(0);
  const [lockNote, setLockNote] = useState(false);
  const [questions, setQuestions] = useState<ArenaReviewQuestion[]>([]);
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [showForfeit, setShowForfeit] = useState(false);
  const [mark, setMark] = useState<'correct' | 'wrong' | null>(null);
  const viewRef = useRef<ArenaView | null>(null);
  const offsetRef = useRef(0);
  const guards = useRef({ live: false, read: false, answer: false, board: false, next: false });
  const wobble = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const lastQuestion = useRef(0);

  useEffect(() => {
    const len = view?.question_text?.length ?? 0;
    const reading = view?.phase === 'reading' || view?.phase === 'rebound';
    if (view && reading && shown < len) startTypewriter();
    else stopTypewriter();
  }, [shown, view]);

  const refresh = useCallback(async () => {
    const next = await arenaView(matchId);
    if (!next.ok) return;
    offsetRef.current = Date.parse(next.server_now) - Date.now();
    viewRef.current = next;
    setView(next);
  }, [matchId]);

  useEffect(() => {
    void refresh();
    const unsub = subscribeArenaMatch(matchId, () => void refresh());
    const poll = setInterval(() => void refresh(), 1000);
    const beat = setInterval(() => {
      void arenaHeartbeat(matchId).then((row) => {
        if (row.event === 'cancelled') onExit();
        else void refresh();
      });
    }, 5000);
    return () => {
      stopTypewriter();
      unsub();
      clearInterval(poll);
      clearInterval(beat);
    };
  }, [matchId, onExit, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const current = viewRef.current;
      if (state !== 'background' || !current) return;
      if (current.status === 'lobby') {
        void arenaLeave(matchId).then(() => onExit());
      } else if (current.status === 'countdown' || current.status === 'live') {
        void arenaLeave(matchId).then(() => refresh());
      }
    });
    return () => sub.remove();
  }, [matchId, onExit, refresh]);

  useEffect(() => {
    if (view?.phase !== 'final') return;
    void arenaReview(matchId).then((row) => {
      if (row.ok && row.questions) setQuestions(row.questions);
    });
    void (async () => {
      const stats = await arenaMyStats();
      const hidden = await AsyncStorage.getItem(HIDE_FORFEIT_KEY);
      if (stats.pending_forfeit_notice && hidden !== '1') setShowForfeit(true);
    })();
  }, [matchId, view?.phase, view?.result]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = viewRef.current;
      if (!current) return;
      const now = Date.now();

      if (current.phase === 'countdown' && current.countdown_at && !guards.current.live) {
        const elapsed = now + offsetRef.current - Date.parse(current.countdown_at);
        setTick((n) => n + 1);
        if (elapsed >= 3000) {
          guards.current.live = true;
          void arenaOpenLive(matchId).then(() => refresh());
        }
      }

      if (!current.question_text) return;
      const len = current.question_text.length;
      let count = 0;
      if (current.phase === 'answering') {
        count = Math.min(len, current.buzz_char ?? 0);
      } else if (
        current.phase === 'reveal' ||
        current.phase === 'scoreboard' ||
        current.phase === 'final'
      ) {
        count = len;
      } else if (
        (current.phase === 'reading' || current.phase === 'rebound') &&
        current.stream_anchor
      ) {
        const anchor = Date.parse(current.stream_anchor);
        const elapsed = now + offsetRef.current - anchor;
        count =
          current.stream_from +
          Math.floor(Math.max(0, elapsed) / Math.max(8, current.stream_ms));
        count = Math.max(0, Math.min(len, count));
        if (count >= len) {
          const doneAt = anchor + (len - current.stream_from) * current.stream_ms;
          const left = current.pre_buzz_seconds - Math.floor((now + offsetRef.current - doneAt) / 1000);
          if (left <= 0 && !guards.current.read) {
            guards.current.read = true;
            void arenaReadingExpired(matchId).then(() => refresh());
          }
        }
      }
      setShown(count);
      if (
        current.phase === 'answering' ||
        current.phase === 'scoreboard' ||
        current.phase === 'reading' ||
        current.phase === 'rebound'
      ) {
        setTick((n) => n + 1);
      }

      if (current.phase === 'answering' && current.buzz_role === current.role && current.buzz_at) {
        const end = Date.parse(current.buzz_at) + current.answer_seconds * 1000;
        if (now + offsetRef.current >= end && !guards.current.answer) {
          guards.current.answer = true;
          void arenaAnswerExpired(matchId).then(() => refresh());
        }
      }

      if (current.phase === 'reveal' && !guards.current.board) {
        guards.current.board = true;
        setTimeout(() => {
          void arenaToScoreboard(matchId).then(() => refresh());
        }, 1400);
      }

      if (current.phase === 'scoreboard' && current.next_deadline && !guards.current.next) {
        const mine = current.role === 'host' ? current.host_next : current.guest_next;
        const theirs = current.role === 'host' ? current.guest_next : current.host_next;
        if (theirs && !mine && now + offsetRef.current >= Date.parse(current.next_deadline)) {
          guards.current.next = true;
          void arenaTapNext(matchId).then(() => refresh());
        }
      }
    }, 80);
    return () => clearInterval(timer);
  }, [matchId, refresh]);

  useEffect(() => {
    guards.current.read = false;
    guards.current.answer = false;
    guards.current.board = false;
    guards.current.next = false;
    if (view?.phase === 'countdown') guards.current.live = false;
  }, [view?.state_version, view?.phase]);

  useEffect(() => {
    if (!view || view.phase !== 'reading') return;
    if (lastQuestion.current === view.question_number) return;
    lastQuestion.current = view.question_number;
    fade.setValue(0);
    wobble.setValue(6);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(wobble, { toValue: -4, duration: 160, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 3, duration: 160, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
  }, [fade, view, wobble]);

  useEffect(() => {
    if (view?.resolution?.outcome === 'correct') {
      setMark('correct');
      playCorrectSound();
    } else if (view?.resolution?.outcome === 'wrong' || view?.resolution?.outcome === 'miss') {
      setMark(view.resolution.outcome === 'miss' ? null : 'wrong');
      if (view.resolution.outcome === 'wrong') playWrongSound();
    }
  }, [view?.state_version]);

  if (!view) {
    return (
      <View style={styles.center}>
        <Text style={styles.quiet}>Opening the arena…</Text>
      </View>
    );
  }

  const myScore = view.role === 'host' ? view.host_score : view.guest_score;
  const theirScore = view.role === 'host' ? view.guest_score : view.host_score;
  const theirName = view.role === 'host' ? view.guest_name : view.host_name;
  const theyAnswered = view.role === 'host' ? view.guest_answered : view.host_answered;
  const theyHere = view.role === 'host' ? view.guest_here : view.host_here;
  const ready = (view.host_rematch ? 1 : 0) + (view.guest_rematch ? 1 : 0);
  const text = (view.question_text ?? '').slice(0, shown);
  const selecting =
    view.phase === 'answering' && view.buzz_role && view.buzz_role !== view.role;
  const answerLeft =
    view.buzz_at && selecting
      ? Math.max(
          0,
          Math.ceil(
            (Date.parse(view.buzz_at) +
              view.answer_seconds * 1000 -
              (Date.now() + offsetRef.current)) /
              1000
          )
        )
      : view.answer_seconds;
  const showOptions =
    (view.phase === 'answering' && view.buzz_role === view.role && view.options) ||
    ((view.phase === 'reveal' || view.phase === 'scoreboard') &&
      view.resolution?.options &&
      view.resolution.correct_index != null);
  const optionList =
    view.phase === 'answering' ? view.options : view.resolution?.options ?? null;
  const correctIndex = view.resolution?.correct_index;

  const countdownMark = () => {
    if (!view.countdown_at || tick < 0) return 3;
    const elapsed = Date.now() + offsetRef.current - Date.parse(view.countdown_at);
    if (elapsed < 1000) return 3;
    if (elapsed < 2000) return 2;
    return 1;
  };

  return (
    <View style={styles.root}>
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
                void arenaDismissForfeitNotice();
                setShowForfeit(false);
              }}
            >
              <Text style={styles.primaryBtnText}>Understood</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textBtn}
              onPress={() => {
                void AsyncStorage.setItem(HIDE_FORFEIT_KEY, '1');
                void arenaDismissForfeitNotice();
                setShowForfeit(false);
              }}
            >
              <Text style={styles.textBtnLabel}>Don’t show this again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {view.phase === 'lobby' && (
        <View style={styles.center}>
          <Text style={styles.code}>{view.code}</Text>
          <Text style={styles.quiet}>
            {view.guest_name
              ? `${view.guest_name} has entered.`
              : 'Share this code. It belongs to this room only.'}
          </Text>
          {view.role === 'host' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !view.guest_name && styles.disabled]}
              disabled={!view.guest_name}
              onPress={() => void arenaStartMatch(matchId).then(() => refresh())}
            >
              <Text style={styles.primaryBtnText}>Start the match</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.quiet}>Waiting for the host to start.</Text>
          )}
          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => void arenaLeave(matchId).then(() => onExit())}
          >
            <Text style={styles.textBtnLabel}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}

      {view.phase === 'countdown' && (
        <View style={styles.center}>
          <View style={styles.romanRow}>
            {Array.from({ length: countdownMark() }).map((_, i) => (
              <Text key={i} style={styles.romanI}>
                I
              </Text>
            ))}
          </View>
        </View>
      )}

      {(view.phase === 'reading' ||
        view.phase === 'answering' ||
        view.phase === 'rebound' ||
        view.phase === 'reveal') && (
        <View style={styles.play}>
          <Text style={styles.progress}>
            Question {view.question_number} / {view.question_count}
          </Text>
          <Text style={styles.scores}>
            You {myScore} · {theirName ?? 'Rival'} {theirScore}
          </Text>
          {selecting && (
            <Text style={styles.rivalLine}>
              Your rival is choosing · {answerLeft}s
            </Text>
          )}
          {mark === 'correct' && view.phase === 'reveal' && (
            <Text style={styles.good}>✓</Text>
          )}
          {mark === 'wrong' && (view.phase === 'rebound' || view.phase === 'reveal') && (
            <Text style={styles.bad}>✕</Text>
          )}
          <Animated.View style={{ opacity: fade, transform: [{ translateY: wobble }] }}>
            <FitScrollView style={styles.questionScroll}>
              <Text style={styles.question}>
                {text}
                {(view.phase === 'reading' || view.phase === 'rebound') &&
                  shown < (view.question_text?.length ?? 0) && <Text style={styles.cursor}>|</Text>}
              </Text>
            </FitScrollView>
          </Animated.View>

          {(view.phase === 'reading' || view.phase === 'rebound') && (
            <View>
              <TouchableOpacity
                style={[styles.buzz, view.buzz_locked && styles.buzzLocked]}
                onPress={() => {
                  if (view.buzz_locked) {
                    setLockNote(true);
                    setTimeout(() => setLockNote(false), 2500);
                    return;
                  }
                  playBuzzSound();
                  void arenaBuzz(matchId).then(() => refresh());
                }}
              >
                <Text style={styles.buzzText}>BUZZ</Text>
              </TouchableOpacity>
              {lockNote && (
                <Text style={styles.lockNote}>You already buzzed on this question.</Text>
              )}
            </View>
          )}

          {showOptions && optionList && (
            <View style={styles.options}>
              {optionList.map((option, index) => {
                const reveal = view.phase !== 'answering' && correctIndex != null;
                const isCorrect = reveal && index === correctIndex;
                return (
                  <Pressable
                    key={`${option}-${index}`}
                    style={[styles.option, isCorrect && styles.optionCorrect]}
                    disabled={view.phase !== 'answering'}
                    onPress={() => void arenaAnswer(matchId, index).then(() => refresh())}
                  >
                    <Text style={[styles.optionText, isCorrect && styles.optionTextCorrect]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.rivalCorner}>
            <Text style={styles.rivalName} numberOfLines={1}>
              {theirName ?? 'Rival'}
            </Text>
            <Text style={styles.rivalState}>{theyAnswered ? 'Answered' : 'Listening'}</Text>
          </View>
          <TouchableOpacity
            style={styles.forfeit}
            onPress={() => void arenaLeave(matchId).then(() => refresh())}
          >
            <Text style={styles.textBtnLabel}>Forfeit</Text>
          </TouchableOpacity>
        </View>
      )}

      {view.phase === 'scoreboard' && (
        <View style={styles.center}>
          <Text style={styles.progress}>
            After question {view.question_number}
          </Text>
          <Text style={styles.bigScore}>You {myScore}</Text>
          <Text style={styles.bigScore}>
            {theirName ?? 'Rival'} {theirScore}
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              playNextSound();
              void arenaTapNext(matchId).then(() => refresh());
            }}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
          </TouchableOpacity>
          {view.next_deadline && (
            <Text style={styles.quiet}>
              {(view.role === 'host' ? view.host_next : view.guest_next) &&
              !(view.role === 'host' ? view.guest_next : view.host_next)
                ? 'Waiting for your rival. The round moves on in 15 seconds.'
                : ''}
            </Text>
          )}
        </View>
      )}

      {view.phase === 'final' && (
        <FitScrollView contentContainerStyle={styles.finalScroll}>
          <Text style={styles.title}>{resultLine(view)}</Text>
          <Text style={styles.bigScore}>You {myScore}</Text>
          <Text style={[styles.bigScore, !theyHere && styles.absent]}>
            {theirName ?? 'Rival'} {theirScore}
            {!theyHere ? '  not available' : ''}
          </Text>
          {theyHere && (
            <Text style={styles.quiet}>{ready}/2 gladiators ready</Text>
          )}
          {theyHere && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void arenaRematch(matchId).then(() => refresh())}
            >
              <Text style={styles.primaryBtnText}>Play again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => void arenaLeave(matchId).then(() => onExit())}
          >
            <Text style={styles.secondaryBtnText}>Leave the match</Text>
          </TouchableOpacity>
          {questions.map((q, index) => {
            const open = openQ === index;
            const first = q.question_text.split('\n')[0];
            return (
              <Pressable key={index} style={styles.qRow} onPress={() => setOpenQ(open ? null : index)}>
                <Text style={styles.qChevron}>{open ? '⌄' : '⌃'}</Text>
                {open ? (
                  <View style={styles.qBody}>
                    <Text style={styles.question}>{q.question_text}</Text>
                    {q.choices.map((choice, ci) => (
                      <Text
                        key={ci}
                        style={[styles.choiceLine, choice.correct && styles.optionTextCorrect]}
                      >
                        {choice.text}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.qLine} numberOfLines={1}>
                    {first}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </FitScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  play: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  title: { fontSize: 26, color: '#4a3728', fontWeight: '600', textAlign: 'center' },
  code: { fontSize: 42, letterSpacing: 4, color: '#4a3728', fontWeight: '600' },
  quiet: { color: '#8a6a3a', textAlign: 'center', fontSize: 15 },
  progress: { textAlign: 'center', color: '#6b5b45', marginBottom: 4 },
  scores: { textAlign: 'center', color: '#4a3728', marginBottom: 8 },
  bigScore: { fontSize: 22, color: '#4a3728', fontWeight: '600' },
  questionScroll: { maxHeight: 220 },
  question: { fontSize: 18, lineHeight: 26, color: '#3d2e22', textAlign: 'center' },
  cursor: { color: '#c9a961' },
  buzz: {
    alignSelf: 'center',
    marginTop: 16,
    backgroundColor: '#8a6a3a',
    borderRadius: 40,
    paddingVertical: 16,
    paddingHorizontal: 36,
  },
  buzzLocked: { backgroundColor: '#c8bba8' },
  buzzText: { color: '#f5efe3', fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  lockNote: { textAlign: 'center', color: '#8a6a3a', marginTop: 8 },
  options: { marginTop: 12, gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.8)',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  optionCorrect: { backgroundColor: 'rgba(90, 140, 90, 0.25)', borderColor: '#3f7a45' },
  optionText: { textAlign: 'center', color: '#3d2e22', fontSize: 16 },
  optionTextCorrect: { color: '#246b32', fontWeight: '700' },
  rivalLine: { textAlign: 'center', color: '#8a6a3a', marginBottom: 8 },
  good: { textAlign: 'center', color: '#246b32', fontSize: 28 },
  bad: { textAlign: 'center', color: '#8a3a3a', fontSize: 28 },
  rivalCorner: { position: 'absolute', right: 8, bottom: 8, maxWidth: 140, alignItems: 'flex-end' },
  rivalName: { color: '#4a3728', fontSize: 13, fontWeight: '600' },
  rivalState: { color: '#8a6a3a', fontSize: 11 },
  forfeit: { position: 'absolute', left: 8, bottom: 8 },
  romanRow: { flexDirection: 'row', gap: 10 },
  romanI: { fontSize: 72, color: '#4a3728', fontWeight: '500' },
  primaryBtn: {
    backgroundColor: '#8a6a3a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: '#f5efe3', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 58, 0.7)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  secondaryBtnText: { color: '#4a3728', fontSize: 16, fontWeight: '600' },
  textBtn: { paddingVertical: 8 },
  textBtnLabel: { color: '#8a6a3a', fontSize: 14 },
  disabled: { opacity: 0.45 },
  finalScroll: { padding: 22, gap: 10, paddingBottom: 40 },
  absent: { color: '#9a9084', fontStyle: 'italic', fontWeight: '400' },
  qRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.35)',
  },
  qChevron: { color: '#8a6a3a', fontSize: 16, width: 18 },
  qLine: { flex: 1, color: '#4a3728' },
  qBody: { flex: 1, gap: 4 },
  choiceLine: { color: '#4a3728', fontSize: 14 },
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
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.6)',
  },
  modalTitle: { fontSize: 20, color: '#4a3728', fontWeight: '600', marginBottom: 8 },
  modalBody: { color: '#6b5b45', fontSize: 15, lineHeight: 21, marginBottom: 16 },
});
