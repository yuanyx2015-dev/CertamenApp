import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../lib/AppText';
import { PracticeCategorySessionPicker } from './PracticeCategorySessionPicker';
import { FitScrollView } from './FitScrollView';
import { useIPadScaledStyles } from '../lib/layout';

/** Tiny gear for the Practice Settings button. */
function SettingsGearIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill="#3a3a3a"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
      />
    </Svg>
  );
}

/**
 * Practice Mode hub: pick a category, then timed session using Practice settings.
 */
export function StoryModeScreen({
  onNavigate,
}: {
  onNavigate?: (
    screen: string,
    category?: string,
    practiceDifficulty?: 'easy' | 'medium' | 'hard'
  ) => void;
}) {
  const styles = useIPadScaledStyles(baseStyles);

  return (
    <View style={[styles.container]}>
      <FitScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.settingsRow}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => onNavigate?.('settings-practice')}
          >
            <SettingsGearIcon />
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.titleText}>Practice Mode</Text>
        <Text style={styles.subtitle}>Choose a category to start</Text>

        <View style={styles.pickerWrap}>
          <PracticeCategorySessionPicker onNavigate={onNavigate} />
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Progress in Practice Mode does not affect Challenge Mode, Review, your rank, or anything else — at all.
          </Text>
        </View>
      </FitScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: 'rgba(201, 169, 97, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.25,
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 25,
    letterSpacing: 0.3,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 0,
  },
  subtitle: {
    color: '#6a6a6a',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.15,
    marginBottom: 8,
  },
  pickerWrap: {
    width: '100%',
    marginTop: 8,
  },
  footerNote: {
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  footerText: {
    color: '#6a6a6a',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
