import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, PanResponder } from 'react-native';
import { InformationScreen } from './InformationScreen';
import { ChallengeModeScreen } from './ChallengeModeScreen';
import { ReviewWrongScreen } from './ReviewWrongScreen';
import { StoryModeScreen } from './StoryModeScreen';
import type { ChallengeGameMode } from './ChallengeGameScreen';

export type MainTabId = 'profile' | 'challenge' | 'review' | 'practice';

const TABS: { id: MainTabId; label: string }[] = [
  { id: 'profile', label: 'Home' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'review', label: 'Review' },
  { id: 'practice', label: 'Practice' },
];

/** Minimum horizontal travel (px) to register a deliberate tab swipe. */
const SWIPE_DISTANCE_THRESHOLD = 60;
/** A quick flick counts even if it's shorter, as long as it has enough velocity. */
const SWIPE_VELOCITY_THRESHOLD = 0.3;

export function MainTabsScreen({
  activeTab,
  onTabChange,
  onNavigate,
  isGuestMode,
  isAuthenticated,
  onStartChallengeGame,
  onLogout,
}: {
  activeTab: MainTabId;
  onTabChange: (tab: MainTabId) => void;
  onNavigate?: (
    screen: string,
    category?: string,
    practiceDifficulty?: 'easy' | 'medium' | 'hard'
  ) => void;
  isGuestMode?: boolean;
  isAuthenticated?: boolean;
  onStartChallengeGame?: (
    mode: ChallengeGameMode,
    setSize: number,
    rankIndex?: number
  ) => void;
  onLogout?: () => void;
}) {
  const handleTabPress = (tab: MainTabId) => {
    if (tab === 'review' && (isGuestMode || !isAuthenticated)) {
      Alert.alert('Sign In Required', 'Sign in to review your questions.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => onNavigate?.('login') },
      ]);
      return;
    }
    onTabChange(tab);
  };

  // Move to the adjacent tab. Routed through handleTabPress so the Review
  // tab's sign-in gating behaves the same as tapping the tab bar.
  // Kept in a ref so the (once-created) PanResponder always sees fresh props.
  const swipeToAdjacentTabRef = useRef<(direction: 1 | -1) => void>(() => {});
  swipeToAdjacentTabRef.current = (direction) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= TABS.length) return;
    handleTabPress(TABS[nextIndex].id);
  };

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture for clearly-horizontal drags so vertical
      // scrolling and button taps inside panels keep working.
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_evt, gesture) => {
        const { dx, vx } = gesture;
        const fastFlick =
          Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD && Math.abs(dx) > 20;
        if (dx <= -SWIPE_DISTANCE_THRESHOLD || (fastFlick && dx < 0)) {
          swipeToAdjacentTabRef.current(1); // swipe left → next tab
        } else if (dx >= SWIPE_DISTANCE_THRESHOLD || (fastFlick && dx > 0)) {
          swipeToAdjacentTabRef.current(-1); // swipe right → previous tab
        }
      },
    })
  ).current;

  const panel = (() => {
    switch (activeTab) {
      case 'profile':
        return (
          <InformationScreen
            onNavigate={onNavigate}
            onTabChange={onTabChange}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLogout={onLogout}
          />
        );
      case 'challenge':
        return (
          <ChallengeModeScreen
            isAuthenticated={isAuthenticated}
            isGuestMode={isGuestMode}
            onNavigate={onNavigate}
            onTabChange={onTabChange}
            onStartChallengeGame={onStartChallengeGame}
          />
        );
      case 'review':
        return (
          <ReviewWrongScreen
            isAuthenticated={isAuthenticated}
            onNavigate={onNavigate}
            onStartChallengeGame={onStartChallengeGame}
          />
        );
      case 'practice':
        return <StoryModeScreen onNavigate={onNavigate} showBackToMenu={false} />;
      default:
        return null;
    }
  })();

  return (
    <View style={styles.root}>
      <View style={styles.panel} {...panResponder.panHandlers}>
        {panel}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, selected && styles.tabItemSelected]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  panel: {
    flex: 1,
    minHeight: 0,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.35)',
    backgroundColor: 'rgba(245, 239, 227, 0.95)',
    paddingBottom: 6,
    paddingTop: 6,
    gap: 4,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemSelected: {
    backgroundColor: 'rgba(201, 169, 97, 0.28)',
    borderColor: 'rgba(201, 169, 97, 0.45)',
  },
  tabLabel: {
    fontSize: 11,
    color: '#6a6a6a',
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelSelected: {
    color: '#3a3a3a',
    fontWeight: '700',
  },
});
