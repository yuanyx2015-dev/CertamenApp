import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getOrCreateUserStats, UserStats } from '../services/userStatsService';

function AnimatedButton({ label, onPress }: { label: string; onPress: () => void }) {
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
        <Animated.View style={[styles.button, { backgroundColor }]}>
          <Text style={styles.buttonText}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ProfileStatsScreen({ onNavigate, previousScreen, onLogout }: { onNavigate?: (screen: string) => void; previousScreen?: string; onLogout?: () => void }) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userName, setUserName] = useState('___');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      
      const user = await getCurrentUser();
      if (user) {
        // Get user name from email or metadata
        const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
        setUserName(displayName);

        // Load user stats
        const { data: stats } = await getOrCreateUserStats(user.id);
        if (stats) {
          setUserStats(stats);
        }
      }
      
      setIsLoading(false);
    };

    loadUserData();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c9a961" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Container */}
      <View style={styles.statsContainer}>
        {/* Name Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Name:</Text>
            <Text style={styles.valueText}>{userName}</Text>
          </View>
        </View>

        {/* Score Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Score:</Text>
            <Text style={styles.valueText}>{userStats?.score || 0}</Text>
          </View>
        </View>

        {/* Rank Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Rank:</Text>
            <Text style={styles.valueText}>{userStats?.rank || 'Miles'}</Text>
          </View>
        </View>

        {/* Win Streak Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Win Streak:</Text>
            <Text style={styles.valueText}>{userStats?.win_streak || 0}</Text>
          </View>
        </View>
      </View>

      {/* Logout Button - At Bottom */}
      <View style={styles.bottomContainer}>
        {onLogout && (
          <AnimatedButton 
            label="Logout" 
            onPress={onLogout}
          />
        )}
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
    paddingVertical: 80,
    paddingHorizontal: 24,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  statsContainer: {
    marginTop: 32,
    gap: 16,
  },
  statBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelText: {
    color: '#3a3a3a',
    letterSpacing: 0.5,
    fontSize: 16,
  },
  valueText: {
    color: '#6a6a6a',
    letterSpacing: 0.5,
    fontSize: 16,
    marginLeft: 16,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});