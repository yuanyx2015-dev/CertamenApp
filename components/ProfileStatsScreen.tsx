import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ProfileStatsScreen() {
  return (
    <View style={styles.container}>
      {/* Stats Container */}
      <View style={styles.statsContainer}>
        {/* Name Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Name:</Text>
            <Text style={styles.valueText}>___</Text>
          </View>
        </View>

        {/* Score Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Score:</Text>
            <Text style={styles.valueText}>___</Text>
          </View>
        </View>

        {/* Rank Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Rank:</Text>
            <Text style={styles.valueText}>___</Text>
          </View>
        </View>

        {/* Win Streak Field */}
        <View style={styles.statBox}>
          <View style={styles.statRow}>
            <Text style={styles.labelText}>Win Streak:</Text>
            <Text style={styles.valueText}>___</Text>
          </View>
        </View>
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
});