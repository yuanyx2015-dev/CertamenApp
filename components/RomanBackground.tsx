import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MainMenuScreen } from './MainMenuScreen';
import { LaurelBranches } from './LaurelBranches';
import { MeanderBorder } from './MeanderBorder';
import { ProfileStatsScreen } from './ProfileStatsScreen';
import { MatchSelectionScreen } from './MatchSelectionScreen';

const { height } = Dimensions.get('window');

export function RomanBackground() {
  return (
    <View style={styles.container}>
      {/* Parchment background */}
      <View style={styles.parchment} />
      
      {/* Top header with laurel branches */}
      <View style={styles.headerContainer}>
        <LaurelBranches />
      </View>

      {/* Main content area */}
      <View style={styles.contentContainer}>
        <MatchSelectionScreen />
      </View>

      {/* Bottom footer with meander border */}
      <View style={styles.footerContainer}>
        <MeanderBorder />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5efe3',
    position: 'relative',
  },
  parchment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5efe3',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    zIndex: 5,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
});
