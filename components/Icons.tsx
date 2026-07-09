import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export function Mail() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a961" strokeWidth="1.5">
      <Rect x="2" y="4" width="20" height="16" rx="2" />
      <Path d="M22 7L13.03 12.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </Svg>
  );
}

export function Instagram() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a961" strokeWidth="1.5">
      <Rect x="2" y="2" width="20" height="20" rx="5" />
      <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <Path d="M17.5 6.5h.01" strokeLinecap="round" />
    </Svg>
  );
}
