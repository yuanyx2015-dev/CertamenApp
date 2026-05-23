import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
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
import { MainTabsScreen, type MainTabId } from './MainTabsScreen';
import { PracticeGameScreen } from './PracticeGameScreen';
import { SettingsScreen } from './SettingsScreen';
import { CategoryQuestionsScreen } from './CategoryQuestionsScreen';
import { ReviewCategoryScreen } from './ReviewCategoryScreen';
import {
  ChallengeGameScreen,
  type ChallengeGameConfig,
  type ChallengeGameMode,
} from './ChallengeGameScreen';
import { getSession, signOut, onAuthStateChange } from '../services/authService';
import type { UserSettingsScope } from '../services/userSettingsService';
import type { ChallengeDifficulty } from '../lib/challengeRanks';

export function RomanBackground() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [practiceGameKey, setPracticeGameKey] = useState(0);
  /** When set, practice-game loads only this difficulty; cleared when leaving that flow. */
  const [practiceGameDifficultyLock, setPracticeGameDifficultyLock] = useState<
    'easy' | 'medium' | 'hard' | null
  >(null);
  /** Which local settings bucket practice-game reads (story = practice; rank-up route = rank-up). */
  const [practiceGameSettingsScope, setPracticeGameSettingsScope] =
    useState<UserSettingsScope>('rank-up');
  /** Story Practice Mode: question category slug for the current session. */
  const [practiceGameStoryCategory, setPracticeGameStoryCategory] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTabId>('profile');
  const mainTabBeforeSettingsRef = useRef<MainTabId>('profile');
  const previousScreen = useRef('login');
  /** Challenge Mode game session config (mode + setSize + difficulty). */
  const [challengeConfig, setChallengeConfig] = useState<ChallengeGameConfig | null>(null);
  const [challengeGameKey, setChallengeGameKey] = useState(0);

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

  const handleNavigate = (
    screen: string,
    category?: string,
    practiceDifficulty?: 'easy' | 'medium' | 'hard'
  ) => {
    if (isGuestMode && !isAuthenticated) {
      if (screen === 'profile') {
        return;
      }
      if (screen === 'review') {
        return;
      }
    }

    let resolvedScreen = screen;
    let explicitMainTab: MainTabId | null = null;

    if (resolvedScreen === 'practice' || resolvedScreen === 'story') {
      explicitMainTab = 'practice';
      resolvedScreen = 'main';
    } else if (resolvedScreen === 'review') {
      explicitMainTab = 'review';
      resolvedScreen = 'main';
    }

    if (practiceDifficulty !== undefined) {
      setPracticeGameDifficultyLock(practiceDifficulty);
    } else {
      setPracticeGameDifficultyLock(null);
    }

    if (resolvedScreen === 'practice-game') {
      const fromPracticeTab = currentScreen === 'main' && mainTab === 'practice';
      const legacyStory = currentScreen === 'story';
      setPracticeGameSettingsScope(fromPracticeTab || legacyStory ? 'practice' : 'rank-up');
      setPracticeGameStoryCategory(fromPracticeTab || legacyStory ? (category ?? null) : null);
      setPracticeGameKey((prev) => prev + 1);
    }

    if (resolvedScreen === 'settings' || resolvedScreen === 'settings-practice') {
      if (currentScreen === 'main') {
        mainTabBeforeSettingsRef.current = mainTab;
      }
    }

    if (resolvedScreen === 'main') {
      if (explicitMainTab !== null) {
        setMainTab(explicitMainTab);
      } else if (currentScreen === 'practice-game') {
        // Practice-game can be launched from either Challenge (rank-up flow) or
        // the Practice tab (story flow); the settings scope tells us which.
        setMainTab(practiceGameSettingsScope === 'practice' ? 'practice' : 'challenge');
      } else if (
        currentScreen === 'categoryQuestions' ||
        currentScreen === 'reviewCategories'
      ) {
        // The AI-explanation review flow is entered from the Profile screen,
        // so closing it returns to Profile rather than the Review tab.
        setMainTab('profile');
      } else if (currentScreen === 'settings' || currentScreen === 'settings-practice') {
        setMainTab(mainTabBeforeSettingsRef.current);
      } else {
        setMainTab('profile');
      }
    }

    if (currentScreen !== 'settings' && currentScreen !== 'settings-practice') {
      previousScreen.current = currentScreen;
    }
    if (category && resolvedScreen !== 'practice-game') {
      setSelectedCategory(category);
    }
    setCurrentScreen(resolvedScreen);
  };

  /** After Google or Apple login succeeds so we leave the login branch (not only onAuthStateChange). */
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsGuestMode(false);
    handleNavigate('main');
  };

  const handleGuestMode = () => {
    setIsGuestMode(true);
    setMainTab('profile');
    setCurrentScreen('main');
  };

  const handleLeaveGuestMode = () => {
    setIsGuestMode(false);
    setCurrentScreen('login');
  };

  /**
   * Launch a Challenge / Review game. Called from the two picker screens and from
   * the end-of-set "Another Set" button.
   */
  const handleStartChallengeGame = (
    mode: ChallengeGameMode,
    setSize: number,
    difficulty?: ChallengeDifficulty
  ) => {
    setChallengeConfig({ mode, setSize, difficulty });
    setChallengeGameKey((k) => k + 1);
    setCurrentScreen('challenge-game');
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
      case 'practice-game':
        return (
          <PracticeGameScreen
            key={practiceGameKey}
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            isGuestMode={isGuestMode}
            fixedDifficulty={practiceGameDifficultyLock}
            settingsScope={practiceGameSettingsScope}
            storyPracticeCategory={practiceGameStoryCategory}
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
            settingsScope="rank-up"
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            isGuestMode={isGuestMode}
          />
        );
      case 'settings-practice':
        return (
          <SettingsScreen
            settingsScope="practice"
            onNavigate={handleNavigate}
            previousScreen={previousScreen.current}
            isGuestMode={isGuestMode}
          />
        );
      case 'categoryQuestions':
        return (
          <CategoryQuestionsScreen onNavigate={handleNavigate} category={selectedCategory} />
        );
      case 'reviewCategories':
        return <ReviewCategoryScreen onNavigate={handleNavigate} />;
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
      case 'challenge-game':
        if (!challengeConfig) {
          // Defensive fallback if we somehow got here without a config.
          setCurrentScreen('main');
          return null;
        }
        return (
          <ChallengeGameScreen
            key={challengeGameKey}
            config={challengeConfig}
            onNavigate={handleNavigate}
            onTabChange={setMainTab}
            onStartGame={handleStartChallengeGame}
          />
        );
      case 'main':
      default:
        return (
          <MainTabsScreen
            activeTab={mainTab}
            onTabChange={setMainTab}
            onNavigate={handleNavigate}
            isGuestMode={isGuestMode}
            isAuthenticated={isAuthenticated}
            onLeaveGuestMode={handleLeaveGuestMode}
            onStartChallengeGame={handleStartChallengeGame}
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
