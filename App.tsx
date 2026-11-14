import React from 'react';
import { ActivityIndicator, Alert, LogBox, View, type AlertButton, type AlertOptions } from 'react-native';
import { RomanBackground } from './components/RomanBackground';
import { duckSounds, playButtonSound, playCancelSound, unduckSounds } from './lib/buttonSound';
import { useAppFonts } from './lib/fonts';

const alertSounds = Symbol.for('certamen.alertSounds');
if (!(Alert as unknown as Record<symbol, boolean>)[alertSounds]) {
  const rawAlert = Alert.alert.bind(Alert);
  Alert.alert = ((title?: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    duckSounds();
    let settled = false;
    const finish = (style?: AlertButton['style']) => {
      if (settled) return;
      settled = true;
      if (style === 'cancel' || style === 'destructive') playCancelSound();
      else playButtonSound();
      unduckSounds();
    };
    const given = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    rawAlert(
      title,
      message,
      given.map((button) => ({
        ...button,
        onPress: (value?: string) => {
          finish(button.style);
          button.onPress?.(value);
        },
      })),
      {
        ...options,
        onDismiss: () => {
          if (!settled) {
            settled = true;
            unduckSounds();
          }
          options?.onDismiss?.();
        },
      }
    );
  }) as typeof Alert.alert;
  (Alert as unknown as Record<symbol, boolean>)[alertSounds] = true;
}

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
