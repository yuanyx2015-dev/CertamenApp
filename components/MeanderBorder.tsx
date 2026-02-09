import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

export function MeanderBorder() {
  const meanderUnits = Math.ceil(width / 18) + 2;
  
  return (
    <Svg width={width} height={48} viewBox="0 0 360 48" preserveAspectRatio="xMidYMid slice">
      <G transform="translate(0, 18)" opacity={0.4}>
        {Array.from({ length: meanderUnits }).map((_, i) => (
          <G key={i} transform={`translate(${i * 18}, 0)`}>
            <Path
              d="M 0 8 L 0 0 L 16 0 L 16 12 L 4 12 L 4 4 L 12 4 L 12 8"
              stroke="#9d856b"
              strokeWidth={1.2}
              fill="none"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </G>
        ))}
      </G>
    </Svg>
  );
}
