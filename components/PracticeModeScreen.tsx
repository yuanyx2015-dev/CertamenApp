import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, useWindowDimensions } from 'react-native';

function AnimatedButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.6)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, { width: '100%' }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.startButton, { backgroundColor }]}>
          <Text style={styles.startButtonText}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

type PracticeModeScreenProps = {
  onNavigate?: (
    screen: string,
    category?: string,
    practiceDifficulty?: 'easy' | 'medium' | 'hard'
  ) => void;
  previousScreen?: string;
  isGuestMode?: boolean;
};

/**
 * Rank-up Mode: classic timed Certamen — rank-based difficulty mix, scoring, Settings (# of tossups, wrong-only).
 * Opens practice-game with no fixed difficulty (same as pre–difficulty-picker behavior).
 */
const STACK_GAP = 14;
/** Additional upward offset for the "Rank-up Mode" heading (relative to the Start Game anchor). */
const TITLE_NUDGE_UP = 13;
/** Shifts Start Game + Back down together (layout anchor stays window-centered for clamp math). */
const BUTTON_NUDGE_DOWN = 20;

export function PracticeModeScreen({ onNavigate }: PracticeModeScreenProps) {
  const { height: windowHeight } = useWindowDimensions();
  const mainColumnRef = React.useRef<View>(null);
  const [mainColumnY, setMainColumnY] = React.useState<number | null>(null);
  const [mainColumnH, setMainColumnH] = React.useState(0);
  const [rowH, setRowH] = React.useState(52);
  const [titleH, setTitleH] = React.useState(36);
  const [backH, setBackH] = React.useState(48);

  const measureMainColumn = React.useCallback(() => {
    requestAnimationFrame(() => {
      mainColumnRef.current?.measureInWindow((_x, y, _w, h) => {
        setMainColumnY(y);
        setMainColumnH(h);
      });
    });
  }, []);

  React.useEffect(() => {
    measureMainColumn();
  }, [measureMainColumn, windowHeight]);

  const startGameTop = React.useMemo(() => {
    if (mainColumnY == null) return null;
    const windowCenterY = windowHeight / 2;
    let top = Math.round(windowCenterY - rowH / 2 - mainColumnY);
    const titleRoom = titleH + STACK_GAP + TITLE_NUDGE_UP;
    const bottomRoom = BUTTON_NUDGE_DOWN + rowH + STACK_GAP + backH;
    if (mainColumnH > 0) {
      top = Math.max(titleRoom, Math.min(top, mainColumnH - bottomRoom));
    }
    return top;
  }, [mainColumnY, mainColumnH, windowHeight, rowH, titleH, backH]);

  return (
    <View style={styles.container}>
      <View style={styles.settingsContainer}>
        <TouchableOpacity style={styles.settingsButton} onPress={() => onNavigate?.('settings')}>
          <Text style={styles.settingsButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View ref={mainColumnRef} style={styles.mainColumn} onLayout={measureMainColumn}>
        {startGameTop != null && (
          <>
            <View
              style={[styles.titleAnchor, { top: startGameTop - titleH - STACK_GAP - TITLE_NUDGE_UP }]}
              onLayout={(e) => setTitleH(e.nativeEvent.layout.height)}
            >
              <Text style={styles.titleText}>Rank-up Mode</Text>
            </View>

            <View
              style={[styles.startGameRow, { top: startGameTop + BUTTON_NUDGE_DOWN }]}
              onLayout={(e) => setRowH(e.nativeEvent.layout.height)}
            >
              <AnimatedButton label="Start Game" onPress={() => onNavigate?.('practice-game')} />
            </View>

            <View
              style={[styles.backAnchor, { top: startGameTop + rowH + STACK_GAP + BUTTON_NUDGE_DOWN }]}
              onLayout={(e) => setBackH(e.nativeEvent.layout.height)}
            >
              <TouchableOpacity style={styles.backButton} onPress={() => onNavigate?.('main')}>
                <Text style={styles.backButtonText}>Back to menu</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={styles.footerTextWrap}>
        <Text style={styles.bodyText}>
          Advance with answering questions correctly to rise the ranks! Check your progress through the Profiles
          screen, accessed through the main menu.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    position: 'relative',
  },
  mainColumn: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  titleAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  startGameRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'stretch',
  },
  backAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerTextWrap: {
    paddingHorizontal: 8,
    paddingBottom: 28,
    paddingTop: 8,
  },
  settingsContainer: {
    position: 'absolute',
    top: 123,
    right: 18,
    zIndex: 100,
  },
  settingsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsButtonText: {
    color: '#3a3a3a',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  bodyText: {
    color: '#6a6a6a',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  startButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  startButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
