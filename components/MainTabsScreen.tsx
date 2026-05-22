import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { InformationScreen } from './InformationScreen';
import { ChallengeModeScreen } from './ChallengeModeScreen';
import { ReviewWrongScreen } from './ReviewWrongScreen';

export type MainTabId = 'profile' | 'challenge' | 'review';

const TABS: { id: MainTabId; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'challenge', label: 'Challenge Mode' },
  { id: 'review', label: 'Review Wrong' },
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
    if (tab === 'review' && (isGuestMode || !isAuthenticated)) {
      Alert.alert('Sign In Required', 'Sign in to review your wrong questions.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => onNavigate?.('login') },
      ]);
      return;
    }
    onTabChange(tab);
  };

  const panel = (() => {
    switch (activeTab) {
      case 'profile':
        return (
          <InformationScreen
            onNavigate={onNavigate}
            onTabChange={onTabChange}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLeaveGuestMode={onLeaveGuestMode}
          />
        );
      case 'challenge':
        return (
          <ChallengeModeScreen
            isAuthenticated={isAuthenticated}
            isGuestMode={isGuestMode}
            onNavigate={onNavigate}
            onTabChange={onTabChange}
          />
        );
      case 'review':
        return (
          <ReviewWrongScreen
            isAuthenticated={isAuthenticated}
            onNavigate={onNavigate}
            onTabChange={onTabChange}
          />
        );
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
