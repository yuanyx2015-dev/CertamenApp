import React from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
import { RomanBackground } from './components/RomanBackground';
import { useAppFonts } from './lib/fonts';

// Hide the yellow "Open debugger to view warnings" banner in development.
LogBox.ignoreAllLogs(true);

export default function App() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5efe3' }}>
        <ActivityIndicator size="large" color="#c9a961" />
      </View>
    );
  }

  return <RomanBackground />;
}
