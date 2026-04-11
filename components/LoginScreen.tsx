import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Mail, Apple } from './Icons';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../services/authService';
import { getOrCreateUserStats } from '../services/userStatsService';
import { getOrCreateUserSettings } from '../services/userSettingsService';
import { getOrCreateProfile } from '../services/profileService';

// Required for Expo
WebBrowser.maybeCompleteAuthSession();
interface LoginScreenProps {
  navigation: any;
  onLoginSuccess: () => void;
  onGuestMode?: () => void;
}


export function LoginScreen({navigation, onLoginSuccess, onGuestMode }: LoginScreenProps) {
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
      // Create/update user profile in database
      await getOrCreateProfile(user);
      
      // Initialize user stats and settings
      await getOrCreateUserStats(user.id);
      await getOrCreateUserSettings(user.id);
      
      Alert.alert('Success!', 'Welcome to CertamenApp!');
      onLoginSuccess();
    }
  };

  const handleAppleLogin = async () => {
    // Expo Go does not include the native Sign in with Apple module (see Expo docs).
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      Alert.alert(
        'Not available in Expo Go',
        'Sign in with Apple requires native code. Use a development build (run npx expo run:ios on a device) or install your app from TestFlight / EAS — not the Expo Go app.'
      );
      return;
    }

    setLoading(true);

    try {
      const rawBytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(rawBytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      console.log('Apple credential received:', {
        user: credential.user,
        hasIdentityToken: !!credential.identityToken,
        hasAuthorizationCode: !!credential.authorizationCode,
      });

      if (credential.identityToken) {
        console.log('Attempting Supabase signInWithIdToken...');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        console.log('Supabase response:', { hasData: !!data, error: error?.message });

        if (error) {
          setLoading(false);
          console.error('Supabase Apple auth error:', error);
          Alert.alert('Apple Login Failed', `Error: ${error.message}\n\nPlease try again or contact support.`);
          return;
        }

        if (data.user) {
          console.log('User authenticated successfully:', data.user.id);
          // Create/update user profile in database
          await getOrCreateProfile(data.user);
          
          // Initialize user stats and settings
          await getOrCreateUserStats(data.user.id);
          await getOrCreateUserSettings(data.user.id);
          
          setLoading(false);
          Alert.alert('Success!', 'Welcome to CertamenApp!');
          onLoginSuccess();
        } else {
          setLoading(false);
          Alert.alert('Apple Login Failed', 'No user data received');
        }
      } else {
        setLoading(false);
        Alert.alert('Apple Login Failed', 'No identity token received');
      }
    } catch (e: any) {
      setLoading(false);
      console.error('Apple authentication exception:', e);
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in flow
        return;
      }
      Alert.alert('Apple Login Failed', e.message || 'An error occurred');
    }
  };

  return (
    <View style={styles.container}>
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome</Text>
        
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.toText}>to</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <Text style={styles.appName}>CertamenApp</Text>
      </View>

      {/* Login Section */}
      <View style={styles.loginSection}>
        <Text style={styles.loginPrompt}>Log in / Sign up</Text>

        {/* Login Buttons */}
        <View style={styles.buttonsContainer}>
          <LoginButton 
            icon={<Mail />} 
            label={isLoading ? "Signing in..." : "Sign in with Google"} 
            onPress={handleGoogleLogin}
            disabled={isLoading}
          />
          
          {/* Apple Sign In — shown on every iOS build; unsupported environments get errors from the handler */}
          {Platform.OS === 'ios' && (
            <LoginButton 
              icon={<Apple />} 
              label={isLoading ? "Signing in..." : "Sign in with Apple"} 
              onPress={handleAppleLogin}
              disabled={isLoading}
            />
          )}
          
          {/* Guest Mode Button */}
          {onGuestMode && (
            <TouchableOpacity 
              style={styles.guestButton}
              onPress={onGuestMode}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function LoginButton({ icon, label, onPress, disabled }: { icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: disabled ? 0.6 : 1 }}>
     <TouchableOpacity 
  onPressIn={handlePressIn}
  onPressOut={handlePressOut}
  onPress={onPress}
  activeOpacity={1}
  disabled={disabled}
>
        <Animated.View style={[styles.button, { backgroundColor }]}>
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
    alignItems: 'center',
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
    minWidth: 200,
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
