import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

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

// Crossed Swords Icon
function CrossedSpearsIcon() {
  // Define single spear perfectly centered at x=30 (viewBox center)
  // All coordinates calculated for absolute bilateral symmetry
  const Spear = ({ rotation }: { rotation: number }) => (
    <G transform={`rotate(${rotation} 30 30)`}>
      {/* Spear tip - perfectly symmetrical triangle centered at x=30 */}
      <Path 
        d="M 30 10 L 32 20 L 28 20 Z" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
      {/* Shaft - perfectly centered rectangle: x=29 to x=31 (center at 30) */}
      <Rect 
        x="29" 
        y="20" 
        width="2" 
        height="30" 
        fill="#8b7355" 
        stroke="#6a5a4a" 
        strokeWidth="0.5"
      />
      {/* Bottom cap - perfectly centered: x=28 to x=32 (center at 30) */}
      <Rect 
        x="28" 
        y="50" 
        width="4" 
        height="2" 
        fill="#9d856b" 
        stroke="#6a5a4a" 
        strokeWidth="0.5"
      />
    </G>
  );

  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Left spear rotated -45° around center point (30, 30) */}
      <Spear rotation={-45} />
      {/* Right spear rotated +45° around center point (30, 30) - perfect mirror */}
      <Spear rotation={45} />
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        <Animated.View style={[styles.modeButton, { backgroundColor }]}>
          {icon}
          <Text style={styles.modeButtonText}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MainMenuScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  // Profile button animation
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

  return (
    <View style={styles.container}>
      {/* Profile Button */}
      <View style={styles.profileContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity 
            onPressIn={handleProfilePressIn}
            onPressOut={handleProfilePressOut}
            onPress={() => onNavigate?.('profile')}
            activeOpacity={1}
          >
            <Animated.View style={[styles.profileButton, { backgroundColor: profileBackgroundColor }]}>
              <ProfileIcon />
              <Text style={styles.profileText}>Profile</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Center Game Mode Buttons */}
      <View style={styles.centerContainer}>
        {/* Practice Mode Button */}
        <AnimatedModeButton 
          icon={<SingleSwordIcon />} 
          label="Practice Mode" 
          onPress={() => onNavigate?.('practice')} 
        />

        {/* Review Button */}
        <AnimatedModeButton 
          icon={<ScrollIcon />} 
          label="Review Questions" 
          onPress={() => onNavigate?.('review')} 
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
    gap: 24,
    marginTop: -60,
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
  modeButton: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 32,
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
  },
});
