import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Modal } from 'react-native';
import { getCurrentUser } from '../services/authService';
import { getOrCreateUserStats, UserStats } from '../services/userStatsService';
import { getProfileByEmail, Profile } from '../services/profileService';

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

interface RankInfo {
  name: string;
  abbreviation: string;
  minScore: number;
  maxScore: number | null;
}

const RANKS: RankInfo[] = [
  { name: 'Miles', abbreviation: 'M', minScore: 0, maxScore: 500 },
  { name: 'Decanus', abbreviation: 'D', minScore: 501, maxScore: 1500 },
  { name: 'Optio', abbreviation: 'O', minScore: 1501, maxScore: 3000 },
  { name: 'Centurio', abbreviation: 'C', minScore: 3001, maxScore: 5000 },
  { name: 'Primus Pilus', abbreviation: 'PP', minScore: 5001, maxScore: 7000 },
  { name: 'Praefectus Castrorum', abbreviation: 'PC', minScore: 7001, maxScore: 10000 },
  { name: 'Legatus Legionis', abbreviation: 'LL', minScore: 10001, maxScore: null },
];

function RankBadge({ rank, isActive, currentScore }: { rank: RankInfo; isActive: boolean; currentScore: number }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatRange = () => {
    if (rank.maxScore === null) {
      return `${rank.name} (${rank.minScore.toLocaleString()}+)`;
    }
    return `${rank.name} (${rank.minScore.toLocaleString()}-${rank.maxScore.toLocaleString()})`;
  };

  return (
    <View style={styles.badgeWrapper}>
      <TouchableOpacity
        onPress={() => setShowTooltip(!showTooltip)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.rankBadge,
          isActive ? styles.rankBadgeActive : styles.rankBadgeInactive
        ]}>
          <Text style={[
            styles.rankBadgeText,
            isActive ? styles.rankBadgeTextActive : styles.rankBadgeTextInactive
          ]}>
            {rank.abbreviation}
          </Text>
        </View>
      </TouchableOpacity>
      
      {showTooltip && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{formatRange()}</Text>
        </View>
      )}
    </View>
  );
}

export function ProfileStatsScreen({ onNavigate, previousScreen, onLogout }: { onNavigate?: (screen: string) => void; previousScreen?: string; onLogout?: () => void }) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userName, setUserName] = useState('___');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      
      const user = await getCurrentUser();
      if (user) {
        // Load profile from database
        if (user.email) {
          const { data: profileData } = await getProfileByEmail(user.email);
          if (profileData) {
            setProfile(profileData);
            setUserName(profileData.display_name || profileData.username || 'User');
          }
        }

        // Fallback to user metadata if profile not found
        if (!profile) {
          const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
          setUserName(displayName);
        }

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

        {/* Win Streak Field - Hidden for now */}
        <View style={[styles.statBox, { opacity: 0, height: 0 }]}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Win Streak:</Text>
            <Text style={styles.valueText}>{userStats?.win_streak || 0}</Text>
          </View>
        </View>
      </View>

      {/* Rank Progression Badges - Hanging Style */}
      <View style={styles.rankBadgesRow}>
        {RANKS.map((rank) => {
          const isActive = userStats?.rank === rank.name;
          return (
            <RankBadge
              key={rank.name}
              rank={rank}
              isActive={isActive}
              currentScore={userStats?.score || 0}
            />
          );
        })}
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
    bottom: 10,
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
  rankBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 32,
    marginBottom: 80,
    paddingHorizontal: 8,
  },
  badgeWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  rankBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  rankBadgeActive: {
    backgroundColor: '#c9a961',
    borderColor: '#9d856b',
  },
  rankBadgeInactive: {
    backgroundColor: '#e0e0e0',
    borderColor: '#bbb',
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rankBadgeTextActive: {
    color: '#fff',
  },
  rankBadgeTextInactive: {
    color: '#999',
  },
  tooltip: {
    position: 'absolute',
    top: -36,
    backgroundColor: 'rgba(58, 58, 58, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
});