import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Animated } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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

const { height } = Dimensions.get('window');

export function RomanBackground() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const previousScreen = useRef('login');

  // Check for existing session on mount and listen for auth state changes
  useEffect(() => {
    checkSession();

    // Listen for auth state changes
    const { data: authListener } = onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        if (currentScreen === 'login') {
          setCurrentScreen('main');
        }
      } else {
        setIsAuthenticated(false);
        setCurrentScreen('login');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    const session = await getSession();
    if (session) {
      // User is already logged in, go to main menu
      setIsAuthenticated(true);
      setCurrentScreen('main');
    } else {
      setIsAuthenticated(false);
      setCurrentScreen('login');
    }
  };

  const handleNavigate = (screen: string, category?: string) => {
    // Only update previous screen if we're not already on settings
    if (currentScreen !== 'settings') {
      previousScreen.current = currentScreen;
    }
    if (category) {
      setSelectedCategory(category);
    }
    setCurrentScreen(screen);
  };

  const handleGoogleLogin = () => {
    // After successful Google login, navigate to main menu
    handleNavigate('main');
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Logout error:', error.message);
    }
    // Auth state listener will handle navigation to login screen
  };

  const renderScreen = () => {
    // If not authenticated, always show login screen
    if (!isAuthenticated) {
      return <LoginScreen navigation={null} onLoginSuccess={handleGoogleLogin} />;
    }

    // If authenticated, show the requested screen
    switch (currentScreen) {
      case 'practice':
        return <PracticeModeScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'practice-game':
        return <PracticeGameScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'pvp':
        return <MatchSelectionScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'offline':
      case 'simulation':
        return <SimulationMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'profile':
        return <ProfileStatsScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} onLogout={handleLogout} />;
      case 'settings':
        return <SettingsScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'review':
        return <ReviewCategoryScreen onNavigate={handleNavigate} />;
      case 'categoryQuestions':
        return <CategoryQuestionsScreen onNavigate={handleNavigate} category={selectedCategory} />;
      case 'random':
        return <RandomMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'friendly':
        return <FriendlyMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'visitor':
        return <VisitorMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'home':
        return <HomeMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'login':
      case 'main':
      default:
        return <MainMenuScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Parchment background */}
      <View style={styles.parchment} />
      
      {/* App Title - Above laurel wreath, only show when not on login screen */}
      {currentScreen !== 'login' && (
        <TouchableOpacity 
          style={styles.titleContainer}
          onPress={() => handleNavigate('main')} 
          activeOpacity={0.6}
        >
          <Text style={styles.titleText}>CertamenApp</Text>
        </TouchableOpacity>
      )}
      
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
