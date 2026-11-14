import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform,
  Linking,
  Text as SystemText,
} from 'react-native';
import { Text } from '../lib/AppText';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Google } from './Icons';
import { signInWithGoogle, signInWithApple, type AuthResponse } from '../services/authService';
import { getOrCreateUserStats } from '../services/userStatsService';
import { getOrCreateUserSettings } from '../services/userSettingsService';
import { getOrCreateProfile } from '../services/profileService';
import { useIPadScaledStyles } from '../lib/layout';
import { PRIVACY_POLICY_URL } from '../constants/urls';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onGuestMode?: () => void;
}

export function LoginScreen({ onLoginSuccess, onGuestMode }: LoginScreenProps) {
  const styles = useIPadScaledStyles(baseStyles);
  const [isLoading, setLoading] = useState(false);

  // Shared flow for both providers: sign in, then bootstrap profile/stats/settings.
  const runLogin = async (
    providerLabel: 'Google' | 'Apple',
    signIn: () => Promise<AuthResponse>
  ) => {
    setLoading(true);

    const { user, error } = await signIn();

    setLoading(false);

    if (error) {
      Alert.alert(`${providerLabel} Login Failed`, error.message);
      return;
    }
    if (user) {
      // Best-effort bootstrap; these are also created lazily on first use elsewhere.
      await getOrCreateProfile(user);
      await getOrCreateUserStats(user.id);
      await getOrCreateUserSettings(user.id);

      Alert.alert('Success!', 'Welcome to CertamenPrep!');
      onLoginSuccess();
    }
  };

  const handleGoogleLogin = () => runLogin('Google', signInWithGoogle);
  const handleAppleLogin = () => runLogin('Apple', signInWithApple);

  return (
    <View style={styles.container}>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome</Text>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.toText}>to</Text>
          <View style={styles.dividerLine} />
        </View>
        <Text face="brand" style={styles.appName}>
          CertamenPrep
        </Text>
        <Text style={styles.tagline}>Practice like it's real.</Text>
      </View>

      <View style={styles.googleSlot}>
        <Text style={styles.loginPrompt}>Log in / Sign up</Text>
        <LoginButton
          icon={<Google />}
          label={isLoading ? 'Signing in...' : 'Sign in with Google'}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        />
      </View>

      <View style={styles.belowGoogle}>
        {Platform.OS === 'ios' && (
          <View
            style={[styles.appleButtonWrap, isLoading && styles.appleButtonDisabled]}
            pointerEvents={isLoading ? 'none' : 'auto'}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.appleButton}
              onPress={handleAppleLogin}
            />
          </View>
        )}

        {onGuestMode && (
          <TouchableOpacity
            style={[styles.guestButton, isLoading && styles.appleButtonDisabled]}
            onPress={onGuestMode}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.privacyLink}>Privacy Policy</Text>
        </TouchableOpacity>
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
  const styles = useIPadScaledStyles(baseStyles);
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

  // White container so the multicolor Google "G" stays fully saturated
  // (the previous gold wash muted the brand colors).
  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#f2f2f2'],
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
          <View style={styles.iconContainer}>{icon}</View>
          <SystemText style={styles.buttonText}>{label}</SystemText>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    width: '100%',
  },
  googleSlot: {
    flex: 0.62,
    justifyContent: 'flex-end',
  },
  belowGoogle: {
    flex: 1,
    gap: 12,
    paddingTop: 12,
  },
  welcomeSection: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 0,
  },
  welcomeText: {
    fontSize: 38,
    letterSpacing: 1.6,
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
    fontSize: 15,
    fontStyle: 'italic',
    color: '#6a6a6a',
    letterSpacing: 0.5,
  },
  appName: {
    fontSize: 38,
    letterSpacing: 1.2,
    color: '#3a3a3a',
    marginTop: 8,
  },
  tagline: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#6a6a6a',
    letterSpacing: 0.2,
    marginTop: 12,
    textAlign: 'center',
  },
  loginSection: {
    width: '100%',
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: 16,
    color: '#5a5a5a',
    letterSpacing: 0.4,
    marginBottom: 16,
  },
  buttonsContainer: {
    gap: 12,
    width: '100%',
    alignItems: 'stretch',
  },
  buttonOuter: {
    width: '100%',
  },
  appleButtonWrap: {
    width: '100%',
  },
  appleButtonDisabled: {
    opacity: 0.6,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 60, 0.2)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    width: '100%',
  },
  iconContainer: {
    width: 16,
    height: 16,
  },
  buttonText: {
    color: '#3c4043',
    letterSpacing: -0.2,
    fontSize: 18,
    fontWeight: '400',
  },
  guestButton: {
    alignSelf: 'center',
    width: '72%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#e4d8c8',
    borderWidth: 1,
    borderColor: 'rgba(90, 74, 52, 0.16)',
  },
  guestButtonText: {
    color: '#2c261f',
    letterSpacing: 0.15,
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
  },
  privacyLink: {
    marginTop: 0,
    color: '#6a6a6a',
    fontSize: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
    letterSpacing: 0.1,
  },
});
