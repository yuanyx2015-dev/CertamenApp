import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

// Single Sword Icon
function SingleSwordIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Blade */}
      <Path 
        d="M 30 8 L 32 38 L 28 38 Z" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
      {/* Guard */}
      <Rect 
        x="22" 
        y="37" 
        width="16" 
        height="3" 
        fill="#d4b76a" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
      {/* Handle */}
      <Rect 
        x="28" 
        y="40" 
        width="4" 
        height="10" 
        fill="#8b7355" 
        stroke="#6a5a4a" 
        strokeWidth="0.5"
      />
      {/* Pommel */}
      <Circle 
        cx="30" 
        cy="52" 
        r="3" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="0.5"
      />
    </Svg>
  );
}

// Crossed Swords Icon
function CrossedSwordsIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Left sword */}
      <G transform="rotate(-25 30 30)">
        {/* Blade */}
        <Path 
          d="M 22 10 L 24 35 L 20 35 Z" 
          fill="#c9a961" 
          stroke="#9d856b" 
          strokeWidth="0.5"
        />
        {/* Guard */}
        <Rect 
          x="14" 
          y="34" 
          width="16" 
          height="2.5" 
          fill="#d4b76a" 
          stroke="#9d856b" 
          strokeWidth="0.5"
        />
        {/* Handle */}
        <Rect 
          x="20" 
          y="36.5" 
          width="4" 
          height="8" 
          fill="#8b7355" 
          stroke="#6a5a4a" 
          strokeWidth="0.5"
        />
        {/* Pommel */}
        <Circle 
          cx="22" 
          cy="46" 
          r="2.5" 
          fill="#c9a961" 
          stroke="#9d856b" 
          strokeWidth="0.5"
        />
      </G>
      
      {/* Right sword */}
      <G transform="rotate(25 30 30)">
        {/* Blade */}
        <Path 
          d="M 38 10 L 40 35 L 36 35 Z" 
          fill="#c9a961" 
          stroke="#9d856b" 
          strokeWidth="0.5"
        />
        {/* Guard */}
        <Rect 
          x="30" 
          y="34" 
          width="16" 
          height="2.5" 
          fill="#d4b76a" 
          stroke="#9d856b" 
          strokeWidth="0.5"
        />
        {/* Handle */}
        <Rect 
          x="36" 
          y="36.5" 
          width="4" 
          height="8" 
          fill="#8b7355" 
          stroke="#6a5a4a" 
          strokeWidth="0.5"
        />
        {/* Pommel */}
        <Circle 
          cx="38" 
          cy="46" 
          r="2.5" 
          fill="#c9a961" 
          stroke="#9d856b" 
          strokeWidth="0.5"
        />
      </G>
    </Svg>
  );
}

// Round Shield Icon
function RoundShieldIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Outer ring */}
      <Circle 
        cx="30" 
        cy="30" 
        r="20" 
        fill="#d4b76a" 
        stroke="#9d856b" 
        strokeWidth="1.5"
      />
      {/* Inner decorative ring */}
      <Circle 
        cx="30" 
        cy="30" 
        r="15" 
        fill="none" 
        stroke="#c9a961" 
        strokeWidth="1"
      />
      {/* Center boss */}
      <Circle 
        cx="30" 
        cy="30" 
        r="6" 
        fill="#c9a961" 
        stroke="#9d856b" 
        strokeWidth="1"
      />
      {/* Decorative dots around the edge */}
      <Circle cx="30" cy="10" r="1.5" fill="#9d856b" />
      <Circle cx="30" cy="50" r="1.5" fill="#9d856b" />
      <Circle cx="10" cy="30" r="1.5" fill="#9d856b" />
      <Circle cx="50" cy="30" r="1.5" fill="#9d856b" />
      <Circle cx="44" cy="16" r="1.5" fill="#9d856b" />
      <Circle cx="16" cy="16" r="1.5" fill="#9d856b" />
      <Circle cx="44" cy="44" r="1.5" fill="#9d856b" />
      <Circle cx="16" cy="44" r="1.5" fill="#9d856b" />
    </Svg>
  );
}

// Settings Icon (simplified version without lucide-react)
function SettingsIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke="#9d856b" strokeWidth="1.5" />
      <Path 
        d="M12 2L12 5M12 19L12 22M22 12L19 12M5 12L2 12M18.36 5.64L16.95 7.05M7.05 16.95L5.64 18.36M18.36 18.36L16.95 16.95M7.05 7.05L5.64 5.64" 
        stroke="#9d856b" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MainMenuScreen() {
  return (
    <View style={styles.container}>
      {/* Settings Button - Top Right */}
      <View style={styles.settingsContainer}>
        <TouchableOpacity style={styles.settingsButton}>
          <SettingsIcon />
        </TouchableOpacity>
      </View>

      {/* Center Game Mode Buttons */}
      <View style={styles.centerContainer}>
        {/* Practice Mode Button */}
        <TouchableOpacity style={styles.modeButton}>
          <SingleSwordIcon />
          <Text style={styles.modeButtonText}>Practice Mode</Text>
        </TouchableOpacity>

        {/* PvP Mode Button */}
        <TouchableOpacity style={styles.modeButton}>
          <CrossedSwordsIcon />
          <Text style={styles.modeButtonText}>PvP Mode</Text>
        </TouchableOpacity>

        {/* Offline Mode Button */}
        <TouchableOpacity style={styles.modeButton}>
          <RoundShieldIcon />
          <Text style={styles.modeButtonText}>Offline Mode</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 448,
    alignSelf: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: '100%',
  },
  settingsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 32,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  modeButton: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: {
    fontSize: 18,
    color: '#3a3a3a',
    letterSpacing: 1,
  },
});
