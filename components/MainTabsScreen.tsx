import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { InformationScreen } from './InformationScreen';
import { PracticeModeScreen } from './PracticeModeScreen';
import { StoryModeScreen } from './StoryModeScreen';
import { ReviewCategoryScreen } from './ReviewCategoryScreen';

export type MainTabId = 'info' | 'rankup' | 'practice' | 'review';

const TABS: { id: MainTabId; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'rankup', label: 'Rank-up' },
  { id: 'practice', label: 'Practice' },
  { id: 'review', label: 'Review' },
];

export function MainTabsScreen({
  activeTab,
  onTabChange,
  onNavigate,
  isGuestMode,
  isAuthenticated,
  onLeaveGuestMode,
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
  onLeaveGuestMode?: () => void;
}) {
  const handleTabPress = (tab: MainTabId) => {
    if (tab === 'review' && isGuestMode && !isAuthenticated) {
      Alert.alert('Sign In Required', 'Sign in to review your wrong answers and track your progress', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => onNavigate?.('login') },
      ]);
      return;
    }
    onTabChange(tab);
  };

  const panel = (() => {
    switch (activeTab) {
      case 'info':
        return (
          <InformationScreen
            onNavigate={onNavigate}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLeaveGuestMode={onLeaveGuestMode}
          />
        );
      case 'rankup':
        return <PracticeModeScreen onNavigate={onNavigate} showBackToMenu={false} isGuestMode={isGuestMode} />;
      case 'practice':
        return <StoryModeScreen onNavigate={onNavigate} showBackToMenu={false} />;
      case 'review':
        return isAuthenticated ? (
          <ReviewCategoryScreen onNavigate={onNavigate} />
        ) : null;
      default:
        return null;
    }
  })();

  return (
    <View style={styles.root}>
      <View style={styles.panel}>{panel}</View>
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
