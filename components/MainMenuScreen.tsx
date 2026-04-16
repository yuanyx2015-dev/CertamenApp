import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// Single Sword Icon
function SingleSwordIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Blade - made longer */}
      <Path 
        d="M 30 5 L 32 40 L 28 40 Z" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
      {/* Guard */}
      <Rect 
        x="22" 
        y="39" 
        width="16" 
        height="3" 
        fill="#d4b76a" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
      {/* Handle */}
      <Rect 
        x="28" 
        y="42" 
        width="4" 
        height="10" 
        fill="#8b7355" 
        stroke="#6a5a4a" 
        strokeWidth="0.5"
      />
      {/* Pommel */}
      <Circle 
        cx="30" 
        cy="54" 
        r="3" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
    </Svg>
  );
}

/** Tall Roman scutum-style shield: rectangular with convex sides, frame, central boss + dot. */
function RomanRectangularShieldIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Main body — slight outward bow on left/right (control points at mid height) */}
      <Path
        d="M 22 7 L 38 7 Q 41.5 30 38 53 L 22 53 Q 18.5 30 22 7 Z"
        fill="#f4e8d0"
        stroke="#9d856b"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Inner thin frame */}
      <Path
        d="M 23.5 9.5 L 36.5 9.5 Q 39.2 30 36.5 51.5 L 23.5 51.5 Q 20.8 30 23.5 9.5 Z"
        fill="none"
        stroke="#c9a961"
        strokeWidth="0.75"
      />
      {/* Boss ring + center dot */}
      <Circle cx="30" cy="30" r="6" fill="#c9a961" stroke="#9d856b" strokeWidth="0.9" />
      <Circle cx="30" cy="30" r="2" fill="#6a5a4a" />
    </Svg>
  );
}

// Round Shield Icon
function RoundShieldIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Outer ring */}
      <Circle 
        cx="30" 
        cy="30" 
        r="20" 
        fill="#d4b76a" 
        stroke="#9d856b" 
        strokeWidth="1.5"
      />
      {/* Inner decorative ring */}
      <Circle 
        cx="30" 
        cy="30" 
        r="15" 
        fill="none" 
        stroke="#c9a961" 
        strokeWidth="1"
      />
      {/* Center boss */}
      <Circle 
        cx="30" 
        cy="30" 
        r="6" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="1"
      />
      {/* Decorative dots around the edge */}
      <Circle cx="30" cy="10" r="1.5" fill="#9d856b" />
      <Circle cx="30" cy="50" r="1.5" fill="#9d856b" />
      <Circle cx="10" cy="30" r="1.5" fill="#9d856b" />
      <Circle cx="50" cy="30" r="1.5" fill="#9d856b" />
      <Circle cx="44" cy="16" r="1.5" fill="#9d856b" />
      <Circle cx="16" cy="16" r="1.5" fill="#9d856b" />
      <Circle cx="44" cy="44" r="1.5" fill="#9d856b" />
      <Circle cx="16" cy="44" r="1.5" fill="#9d856b" />
    </Svg>
  );
}

// Profile Icon (user icon) - smaller version
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

// Scroll/Book Icon for Review
function ScrollIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Scroll roll left */}
      <Circle 
        cx="18" 
        cy="30" 
        r="4" 
        fill="#8b7355" 
        stroke="#6a5a4a" 
        strokeWidth="1"
      />
      {/* Scroll roll right */}
      <Circle 
        cx="42" 
        cy="30" 
        r="4" 
        fill="#8b7355" 
        stroke="#6a5a4a" 
        strokeWidth="1"
      />
      {/* Parchment center */}
      <Rect 
        x="18" 
        y="18" 
        width="24" 
        height="24" 
        fill="#f4e8d0" 
        stroke="#c9a961" 
        strokeWidth="1"
      />
      {/* Lines on parchment */}
      <Path 
        d="M 22 24 L 38 24 M 22 28 L 38 28 M 22 32 L 38 32 M 22 36 L 35 36" 
        stroke="#9d856b" 
        strokeWidth="1"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// AI Brain Icon for AI Tutor
function AIBrainIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Brain outline */}
      <Path 
        d="M 20 25 Q 15 25 15 30 Q 15 35 20 35 Q 20 40 25 42 Q 30 44 35 42 Q 40 40 40 35 Q 45 35 45 30 Q 45 25 40 25 Q 40 20 35 18 Q 30 16 25 18 Q 20 20 20 25 Z" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="2"
      />
      {/* Brain detail lines */}
      <Path 
        d="M 25 23 Q 28 25 30 23 M 30 28 Q 33 26 35 28 M 25 33 Q 27 35 30 33" 
        stroke="#9d856b" 
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* AI sparkle */}
      <Path 
        d="M 38 22 L 40 24 M 40 22 L 38 24" 
        stroke="#f4e8d0" 
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Animated Button Component
function AnimatedModeButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
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

  const handlePressOut = () => {
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

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.6)', 'rgba(201, 169, 97, 0.25)'],
  });

  return (
    <Animated.View style={[styles.modeButtonOuter, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.modeButtonTouchable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.modeButton, { backgroundColor }]}>
          {icon}
          <Text style={styles.modeButtonText} numberOfLines={2}>
            {label}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MainMenuScreen({
  onNavigate,
  isGuestMode,
  isAuthenticated,
  onLeaveGuestMode,
}: {
  onNavigate?: (screen: string) => void;
  isGuestMode?: boolean;
  isAuthenticated?: boolean;
  onLeaveGuestMode?: () => void;
}) {
  // Profile/Sign In button animation
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

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

  const handleProfilePress = () => {
    if (isAuthenticated) {
      onNavigate?.('profile');
      return;
    }
    if (isGuestMode) {
      Alert.alert(
        'Leave guest mode?',
        'You will return to the login screen now.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => onLeaveGuestMode?.() },
        ]
      );
    } else {
      onNavigate?.('profile');
    }
  };

  const handleReviewPress = () => {
    if (isGuestMode) {
      Alert.alert(
        'Sign In Required',
        'Sign in to review your wrong answers and track your progress',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => onNavigate?.('login') }
        ]
      );
    } else {
      onNavigate?.('review');
    }
  };

  return (
    <View style={styles.container}>
      {/* Profile or Sign In Button */}
      <View style={styles.profileContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity 
            onPressIn={handleProfilePressIn}
            onPressOut={handleProfilePressOut}
            onPress={handleProfilePress}
            activeOpacity={1}
          >
            <Animated.View style={[styles.profileButton, { backgroundColor: profileBackgroundColor }]}>
              <ProfileIcon />
              <Text style={styles.profileText}>
                {isAuthenticated ? 'Profile' : isGuestMode ? 'Leave Guest Mode' : 'Profile'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Rank-up Mode = timed Certamen (practice route); Practice Mode = narrative (story route); Review */}
      <View style={styles.centerContainer}>
        <AnimatedModeButton
          icon={<SingleSwordIcon />}
          label="Rank-up Mode"
          onPress={() => onNavigate?.('practice')}
        />

        <AnimatedModeButton
          icon={<RomanRectangularShieldIcon />}
          label="Practice Mode"
          onPress={() => onNavigate?.('story')}
        />

        <AnimatedModeButton
          icon={<ScrollIcon />}
          label="Review Questions"
          onPress={handleReviewPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    gap: 14,
    // Shift the button cluster downward (was marginTop: -48 pulling it up toward the title)
    paddingTop: 56,
    paddingBottom: 12,
  },
  profileContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
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
  modeButtonOuter: {
    alignSelf: 'stretch',
    width: '100%',
  },
  modeButtonTouchable: {
    width: '100%',
  },
  modeButton: {
    width: '100%',
    height: 148,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: {
    fontSize: 18,
    color: '#3a3a3a',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
