import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Mail, Apple, Instagram } from './Icons';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../services/authService';

// Required for Expo
WebBrowser.maybeCompleteAuthSession();
interface LoginScreenProps {
  navigation: any;
  onLoginSuccess: () => void;
}


export function LoginScreen({navigation, onLoginSuccess }: LoginScreenProps) {
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
      Alert.alert('Success', 'Logged in with Google successfully!');
      onLoginSuccess();
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
        
        <Text style={styles.appName}>Certatio</Text>
      </View>

      {/* Login Section */}
      <View style={styles.loginSection}>
        <Text style={styles.loginPrompt}>Log in / Sign up</Text>

        {/* Login Buttons */}
        <View style={styles.buttonsContainer}>
          <LoginButton 
            icon={<Mail />} 
            label={isLoading ? "Signing in..." : "Gmail"} 
            onPress={handleGoogleLogin}
            disabled={isLoading}
          />
          <LoginButton icon={<Apple />} label="Apple" onPress={() => {}} />
          <LoginButton icon={<Instagram />} label="Instagram" onPress={() => {}} />
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
});
