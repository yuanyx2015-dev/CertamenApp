import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, Modal, Alert } from 'react-native';
import { getCurrentUser, signOut } from '../services/authService';
import { getOrCreateUserStats, UserStats } from '../services/userStatsService';
import { getProfileByEmail, Profile, deleteAccount } from '../services/profileService';
import Svg, { Path } from 'react-native-svg';

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

function TrashIcon({ size = 20, color = '#d32f2f' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 11v6M14 11v6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      // Get current user to pass their ID
      const user = await getCurrentUser();
      
      if (!user) {
        Alert.alert(
          'Error',
          'Could not verify user identity.',
          [{ text: 'OK' }]
        );
        setIsDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      console.log('Deleting account for auth user:', user.id);
      console.log('Profile ID:', profile?.id);

      // Call the Edge Function to delete account (handles both DB and Auth)
      const { error: deleteError } = await deleteAccount();
      
      if (deleteError) {
        console.error('Delete account error details:', deleteError);
        Alert.alert(
          'Error',
          `Failed to delete account: ${deleteError.message || 'Unknown error'}. Please try again or contact support.`,
          [{ text: 'OK' }]
        );
        setIsDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      // Sign out locally (account is already deleted from Supabase)
      await signOut();

      // Close modal and navigate back to login
      setShowDeleteModal(false);
      if (onLogout) {
        onLogout();
      }
    } catch (error: any) {
      console.error('Error during account deletion:', error);
      Alert.alert(
        'Error',
        `An unexpected error occurred: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

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

      {/* Rank Progression Badges - 4 on top, 3 on bottom */}
      <View style={styles.rankBadgesContainer}>
        {/* Top row - First 4 ranks */}
        <View style={styles.rankBadgesRow}>
          {RANKS.slice(0, 4).map((rank) => {
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
        
        {/* Bottom row - Last 3 ranks */}
        <View style={styles.rankBadgesRow}>
          {RANKS.slice(4, 7).map((rank) => {
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
      </View>

      {/* Logout Button - At Bottom Center */}
      <View style={styles.bottomContainer}>
        {onLogout && (
          <AnimatedButton 
            label="Logout" 
            onPress={onLogout}
          />
        )}
      </View>

      {/* Delete Account Button - Bottom Left Corner */}
      <TouchableOpacity 
        style={styles.deleteIconButton}
        onPress={() => setShowDeleteModal(true)}
        activeOpacity={0.7}
      >
        <TrashIcon size={20} color="#d32f2f" />
      </TouchableOpacity>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete your account? All of your information, including your score, rank, and progress will be permanently lost. This action cannot be undone.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmDeleteButton]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    shadowOffset: { width: -1.5, height: 1.5 },
    shadowOpacity: 0.22,
    shadowRadius: 2.25,
    elevation: 3,
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
    gap: 12,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: -1.5, height: 1.5 },
    shadowOpacity: 0.22,
    shadowRadius: 2.25,
    elevation: 3,
  },
  buttonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  rankBadgesContainer: {
    marginTop: 32,
    marginBottom: 80,
    gap: 20,
    alignItems: 'center',
  },
  rankBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
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
    shadowOpacity: 0.19,
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
  deleteIconButton: {
    position: 'absolute',
    bottom: 10,
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.19,
    shadowRadius: 3,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3a3a3a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6a6a6a',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    backgroundColor: '#d32f2f',
  },
  confirmDeleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});