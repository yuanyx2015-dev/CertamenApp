import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Text } from '../lib/AppText';
import { PracticeCategorySessionPicker } from './PracticeCategorySessionPicker';
import { FitScrollView } from './FitScrollView';
import { useIPadScaledStyles } from '../lib/layout';

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
