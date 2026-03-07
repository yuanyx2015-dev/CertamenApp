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
import { OfflineMatchScreen } from './OfflineMatchScreen';
import { PracticeModeScreen } from './PracticeModeScreen';
import { PracticeGameScreen } from './PracticeGameScreen';
import { SettingsScreen } from './SettingsScreen';
import { getSession, signOut, onAuthStateChange } from '../services/authService';

const { height } = Dimensions.get('window');

function ProfileIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 60 60" fill="none">
      {/* Head */}
      <Circle 
        cx="30" 
        cy="20" 
        r="8" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="1.5"
      />
      {/* Body/Shoulders */}
      <Path 
        d="M 15 45 Q 15 32 30 32 Q 45 32 45 45 L 15 45 Z" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="1.5"
      />
    </Svg>
  );
}

export function RomanBackground() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const previousScreen = useRef('login');
  
  // Profile button animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgColorAnim = useRef(new Animated.Value(0)).current;

  const handleProfilePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.timing(bgColorAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleProfilePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(bgColorAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const profileBackgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.6)', 'rgba(201, 169, 97, 0.25)'],
  });

  // Reset Profile button animation when screen changes
  useEffect(() => {
    scaleAnim.setValue(1);
    bgColorAnim.setValue(0);
  }, [currentScreen]);

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

  const handleNavigate = (screen: string) => {
    // Only update previous screen if we're not already on settings
    if (currentScreen !== 'settings') {
      previousScreen.current = currentScreen;
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
        return <OfflineMatchScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} />;
      case 'profile':
        return <ProfileStatsScreen onNavigate={handleNavigate} previousScreen={previousScreen.current} onLogout={handleLogout} />;
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

      {/* Profile Button - Only on main menu screen */}
      {currentScreen === 'main' && (
        <View style={styles.profileContainer}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity 
              onPressIn={handleProfilePressIn}
              onPressOut={handleProfilePressOut}
              onPress={() => handleNavigate('profile')}
              activeOpacity={1}
            >
              <Animated.View style={[styles.profileButton, { backgroundColor: profileBackgroundColor }]}>
                <ProfileIcon />
                <Text style={styles.profileText}>Profile</Text>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

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
  profileContainer: {
    position: 'absolute',
    top: 125,
    right: 48,
    zIndex: 15,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileText: {
    fontSize: 14,
    color: '#3a3a3a',
    letterSpacing: 0.5,
  },
});
