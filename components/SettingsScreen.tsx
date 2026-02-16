import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

export function SettingsScreen() {
  const [wrongQuestionsOnly, setWrongQuestionsOnly] = React.useState(false);

  return (
    <View style={styles.container}>
      {/* Centered Content */}
      <View style={styles.contentContainer}>
        {/* Settings Title */}
        <Text style={styles.titleText}>Settings</Text>

        {/* Settings Options */}
        <View style={styles.settingsContainer}>
          {/* # of tossups */}
          <Text style={styles.optionText}># of tossups</Text>

          {/* Wrong questions only with toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.optionText}>Wrong questions only</Text>
            <Switch
              value={wrongQuestionsOnly}
              onValueChange={setWrongQuestionsOnly}
              trackColor={{ false: '#d4d4d4', true: 'rgba(234, 186, 175, 0.7)' }}
              thumbColor={wrongQuestionsOnly ? '#E5C66A' : '#f4f3f4'}
              ios_backgroundColor="#d4d4d4"
            />
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentContainer: {
    width: '100%',
    gap: 32,
  },
  titleText: {
    color: '#3a3a3a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  settingsContainer: {
    gap: 24,
  },
  optionText: {
    color: '#3a3a3a',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});