import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

function ProfileIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 60 60" fill="none">
      <Circle cx="30" cy="20" r="8" fill="#c9a961" stroke="#9d856b" strokeWidth="1.5" />
      <Path
        d="M 15 45 Q 15 32 30 32 Q 45 32 45 45 L 15 45 Z"
        fill="#c9a961"
        stroke="#9d856b"
        strokeWidth="1.5"
      />
    </Svg>
  );
}

/**
 * Post-login home tab: placeholder content; same chrome as other hub screens (RomanBackground).
 * Profile control matches former main menu placement (top right).
 */
export function InformationScreen({
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
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handleProfilePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handleProfilePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(bgColorAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
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
      Alert.alert('Leave guest mode?', 'You will return to the login screen now.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => onLeaveGuestMode?.() },
      ]);
    } else {
      onNavigate?.('profile');
    }
  };

  return (
    <View style={styles.container}>
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

      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
    width: '100%',
  },
  profileContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
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
  placeholder: {
    flex: 1,
  },
});
