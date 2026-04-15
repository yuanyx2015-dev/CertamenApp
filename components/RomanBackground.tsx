import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
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
import { SimulationMatchScreen } from './SimulationMatchScreen';
import { PracticeModeScreen } from './PracticeModeScreen';
import { PracticeGameScreen } from './PracticeGameScreen';
import { SettingsScreen } from './SettingsScreen';
import { ReviewCategoryScreen } from './ReviewCategoryScreen';
import { CategoryQuestionsScreen } from './CategoryQuestionsScreen';
import { getSession, signOut, onAuthStateChange } from '../services/authService';

export function RomanBackground() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [practiceGameKey, setPracticeGameKey] = useState(0);
  const previousScreen = useRef('login');

  useEffect(() => {
    checkSession();

    const { data: authListener } = onAuthStateChange((event, session) => {
      console.log('[RomanBackground] onAuthStateChange:', event, 'session:', !!session);
      if (session) {
        setIsAuthenticated(true);
        setIsGuestMode(false);
        setCurrentScreen((prev) => (prev === 'login' ? 'main' : prev));
      } else {
        setIsAuthenticated(false);
        // Avoid sending guest users (no Supabase session) back to login on INITIAL_SESSION.
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setIsGuestMode(false);
          setCurrentScreen('login');
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    const session = await getSession();
    if (session) {
      setIsAuthenticated(true);
      setCurrentScreen('main');
    } else {
      setIsAuthenticated(false);
      setCurrentScreen('login');
    }
  };

  const handleNavigate = (screen: string, category?: string) => {
    if (isGuestMode && !isAuthenticated) {
      if (screen === 'profile') {
        return;
      }
      if (screen === 'review') {
        return;
      }
    }

    if (screen === 'practice-game') {
      setPracticeGameKey((prev) => prev + 1);
    }

    if (currentScreen !== 'settings') {
      previousScreen.current = currentScreen;
    }
    if (category) {
      setSelectedCategory(category);
    }
    setCurrentScreen(screen);
  };

  /** After Google or Apple login succeeds so we leave the login branch (not only onAuthStateChange). */
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsGuestMode(false);
    handleNavigate('main');
  };

  const handleGuestMode = () => {
    setIsGuestMode(true);
    setCurrentScreen('main');
  };

  const handleLeaveGuestMode = () => {
    setIsGuestMode(false);
    setCurrentScreen('login');
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Logout error:', error.message);
    }
  };

  const renderScreen = () => {
    if (!isAuthenticated && !isGuestMode) {
      return (
        <LoginScreen onLoginSuccess={handleLoginSuccess} onGuestMode={handleGuestMode} />
      );
    }

    switch (currentScreen) {
      case 'practice':
        return (
          <PracticeModeScreen
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            isGuestMode={isGuestMode}
          />
        );
      case 'practice-game':
        return (
          <PracticeGameScreen
            key={practiceGameKey}
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            isGuestMode={isGuestMode}
          />
        );
      case 'pvp':
        return (
          <MatchSelectionScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />
        );
      case 'offline':
      case 'simulation':
        return (
          <SimulationMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />
        );
      case 'profile':
        return isAuthenticated ? (
          <ProfileStatsScreen
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            onLogout={handleLogout}
          />
        ) : (
          <MainMenuScreen
            onNavigate={handleNavigate}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLeaveGuestMode={handleLeaveGuestMode}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            isGuestMode={isGuestMode}
          />
        );
      case 'review':
        return isAuthenticated ? (
          <ReviewCategoryScreen onNavigate={handleNavigate} />
        ) : (
          <MainMenuScreen
            onNavigate={handleNavigate}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLeaveGuestMode={handleLeaveGuestMode}
          />
        );
      case 'categoryQuestions':
        return (
          <CategoryQuestionsScreen onNavigate={handleNavigate} category={selectedCategory} />
        );
      case 'random':
        return <RandomMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'friendly':
        return <FriendlyMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'visitor':
        return <VisitorMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'home':
        return <HomeMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'login':
        return (
          <LoginScreen onLoginSuccess={handleLoginSuccess} onGuestMode={handleGuestMode} />
        );
      case 'main':
      default:
        return (
          <MainMenuScreen
            onNavigate={handleNavigate}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLeaveGuestMode={handleLeaveGuestMode}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.parchment} />

      {currentScreen !== 'login' && (
        <TouchableOpacity
          style={styles.titleContainer}
          onPress={() => handleNavigate('main')}
          activeOpacity={0.6}
        >
          <Text style={styles.titleText}>CertamenApp</Text>
        </TouchableOpacity>
      )}

      <View style={styles.headerContainer}>
        <LaurelBranches />
      </View>

      <View style={styles.contentContainer}>{renderScreen()}</View>

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
  titleContainer: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    paddingVertical: 8,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#c9a569',
    letterSpacing: 1.2,
  },
  headerContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contentContainer: {
    flex: 1,
    paddingTop: 170,
    paddingBottom: 110,
    paddingHorizontal: 24,
    justifyContent: 'center',
    zIndex: 5,
    overflow: 'visible',
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
