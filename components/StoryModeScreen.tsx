import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PracticeCategorySessionPicker } from './PracticeCategorySessionPicker';

/**
 * Practice Mode (story route): pick a category, then timed session using difficulty from Practice settings.
 */
export function StoryModeScreen({
  onNavigate,
  showBackToMenu = true,
}: {
  onNavigate?: (
    screen: string,
    category?: string,
    practiceDifficulty?: 'easy' | 'medium' | 'hard'
  ) => void;
  showBackToMenu?: boolean;
}) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.settingsRow}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => onNavigate?.('settings-practice')}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.titleText}>Practice Mode</Text>
        <Text style={styles.subtitle}>Choose a category to start</Text>

        <View style={styles.pickerWrap}>
          <PracticeCategorySessionPicker onNavigate={onNavigate} />
        </View>

        {showBackToMenu && (
          <TouchableOpacity style={styles.backButton} onPress={() => onNavigate?.('main')}>
            <Text style={styles.backButtonText}>Back to menu</Text>
          </TouchableOpacity>
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Further adjustments (difficulty level, number of questions, etc...) are in the Settings. Progress here
            affects your score and rank as usual.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 88,
    paddingBottom: 32,
    gap: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  settingsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
    fontSize: 13,
    letterSpacing: 0.5,
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: '#6a6a6a',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.3,
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
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 97, 0.3)',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
