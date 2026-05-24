import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Mail, Apple } from './Icons';
import { ButtonDot } from './ButtonDot';
import { signInWithGoogle, signInWithApple } from '../services/authService';
import { getOrCreateUserStats } from '../services/userStatsService';
import { getOrCreateUserSettings } from '../services/userSettingsService';
import { getOrCreateProfile } from '../services/profileService';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onGuestMode?: () => void;
}

export function LoginScreen({ onLoginSuccess, onGuestMode }: LoginScreenProps) {
  const [isLoading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);

    const { user, error } = await signInWithGoogle();

    setLoading(false);

    if (error) {
      Alert.alert('Google Login Failed', error.message);
      return;
    }
    if (user) {
      await getOrCreateProfile(user);

      await getOrCreateUserStats(user.id);
      await getOrCreateUserSettings(user.id);

      Alert.alert('Success!', 'Welcome to CertamenApp!');
      onLoginSuccess();
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);

    const { user, error } = await signInWithApple();

    setLoading(false);

    if (error) {
      Alert.alert('Apple Login Failed', error.message);
      return;
    }
    if (user) {
      await getOrCreateProfile(user);

      await getOrCreateUserStats(user.id);
      await getOrCreateUserSettings(user.id);

      Alert.alert('Success!', 'Welcome to CertamenApp!');
      onLoginSuccess();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome</Text>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.toText}>to</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.appName}>CertamenApp</Text>
      </View>

      <View style={styles.loginSection}>
        <Text style={styles.loginPrompt}>Log in / Sign up</Text>

        <View style={styles.buttonsContainer}>
          <LoginButton
            icon={<Mail />}
            label={isLoading ? 'Signing in...' : 'Sign in with Google'}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          />

          <LoginButton
            icon={<Apple />}
            label={isLoading ? 'Signing in...' : 'Sign in with Apple'}
            onPress={handleAppleLogin}
            disabled={isLoading}
          />

          {onGuestMode && (
            <TouchableOpacity
              style={styles.guestButton}
              onPress={onGuestMode}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <ButtonDot color="#9d856b" />
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function LoginButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgColorAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (disabled) return;
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
    if (disabled) return;
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
    <Animated.View
      style={[
        styles.buttonOuter,
        { transform: [{ scale: scaleAnim }], opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
        disabled={disabled}
      >
        <Animated.View style={[styles.button, { backgroundColor }]}>
          <ButtonDot />
          <View style={styles.iconContainer}>{icon}</View>
          <Text style={styles.buttonText}>{label}</Text>
        </Animated.View>

      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    width: '100%',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  welcomeText: {
    fontSize: 36,
    letterSpacing: 3,
    color: '#3a3a3a',
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    width: 32,
    height: 1,
    backgroundColor: '#9d856b',
    opacity: 0.4,
  },
  toText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6a6a6a',
    letterSpacing: 1,
  },
  appName: {
    fontSize: 30,
    letterSpacing: 2,
    color: '#3a3a3a',
    marginTop: 8,
  },
  loginSection: {
    width: '100%',
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: 14,
    color: '#5a5a5a',
    letterSpacing: 1,
    marginBottom: 24,
  },
  buttonsContainer: {
    gap: 12,
    width: '100%',
    alignItems: 'stretch',
  },
  buttonOuter: {
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 48,
    width: '100%',
  },
  iconContainer: {
    width: 20,
    height: 20,
  },
  buttonText: {
    color: '#4a4a4a',
    letterSpacing: 1,
    fontSize: 16,
  },
  guestButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  guestButtonText: {
    color: '#6a6a6a',
    letterSpacing: 0.5,
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
