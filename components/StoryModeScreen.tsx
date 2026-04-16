import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { DifficultySessionPicker } from './DifficultySessionPicker';

/** Distance from top of Easy row to vertical center of Medium (Easy + gap + half Medium), ~px. */
const PX_EASY_TOP_TO_MEDIUM_CENTER = 96;

/** Push title + difficulty block slightly lower (px added to computed picker margin). */
const CONTENT_NUDGE_DOWN = 28;

/**
 * Practice Mode (story route): timed sessions that do not change profile score or rank.
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
  const { height: winH } = useWindowDimensions();
  const titleRef = React.useRef<View>(null);
  const [pickerMarginTop, setPickerMarginTop] = React.useState(24);

  const alignMediumToScreenCenter = React.useCallback(() => {
    const gapBelowTitle = 14;
    titleRef.current?.measureInWindow((_x, y, _w, h) => {
      const titleBottom = y + h;
      const targetTopEasy = winH / 2 - PX_EASY_TOP_TO_MEDIUM_CENTER;
      setPickerMarginTop(
        Math.max(8, targetTopEasy - titleBottom - gapBelowTitle) + CONTENT_NUDGE_DOWN
      );
    });
  }, [winH]);

  const onTitleLayout = React.useCallback(
    (_e: LayoutChangeEvent) => {
      alignMediumToScreenCenter();
    },
    [alignMediumToScreenCenter]
  );

  React.useLayoutEffect(() => {
    alignMediumToScreenCenter();
  }, [alignMediumToScreenCenter]);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.headerArea}>
          <View style={styles.settingsRow}>
            <TouchableOpacity style={styles.settingsButton} onPress={() => onNavigate?.('settings-practice')}>
              <Text style={styles.settingsButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
          <View ref={titleRef} onLayout={onTitleLayout} style={styles.titleWrap}>
            <Text style={styles.titleText}>Practice Mode</Text>
          </View>
        </View>

        <View style={[styles.buttonBlock, { marginTop: pickerMarginTop }]}>
          <DifficultySessionPicker onNavigate={onNavigate} showHints={false} />
          <TouchableOpacity style={styles.backButton} onPress={() => onNavigate?.('main')}>
            <Text style={styles.backButtonText}>Back to menu</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSpacer} />

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Change your difficulty to suit your needs. Progress does not count in Practice Mode.
          </Text>
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
    paddingHorizontal: 24,
    position: 'relative',
  },
  inner: {
    flex: 1,
    width: '100%',
  },
  headerArea: {
    width: '100%',
    paddingTop: 88,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  titleWrap: {
    alignItems: 'center',
    marginTop: 12,
  },
  buttonBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  footerSpacer: {
    flex: 1,
    minHeight: 12,
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
  },
  footerNote: {
    width: '100%',
    paddingHorizontal: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerText: {
    color: '#6a6a6a',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  backButton: {
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
