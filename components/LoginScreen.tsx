import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Mail, Apple, Instagram } from './Icons';
import { supabase } from '../lib/supabase';

// Required for Expo
WebBrowser.maybeCompleteAuthSession();

export function LoginScreen({ onGoogleLogin }: { onGoogleLogin: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  // Set up auth state listener
  useEffect(() => {
    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        Alert.alert('Success', 'Logged in successfully!');
        onGoogleLogin();
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [onGoogleLogin]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      
      // Create the redirect URI
      const redirectUrl = makeRedirectUri({
        scheme: 'certamenapp',
        path: 'auth/callback',
      });

      console.log('Redirect URL:', redirectUrl);
      
      // Sign in with Google OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        Alert.alert('Login Error', error.message);
        setIsLoading(false);
        return;
      }

      // Open the OAuth URL in browser
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
          {
            showInRecents: true,
          }
        );

        if (result.type === 'success' && result.url) {
          // The URL will contain tokens in the hash fragment
          const url = result.url;
          
          // Check if we have tokens in the URL
          if (url.includes('access_token')) {
            // Extract tokens from URL hash
            const params = new URLSearchParams(url.split('#')[1]);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (access_token && refresh_token) {
              // Set the session with the tokens
              const { error: sessionError } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });

              if (sessionError) {
                Alert.alert('Session Error', sessionError.message);
              } else {
                Alert.alert('Success', 'Logged in successfully!');
                onGoogleLogin();
              }
            }
          }
        } else if (result.type === 'cancel') {
          Alert.alert('Cancelled', 'Login was cancelled');
        }
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.message || 'Failed to sign in with Google');
      console.error('Google login error:', error);
    } finally {
      setIsLoading(false);
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
