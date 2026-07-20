import React from 'react';
import { LogBox } from 'react-native';
import { RomanBackground } from './components/RomanBackground';

// Hide the yellow "Open debugger to view warnings" banner in development.
LogBox.ignoreAllLogs(true);

export default function App() {
  return <RomanBackground />;
}
