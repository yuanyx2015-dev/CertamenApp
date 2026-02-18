import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MainMenuScreen } from './MainMenuScreen';
import { LaurelBranches } from './LaurelBranches';
import { MeanderBorder } from './MeanderBorder';
import { ProfileStatsScreen } from './ProfileStatsScreen';
import { MatchSelectionScreen } from './MatchSelectionScreen';
import { FriendlyMatchScreen } from './FriendlyMatchScreen';
import { RandomMatchScreen } from './RandomMatchScreen';
import { LoginScreen } from './LoginScreen';
import { VisitorMatchScreen } from './VisitorMatchScreen';
import { HomeMatchScreen } from './HomeMatchScreen';
import { OfflineMatchScreen } from './OfflineMatchScreen';
import { PracticeModeScreen } from './PracticeModeScreen';
import { SettingsScreen } from './SettingsScreen';

const { height } = Dimensions.get('window');

export function RomanBackground() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const previousScreen = useRef('main');

  const handleNavigate = (screen: string) => {
    // Only update previous screen if we're not already on settings
    if (currentScreen !== 'settings') {
      previousScreen.current = currentScreen;
    }
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'practice':
        return <PracticeModeScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'pvp':
        return <MatchSelectionScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'offline':
        return <OfflineMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'profile':
        return <ProfileStatsScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'settings':
        return <SettingsScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'random':
        return <RandomMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'friendly':
        return <FriendlyMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'visitor':
        return <VisitorMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'home':
        return <HomeMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'main':
      default:
        return <MainMenuScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Parchment background */}
      <View style={styles.parchment} />
      
      {/* Top header with laurel branches */}
      <View style={styles.headerContainer}>
        <LaurelBranches />
      </View>

      {/* Main content area */}
      <View style={styles.contentContainer}>
        {renderScreen()}
      </View>

      {/* Bottom footer with meander border */}
      <View style={styles.footerContainer}>
        <MeanderBorder />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5efe3',
    position: 'relative',
  },
  parchment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5efe3',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    zIndex: 50,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
});
