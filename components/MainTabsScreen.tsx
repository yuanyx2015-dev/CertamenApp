import React, { useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  PanResponder
} from 'react-native';
import { Text } from '../lib/AppText';
import { InformationScreen } from './InformationScreen';
import { ChallengeModeScreen } from './ChallengeModeScreen';
import { ReviewWrongScreen } from './ReviewWrongScreen';
import { StoryModeScreen } from './StoryModeScreen';
import { ArenaModeScreen } from './ArenaModeScreen';
import type { ChallengeGameMode } from './ChallengeGameScreen';
import { IPadScaledPhoneColumn } from './IPadScaledPhoneColumn';
import { isIPad } from '../lib/layout';
import { playAscendPaneSound, playTabSound } from '../lib/buttonSound';

export type MainTabId = 'profile' | 'challenge' | 'review' | 'arena' | 'practice';

/** Bottom bar. Review lives inside Ascend, not as its own stop. */
const BAR_TABS: { id: MainTabId; label: string }[] = [
  { id: 'profile', label: 'Home' },
  { id: 'challenge', label: 'Ascend' },
  { id: 'arena', label: 'Arena' },
  { id: 'practice', label: 'Training' },
];

function sectionOf(tab: MainTabId): MainTabId {
  return tab === 'review' ? 'challenge' : tab;
}

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
  progressFillReady = true,
  onStartArenaMatch,
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
  progressFillReady?: boolean;
  onStartArenaMatch?: (matchId: string) => void;
}) {
  const visibleTabs = isGuestMode
    ? BAR_TABS.filter((tab) => tab.id === 'arena' || tab.id === 'practice')
    : BAR_TABS;
  const section = sectionOf(activeTab);
  const shownTab = visibleTabs.some((tab) => tab.id === section) ? section : 'arena';
  const rankPane = activeTab === 'review' ? 'review' : 'challenge';

  const handleTabPress = (tab: MainTabId) => {
    playTabSound(tab);
    if (tab === shownTab) return;
    onTabChange(tab);
  };

  const handleRankPane = (pane: 'challenge' | 'review') => {
    playAscendPaneSound(pane);
    if (pane === rankPane && shownTab === 'challenge') return;
    onTabChange(pane);
  };

  // Move to the adjacent tab. Kept in a ref so the (once-created)
  // PanResponder always sees fresh props.
  const swipeToAdjacentTabRef = useRef<(direction: 1 | -1) => void>(() => {});
  swipeToAdjacentTabRef.current = (direction) => {
    const currentIndex = visibleTabs.findIndex((t) => t.id === shownTab);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= visibleTabs.length) return;
    handleTabPress(visibleTabs[nextIndex].id);
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
    switch (shownTab) {
      case 'profile':
        return (
          <InformationScreen
            onNavigate={onNavigate}
            onTabChange={onTabChange}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLogout={onLogout}
            progressFillReady={progressFillReady}
          />
        );
      case 'challenge':
        return (
          <View style={styles.rankUp}>
            <View style={styles.rankSwitch}>
              {(['challenge', 'review'] as const).map((pane) => {
                const selected = rankPane === pane;
                return (
                  <TouchableOpacity
                    key={pane}
                    style={[styles.rankSwitchItem, selected && styles.rankSwitchItemSelected]}
                    onPress={() => handleRankPane(pane)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rankSwitchLabel, selected && styles.rankSwitchLabelSelected]}>
                      {pane === 'challenge' ? 'Challenge' : 'Review'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.rankPane}>
              {rankPane === 'review' ? (
                <ReviewWrongScreen
                  isAuthenticated={isAuthenticated}
                  isGuestMode={isGuestMode}
                  onNavigate={onNavigate}
                  onStartChallengeGame={onStartChallengeGame}
                />
              ) : (
                <ChallengeModeScreen
                  isAuthenticated={isAuthenticated}
                  isGuestMode={isGuestMode}
                  onNavigate={onNavigate}
                  onTabChange={onTabChange}
                  onStartChallengeGame={onStartChallengeGame}
                />
              )}
            </View>
          </View>
        );
      case 'arena':
        return (
          <ArenaModeScreen
            isGuestMode={isGuestMode}
            onStartMatch={(id) => onStartArenaMatch?.(id)}
          />
        );
      case 'practice':
        return <StoryModeScreen onNavigate={onNavigate} />;
      default:
        return null;
    }
  })();

  const panelBody = (
    <View style={styles.panel} {...panResponder.panHandlers}>
      {panel}
    </View>
  );

  return (
    <View style={[styles.root, isIPad && styles.rootIPad]}>
      {/* iPad: scale only the page content — keep the tab bar visible and tappable. */}
        {isIPad ? (
        <IPadScaledPhoneColumn extraShrink={shownTab === 'practice' ? 1.15 : 1}>
          {panelBody}
        </IPadScaledPhoneColumn>
      ) : (
        panelBody
      )}
      <View style={[styles.tabBar, isIPad && styles.tabBarIPad]}>
        {visibleTabs.map((tab) => {
          const selected = shownTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, selected && styles.tabItemSelected, isIPad && styles.tabItemIPad]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabLabel,
                  selected && styles.tabLabelSelected,
                  isIPad && styles.tabLabelIPad,
                ]}
                numberOfLines={1}
              >
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
  rootIPad: {
    maxWidth: '100%',
  },
  panel: {
    flex: 1,
    minHeight: 0,
  },
  rankUp: {
    flex: 1,
    minHeight: 0,
  },
  rankPane: {
    flex: 1,
    minHeight: 0,
  },
  rankSwitch: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    padding: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(201, 169, 97, 0.16)',
    gap: 3,
  },
  rankSwitchItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  rankSwitchItemSelected: {
    backgroundColor: '#f5efe3',
  },
  rankSwitchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8a6a3a',
  },
  rankSwitchLabelSelected: {
    color: '#4a3728',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 169, 97, 0.35)',
    backgroundColor: '#f5efe3',
    paddingBottom: 6,
    paddingTop: 6,
    gap: 4,
    paddingHorizontal: 4,
  },
  tabBarIPad: {
    paddingBottom: 10,
    paddingTop: 16,
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 30,
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
  tabItemIPad: {
    paddingVertical: 14,
    borderRadius: 12,
  },
  tabItemSelected: {
    backgroundColor: 'rgba(201, 169, 97, 0.28)',
    borderColor: 'rgba(201, 169, 97, 0.45)',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b5b45',
    letterSpacing: 0.15,
  },
  tabLabelIPad: {
    fontSize: 17,
  },
  tabLabelSelected: {
    color: '#4a3728',
  },
});
