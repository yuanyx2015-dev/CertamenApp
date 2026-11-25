import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { GameHeaderFade } from './GameHeaderFade';
import { FeedbackOverlay, type FeedbackOverlayHandle } from './RomanFeedback';
import {
  duckSounds,
  playBuzzSound,
  playButtonSound,
  playCancelSound,
  playNextSound,
  playTickSound,
  startTypewriter,
  stopTypewriter,
  unduckSounds,
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
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const viewRef = useRef<ArenaView | null>(null);
  const offsetRef = useRef(0);
  const guards = useRef({ live: false, read: false, answer: false, next: false });
  const feedbackRef = useRef<FeedbackOverlayHandle>(null);
  const shownFeedback = useRef('');

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
    if (!showForfeit) return;
    duckSounds();
    return () => unduckSounds();
  }, [showForfeit]);

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
    guards.current.next = false;
    if (view?.phase === 'countdown') guards.current.live = false;
  }, [view?.state_version, view?.phase]);

  useEffect(() => {
    if (view?.phase === 'reading' || view?.phase === 'rebound') setMyChoice(null);
  }, [view?.phase, view?.question_number]);

  useEffect(() => {
    const outcome = view?.resolution?.outcome;
    const show =
      (view?.phase === 'reveal' || view?.phase === 'rebound') &&
      (outcome === 'correct' || outcome === 'wrong' || outcome === 'miss');
    if (!view || !show || !outcome) return;
    const key = `${view.question_number}:${view.phase}:${outcome}:${view.resolution?.actor ?? ''}`;
    if (shownFeedback.current === key) return;
    shownFeedback.current = key;
    feedbackRef.current?.show(outcome === 'correct' ? 'correct' : 'wrong');
  }, [view]);

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
  const now = Date.now() + offsetRef.current;
  const selecting =
    view.phase === 'answering' && view.buzz_role && view.buzz_role !== view.role;
  const myAnswerLeft =
    view.phase === 'answering' && view.buzz_role === view.role && view.buzz_at
      ? Math.max(
          0,
          Math.ceil((Date.parse(view.buzz_at) + view.answer_seconds * 1000 - now) / 1000)
        )
      : null;
  let buzzLeft: number | null = null;
  if (
    (view.phase === 'reading' || view.phase === 'rebound') &&
    view.stream_anchor &&
    view.question_text
  ) {
    const len = view.question_text.length;
    const anchor = Date.parse(view.stream_anchor);
    const count =
      view.stream_from +
      Math.floor(Math.max(0, now - anchor) / Math.max(8, view.stream_ms));
    if (count >= len) {
      const doneAt = anchor + (len - view.stream_from) * view.stream_ms;
      buzzLeft = Math.max(0, view.pre_buzz_seconds - Math.floor((now - doneAt) / 1000));
    }
  }
  const settled = view.phase === 'reveal' || view.phase === 'scoreboard';
  const showOptions =
    (view.phase === 'answering' && view.buzz_role === view.role && view.options) ||
    (settled && view.resolution?.options && view.resolution.correct_index != null);
  const optionList =
    view.phase === 'answering' ? view.options : view.resolution?.options ?? null;
  const correctIndex = view.resolution?.correct_index ?? null;
  const iHaveNext = view.role === 'host' ? view.host_next : view.guest_next;
  const rivalStatus = theyAnswered ? 'Answered' : selecting ? 'Choosing' : 'Listening';
  const statusText =
    view.phase === 'answering' && view.buzz_role === view.role
      ? 'Buzzed! Select your answer...'
      : selecting
        ? 'Your rival is choosing'
        : settled
          ? view.resolution?.outcome === 'correct'
            ? 'Correct!'
            : view.resolution?.outcome === 'miss'
              ? "Time's up!"
              : 'Wrong!'
          : shown >= (view.question_text?.length ?? 0) && view.question_text
            ? 'Waiting for buzz...'
            : 'Reading question...';

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
                playButtonSound();
                void arenaDismissForfeitNotice();
                setShowForfeit(false);
              }}
            >
              <Text style={styles.primaryBtnText}>Understood</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textBtn}
              onPress={() => {
                playButtonSound();
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
              onPress={() => {
                playButtonSound();
                void arenaStartMatch(matchId).then(() => refresh());
              }}
            >
              <Text style={styles.primaryBtnText}>Start the match</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.quiet}>Waiting for the host to start.</Text>
          )}
          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => {
              playCancelSound();
              void arenaLeave(matchId).then(() => onExit());
            }}
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
        view.phase === 'reveal' ||
        view.phase === 'scoreboard') && (
        <View style={styles.play}>
          <GameHeaderFade />
          <View style={styles.header}>
            <View style={styles.headerColLeft}>
              <Text style={styles.headerText}>
                Question {view.question_number}/{view.question_count}
              </Text>
            </View>
            <View
              style={[
                styles.headerColCenter,
                myAnswerLeft !== null || buzzLeft !== null
                  ? styles.headerColCenterActive
                  : styles.headerColCenterHidden,
              ]}
            >
              {myAnswerLeft !== null && (
                <Text style={styles.headerTimerText}>Time: {myAnswerLeft}s</Text>
              )}
              {myAnswerLeft === null && buzzLeft !== null && (
                <Text style={styles.headerTimerText}>Buzz in: {buzzLeft}s</Text>
              )}
            </View>
            <View style={styles.headerColRight}>
              <Text style={styles.headerScore} numberOfLines={1}>
                You {myScore} · {theirName ?? 'Rival'} {theirScore}
              </Text>
            </View>
          </View>

          <FitScrollView
            style={styles.gameArea}
            contentContainerStyle={styles.gameAreaContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.statusContainer}>
              <Text style={[styles.statusText, view.phase === 'answering' && styles.statusTextBuzzed]}>
                {statusText}
              </Text>
            </View>

            <View style={styles.questionBox}>
              <Text style={styles.questionText}>
                {text}
                {(view.phase === 'reading' || view.phase === 'rebound') &&
                  shown < (view.question_text?.length ?? 0) && <Text style={styles.cursor}>|</Text>}
              </Text>
            </View>

            {(view.phase === 'reading' || view.phase === 'rebound') && (
              <View>
                <TouchableOpacity
                  style={[styles.buzzerBtn, view.buzz_locked && styles.buzzLocked]}
                  onPress={() => {
                    if (view.buzz_locked) {
                      playCancelSound();
                      setLockNote(true);
                      setTimeout(() => setLockNote(false), 2500);
                      return;
                    }
                    playBuzzSound();
                    void arenaBuzz(matchId).then(() => refresh());
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buzzerText}>BUZZ</Text>
                </TouchableOpacity>
                {lockNote && (
                  <Text style={styles.lockNote}>You already buzzed on this question.</Text>
                )}
              </View>
            )}

            {showOptions && optionList && (
              <View style={styles.optionsGrid}>
                {[optionList.slice(0, 2), optionList.slice(2, 4)].map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.optionRow}>
                    {row.map((option, col) => {
                      const index = rowIndex * 2 + col;
                      const isCorrect = settled && correctIndex != null && index === correctIndex;
                      const isWrong = settled && myChoice === index && index !== correctIndex;
                      const cardStyle = [
                        styles.optionCard,
                        isCorrect && styles.optionCorrect,
                        isWrong && styles.optionWrong,
                      ];
                      const textStyle = [
                        styles.optionText,
                        isCorrect && styles.optionTextCorrect,
                        isWrong && styles.optionTextWrong,
                      ];
                      if (view.phase !== 'answering') {
                        return (
                          <View key={`${option}-${index}`} style={cardStyle}>
                            <Text style={textStyle}>{option}</Text>
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={`${option}-${index}`}
                          style={cardStyle}
                          activeOpacity={0.75}
                          onPress={() => {
                            setMyChoice(index);
                            playTickSound();
                            void arenaAnswer(matchId, index).then(() => refresh());
                          }}
                        >
                          <Text style={textStyle}>{option}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            {settled && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.nextBtn, iHaveNext && styles.disabled]}
                  disabled={iHaveNext}
                  activeOpacity={0.85}
                  onPress={() => {
                    playNextSound();
                    void (async () => {
                      if (view.phase === 'reveal') await arenaToScoreboard(matchId);
                      await arenaTapNext(matchId);
                      await refresh();
                    })();
                  }}
                >
                  <Text style={styles.nextBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </FitScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerBtn}
              onPress={() => {
                playCancelSound();
                void arenaLeave(matchId).then(() => refresh());
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.footerBtnText}>Forfeit</Text>
            </TouchableOpacity>
            <View style={styles.footerBtn}>
              <Text style={styles.footerName} numberOfLines={1}>
                {theirName ?? 'Rival'}
              </Text>
              <Text style={styles.footerState}>{rivalStatus}</Text>
            </View>
          </View>
          <FeedbackOverlay ref={feedbackRef} />
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
              onPress={() => {
                playButtonSound();
                void arenaRematch(matchId).then((row) => {
                  if (!row.ok && row.error) Alert.alert('Arena', row.error);
                  void refresh();
                });
              }}
            >
              <Text style={styles.primaryBtnText}>Play again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              playCancelSound();
              void arenaLeave(matchId).then(() => onExit());
            }}
          >
            <Text style={styles.secondaryBtnText}>Leave the match</Text>
          </TouchableOpacity>
          {questions.map((q, index) => {
            const open = openQ === index;
            const first = q.question_text.split('\n')[0];
            return (
              <Pressable
                key={index}
                style={styles.qRow}
                onPress={() => {
                  if (open) playCancelSound();
                  else playTickSound();
                  setOpenQ(open ? null : index);
                }}
              >
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
  play: { flex: 1, position: 'relative' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f5efe3',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 169, 97, 0.3)',
  },
  headerColLeft: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', minWidth: 0 },
  headerColCenter: { alignItems: 'center', justifyContent: 'center' },
  headerColCenterHidden: { width: 0, minWidth: 0, paddingHorizontal: 0, overflow: 'hidden' },
  headerColCenterActive: { flexShrink: 0, minWidth: 104, paddingHorizontal: 8 },
  headerColRight: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', minWidth: 0 },
  headerText: { fontSize: 17, fontWeight: '600', color: '#3a3a3a' },
  headerTimerText: { fontSize: 18, fontWeight: '700', color: '#c9a961' },
  headerScore: { fontSize: 14, fontWeight: '600', color: '#3a3a3a' },
  gameArea: { flex: 1 },
  gameAreaContent: { width: '100%', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10 },
  statusContainer: { alignItems: 'center', paddingTop: 4, paddingBottom: 2 },
  statusText: { fontSize: 14, lineHeight: 19, color: '#7a7a7a', fontStyle: 'italic', textAlign: 'center' },
  statusTextBuzzed: { color: '#c9a961', fontWeight: '600' },
  questionBox: {
    backgroundColor: '#fbf8f4',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.35)',
    borderRadius: 12,
    padding: 16,
    minHeight: 116,
  },
  questionText: { fontSize: 17, lineHeight: 26, color: '#3a3a3a' },
  buzzerBtn: {
    alignSelf: 'center',
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#fdfcf9',
    borderWidth: 3,
    borderColor: '#c9a961',
    shadowColor: '#c9a961',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  buzzerText: { color: '#c9a961', fontSize: 27, fontWeight: '700', letterSpacing: 1.4 },
  optionsGrid: { width: '100%', gap: 10 },
  optionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  optionCard: {
    flex: 1,
    backgroundColor: '#fbf8f4',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    borderRadius: 10,
    padding: 14,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCorrect: {
    backgroundColor: '#d6dbca',
    borderColor: 'rgba(52, 120, 72, 0.75)',
    borderWidth: 2,
  },
  optionWrong: {
    backgroundColor: 'rgba(176, 72, 72, 0.16)',
    borderColor: 'rgba(160, 52, 52, 0.85)',
    borderWidth: 2,
  },
  optionTextWrong: { color: '#7a2a2a', fontWeight: '600' },
  actionRow: { alignItems: 'center', marginTop: 6 },
  nextBtn: {
    backgroundColor: '#c9a961',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#9d856b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.25 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.25)',
    backgroundColor: '#f5efe3',
  },
  footerBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#efe4cf',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { fontSize: 16, fontWeight: '600', color: '#6a5530' },
  footerName: { fontSize: 14, fontWeight: '600', color: '#3a3a3a' },
  footerState: { fontSize: 13, color: '#6a5530', marginTop: 2 },
  title: { fontSize: 26, color: '#4a3728', fontWeight: '600', textAlign: 'center' },
  code: { fontSize: 42, letterSpacing: 4, color: '#4a3728', fontWeight: '600' },
  quiet: { color: '#8a6a3a', textAlign: 'center', fontSize: 15 },
  progress: { textAlign: 'center', color: '#6b5b45', marginBottom: 4 },
  scores: { textAlign: 'center', color: '#4a3728', marginBottom: 8 },
  bigScore: { fontSize: 22, color: '#4a3728', fontWeight: '600' },
  questionScroll: { maxHeight: 220 },
  question: { fontSize: 18, lineHeight: 26, color: '#3d2e22', textAlign: 'center' },
  cursor: { fontWeight: 'bold', fontSize: 22, color: '#c9a961' },
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
  optionText: { textAlign: 'center', color: '#3a3a3a', fontSize: 16, lineHeight: 21 },
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
