import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  AppState,
  Animated,
  Dimensions,
  Image,
  type AppStateStatus
} from 'react-native';
import { Text } from '../lib/AppText';
import { LaurelBranches } from './LaurelBranches';
import { MeanderBorder } from './MeanderBorder';
import { LoginScreen } from './LoginScreen';
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
import { StreakConfettiProvider } from './StreakConfetti';
import { BrandIntroOverlay } from './BrandIntroOverlay';
import { IPadScaledPhoneColumn } from './IPadScaledPhoneColumn';
import { isIPad, isIPhone } from '../lib/layout';
import { playHomeLogoTransition } from '../lib/playHomeLogoTransition';

export function RomanBackground() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [practiceGameKey, setPracticeGameKey] = useState(0);
  /** Practice tab: question category slug for the current session. */
  const [practiceGameStoryCategory, setPracticeGameStoryCategory] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTabId>('profile');
  const mainTabBeforeSettingsRef = useRef<MainTabId>('profile');
  const previousScreen = useRef('login');
  /** Challenge Mode game session config (mode + setSize + rankIndex). */
  const [challengeConfig, setChallengeConfig] = useState<ChallengeGameConfig | null>(null);
  const [challengeGameKey, setChallengeGameKey] = useState(0);
  /** Title and wreath are separate hit areas that fade together. */
  const [logoPressed, setLogoPressed] = useState(false);
  /** Brand intro after login, cold start, or return from background. */
  const [showBrandIntro, setShowBrandIntro] = useState(false);
  /** Header logo is mid-flight to Home — block every other tap until it lands. */
  const [homeTransitioning, setHomeTransitioning] = useState(false);
  const homeTransitioningRef = useRef(false);
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const appIconTranslateY = useRef(new Animated.Value(0)).current;
  const restOpacity = useRef(new Animated.Value(1)).current;
  const containerHeightRef = useRef(0);
  const pendingBrandIntroRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticatedRef = useRef(false);
  const isGuestModeRef = useRef(false);
  const currentScreenRef = useRef(currentScreen);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    isGuestModeRef.current = isGuestMode;
  }, [isGuestMode]);

  useEffect(() => {
    currentScreenRef.current = currentScreen;
    if (currentScreen === 'main' && pendingBrandIntroRef.current) {
      pendingBrandIntroRef.current = false;
      setShowBrandIntro(true);
    }
  }, [currentScreen]);

  useEffect(() => {
    checkSession();

    const { data: authListener } = onAuthStateChange((event, session) => {
      console.log('[RomanBackground] onAuthStateChange:', event, 'session:', !!session);
      if (session) {
        setIsAuthenticated(true);
        setIsGuestMode(false);
        setCurrentScreen((prev) => {
          if (prev === 'login') {
            pendingBrandIntroRef.current = true;
            return 'main';
          }
          return prev;
        });
      } else {
        setIsAuthenticated(false);
        // Avoid sending guest users (no Supabase session) back to login on INITIAL_SESSION.
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setIsGuestMode(false);
          setShowBrandIntro(false);
          pendingBrandIntroRef.current = false;
          setCurrentScreen('login');
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Re-play brand intro when returning to the app from background (not Control Center blips).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current === 'background';
      appStateRef.current = nextState;

      if (
        wasBackground &&
        nextState === 'active' &&
        (isAuthenticatedRef.current || isGuestModeRef.current) &&
        currentScreenRef.current === 'main'
      ) {
        setShowBrandIntro(true);
      }
    });

    return () => subscription.remove();
  }, []);

  const checkSession = async () => {
    const session = await getSession();
    if (session) {
      setIsAuthenticated(true);
      // Only queue intro when leaving login — avoids a double-queue race with onAuthStateChange.
      setCurrentScreen((prev) => {
        if (prev === 'login') {
          pendingBrandIntroRef.current = true;
        }
        return 'main';
      });
    } else {
      setIsAuthenticated(false);
      setCurrentScreen('login');
    }
  };

  /** Logo tap: switch to Home immediately; the lockup animation covers the load. */
  const handleNavigateToHome = () => {
    if (homeTransitioningRef.current) return;
    homeTransitioningRef.current = true;
    setLogoPressed(false);
    if (currentScreen !== 'settings-practice') {
      previousScreen.current = currentScreen;
    }
    setMainTab('profile');
    setCurrentScreen('main');
    setHomeTransitioning(true);
  };

  useLayoutEffect(() => {
    if (!homeTransitioning) return;

    const containerH =
      containerHeightRef.current || Dimensions.get('window').height;
    // Aim the combined title + laurel lockup at the vertical center.
    const brandFlyTop = isIPad ? 34 : 45;
    const headerTop = isIPad ? 66 : 58;
    const headerHeight = isIPad ? 160 : 128;
    const flyHeight = headerTop - brandFlyTop + headerHeight;
    const brandCenterY = brandFlyTop + flyHeight / 2;
    const translateYToCenter = containerH / 2 - brandCenterY;

    return playHomeLogoTransition({
      logoScale,
      logoTranslateY,
      appIconTranslateY,
      restOpacity,
      translateYToCenter,
      onComplete: () => {
        homeTransitioningRef.current = false;
        setHomeTransitioning(false);
      },
    });
  }, [homeTransitioning, logoScale, logoTranslateY, appIconTranslateY, restOpacity]);

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

    let resolvedScreen = screen === 'settings' ? 'settings-practice' : screen;
    let explicitMainTab: MainTabId | null = null;

    if (resolvedScreen === 'practice' || resolvedScreen === 'story') {
      explicitMainTab = 'practice';
      resolvedScreen = 'main';
    } else if (resolvedScreen === 'review') {
      explicitMainTab = 'review';
      resolvedScreen = 'main';
    }

    if (resolvedScreen === 'practice-game') {
      setPracticeGameStoryCategory(category ?? null);
      setPracticeGameKey((prev) => prev + 1);
    }

    if (resolvedScreen === 'settings-practice') {
      if (currentScreen === 'main') {
        mainTabBeforeSettingsRef.current = mainTab;
      }
    }

    if (resolvedScreen === 'main') {
      if (explicitMainTab !== null) {
        setMainTab(explicitMainTab);
      } else if (currentScreen === 'practice-game') {
        setMainTab('practice');
      } else if (currentScreen === 'challenge-game') {
        setMainTab(challengeConfig?.mode === 'review' ? 'review' : 'challenge');
      } else if (
        currentScreen === 'categoryQuestions' ||
        currentScreen === 'reviewCategories'
      ) {
        // The AI-explanation review flow is entered from the Profile screen,
        // so closing it returns to Profile rather than the Review tab.
        setMainTab('profile');
      } else if (currentScreen === 'settings-practice') {
        setMainTab(mainTabBeforeSettingsRef.current);
      } else {
        setMainTab('profile');
      }
    }

    if (currentScreen !== 'settings-practice') {
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
    pendingBrandIntroRef.current = true;
    handleNavigate('main');
  };

  const handleGuestMode = () => {
    setIsGuestMode(true);
    setMainTab('profile');
    pendingBrandIntroRef.current = true;
    setCurrentScreen('main');
  };

  /**
   * Launch a Challenge / Review game. Called from the two picker screens and from
   * the end-of-set "Another Set" button.
   */
  const handleStartChallengeGame = (
    mode: ChallengeGameMode,
    setSize: number,
    rankIndex?: number
  ) => {
    setChallengeConfig({ mode, setSize, rankIndex });
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
            storyPracticeCategory={practiceGameStoryCategory}
            onTabChange={setMainTab}
          />
        );
      case 'settings-practice':
        return (
          <SettingsScreen
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
            onStartChallengeGame={handleStartChallengeGame}
            onLogout={handleLogout}
          />
        );
    }
  };

  const isMainTabScreen = currentScreen === 'main';
  const useCompactContentInset =
    currentScreen !== 'login' &&
    !isMainTabScreen &&
    currentScreen !== 'reviewCategories' &&
    currentScreen !== 'categoryQuestions';
  const isGameScreen =
    currentScreen === 'practice-game' || currentScreen === 'challenge-game';
  const isReviewGame =
    currentScreen === 'challenge-game' && challengeConfig?.mode === 'review';

  const brandTitle = (
    <Text
      face="brand"
      style={[
        styles.titleText,
        isIPad && styles.titleTextIPad,
        logoPressed && !homeTransitioning && styles.logoPressed,
      ]}
      numberOfLines={1}
    >
      CertamenPrep
    </Text>
  );

  return (
    <StreakConfettiProvider>
    <View
      style={styles.container}
      onLayout={(e) => {
        containerHeightRef.current = e.nativeEvent.layout.height;
      }}
    >
      <View style={styles.parchment} pointerEvents="none" />

      {currentScreen !== 'login' && (
        <View
          style={[
            styles.logoHomeWrap,
            isIPad && styles.logoHomeWrapIPad,
            homeTransitioning && styles.logoHomeWrapHidden,
          ]}
          pointerEvents={homeTransitioning ? 'none' : 'box-none'}
        >
          <TouchableOpacity
            style={styles.logoTitleHit}
            onPress={handleNavigateToHome}
            onPressIn={() => setLogoPressed(true)}
            onPressOut={() => setLogoPressed(false)}
            activeOpacity={1}
            disabled={homeTransitioning}
            accessibilityRole="button"
            accessibilityLabel="Home"
          >
            {brandTitle}
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.headerContainer,
          isIPad && styles.headerContainerIPad,
          homeTransitioning && styles.logoHomeWrapHidden,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[styles.laurelVisual, logoPressed && styles.logoPressed]}
          pointerEvents="none"
        >
          <LaurelBranches />
        </View>
        {/* Separate hit areas, one shared press state: the wide SVG must not
            cover the Practice Settings button in the top-right. */}
        {currentScreen !== 'login' && (
          <TouchableOpacity
            style={[styles.laurelHomeHit, isIPad && styles.laurelHomeHitIPad]}
            onPress={handleNavigateToHome}
            onPressIn={() => setLogoPressed(true)}
            onPressOut={() => setLogoPressed(false)}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Home"
            disabled={homeTransitioning}
          />
        )}
      </View>

      <Animated.View
        style={[
          styles.contentContainer,
          useCompactContentInset && styles.contentContainerCompact,
          isGameScreen && styles.contentContainerGame,
          isReviewGame && styles.contentContainerReviewGame,
          isIPad && isMainTabScreen && styles.contentContainerMainIPad,
          // iPhone only: pull main tabs closer to the bottom (leave Android / iPad alone).
          isIPhone && isMainTabScreen && styles.contentContainerMainIPhone,
          // Practice hub only: sit closer under the laurel (other tabs keep default inset).
          isMainTabScreen &&
            mainTab === 'practice' &&
            (isIPad
              ? styles.contentContainerMainPracticeIPad
              : styles.contentContainerMainPractice),
          // Wrong-questions category list only (Mythology/History/…), not the 6-category hub.
          currentScreen === 'categoryQuestions' &&
            (isIPad
              ? styles.contentContainerCategoryQuestionsIPad
              : styles.contentContainerCategoryQuestions),
          { opacity: restOpacity },
        ]}
        pointerEvents={homeTransitioning ? 'none' : 'auto'}
      >
        {/* Main tabs / games manage their own iPad scale so footers & tabs stay visible. */}
        {isMainTabScreen || isGameScreen ? (
          renderScreen()
        ) : (
          <IPadScaledPhoneColumn
            extraShrink={currentScreen === 'reviewCategories' ? 1.15 : 1}
          >
            {renderScreen()}
          </IPadScaledPhoneColumn>
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.footerContainer,
          isGameScreen && styles.footerContainerGame,
          isReviewGame && styles.footerContainerReviewGame,
          { opacity: restOpacity },
        ]}
        pointerEvents="box-none"
      >
        <MeanderBorder />
      </Animated.View>

      {homeTransitioning && (
        <View
          style={styles.homeTransitionLayer}
          pointerEvents="auto"
          accessibilityViewIsModal
          accessibilityLabel="Going to Home"
        >
          {/* App icon: opposite of screen fade — in as content leaves, out as Home returns. */}
          <Animated.View
            style={[
              styles.appIconWrap,
              {
                opacity: restOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.38, 0],
                }),
                transform: [{ translateY: appIconTranslateY }],
              },
            ]}
            pointerEvents="none"
          >
            <Image
              source={require('../assets/icon.png')}
              style={[styles.appIcon, isIPad && styles.appIconIPad]}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>

          {/* Title + laurel fly together so the wreath stays part of the lockup. */}
          <Animated.View
            style={[
              styles.brandFlyWrap,
              isIPad && styles.brandFlyWrapIPad,
              {
                transform: [
                  { translateY: logoTranslateY },
                  { scale: logoScale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.logoTitleHit, styles.brandFlyTitle]}>
              <Text
                face="brand"
                style={[styles.titleText, isIPad && styles.titleTextIPad]}
                numberOfLines={1}
              >
                CertamenPrep
              </Text>
            </View>
            <View
              style={[
                styles.brandFlyLaurel,
                isIPad && styles.brandFlyLaurelIPad,
              ]}
            >
              <LaurelBranches />
            </View>
          </Animated.View>
        </View>
      )}

      <BrandIntroOverlay
        visible={showBrandIntro}
        onFinished={() => setShowBrandIntro(false)}
      />
    </View>
    </StreakConfettiProvider>
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
  logoHomeWrap: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  logoHomeWrapIPad: {
    top: 34,
  },
  logoHomeWrapHidden: {
    opacity: 0,
  },
  homeTransitionLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    overflow: 'visible',
  },
  appIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  appIcon: {
    width: 220,
    height: 220,
    borderRadius: 48,
  },
  appIconIPad: {
    width: 280,
    height: 280,
    borderRadius: 60,
  },
  /** Combined title + laurel lockup used only during the home transition. */
  brandFlyWrap: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    height: 141,
    alignItems: 'center',
    zIndex: 101,
  },
  brandFlyWrapIPad: {
    top: 34,
    height: 192,
  },
  brandFlyLaurel: {
    position: 'absolute',
    top: 13,
    left: 0,
    right: 0,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandFlyLaurelIPad: {
    top: 32,
    height: 160,
    transform: [{ scale: 1.35 }],
  },
  brandFlyTitle: {
    zIndex: 2,
  },
  logoTitleHit: {
    paddingTop: 6,
    paddingHorizontal: 14,
    paddingBottom: 2,
  },
  logoPressed: {
    opacity: 0.72,
  },
  titleText: {
    // Cormorant Garamond has a small x-height — needs more px than a UI sans.
    fontSize: 27,
    fontWeight: '600',
    color: '#c9a569',
    letterSpacing: 0.9,
    // Harder, darker edge — reads as outline more than a soft drop shadow.
    textShadowColor: 'rgba(55, 40, 18, 0.55)',
    textShadowOffset: { width: -0.8, height: 0.8 },
    textShadowRadius: 0.2,
  },
  titleTextIPad: {
    fontSize: 44,
    letterSpacing: 1.4,
  },
  headerContainer: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerContainerIPad: {
    top: 66,
    height: 160,
    transform: [{ scale: 1.35 }],
  },
  laurelVisual: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Narrow center hit so Practice Settings (top-right) isn't under the 280pt SVG. */
  laurelHomeHit: {
    width: 112,
    height: 52,
    borderRadius: 26,
  },
  laurelHomeHitIPad: {
    width: 140,
    height: 64,
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
  contentContainerMainIPad: {
    paddingTop: 200,
    paddingBottom: 56,
    justifyContent: 'flex-start',
  },
  contentContainerMainIPhone: {
    paddingBottom: 50,
  },
  contentContainerMainPractice: {
    paddingTop: 128,
  },
  contentContainerMainPracticeIPad: {
    paddingTop: 155,
  },
  contentContainerCategoryQuestions: {
    paddingTop: 118,
    justifyContent: 'flex-start',
  },
  contentContainerCategoryQuestionsIPad: {
    paddingTop: 145,
    justifyContent: 'flex-start',
  },
  contentContainerCompact: {
    paddingTop: 128,
    paddingBottom: 80,
    justifyContent: 'flex-start',
  },
  contentContainerGame: {
    paddingBottom: 64,
  },
  contentContainerReviewGame: {
    paddingBottom: 72,
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
  footerContainerGame: {
    height: 36,
  },
  footerContainerReviewGame: {
    height: 42,
  },
});
