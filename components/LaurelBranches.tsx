import React from 'react';
import Svg, { G, Path, Ellipse, Circle } from 'react-native-svg';

export function LaurelBranches() {
  return (
    <Svg width={280} height={100} viewBox="0 0 280 100" fill="none">
      {/* Left laurel branch */}
      <G opacity={0.85}>
        <Path
          d="M 140 50 Q 120 48 100 45 Q 80 42 60 38"
          stroke="#c9a961"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        
        <Ellipse cx={125} cy={46} rx={8} ry={4} fill="#d4b76a" transform="rotate(-15 125 46)" />
        <Ellipse cx={115} cy={44} rx={9} ry={4.5} fill="#c9a961" transform="rotate(-20 115 44)" />
        <Ellipse cx={105} cy={42} rx={8} ry={4} fill="#d4b76a" transform="rotate(-15 105 42)" />
        <Ellipse cx={95} cy={40} rx={9} ry={4.5} fill="#c9a961" transform="rotate(-20 95 40)" />
        <Ellipse cx={85} cy={38} rx={8} ry={4} fill="#d4b76a" transform="rotate(-15 85 38)" />
        <Ellipse cx={75} cy={36} rx={9} ry={4.5} fill="#c9a961" transform="rotate(-20 75 36)" />
        <Ellipse cx={65} cy={35} rx={8} ry={4} fill="#d4b76a" transform="rotate(-15 65 35)" />
        
        <Ellipse cx={120} cy={40} rx={7} ry={3.5} fill="#d4b76a" transform="rotate(15 120 40)" />
        <Ellipse cx={110} cy={37} rx={8} ry={4} fill="#c9a961" transform="rotate(20 110 37)" />
        <Ellipse cx={100} cy={35} rx={7} ry={3.5} fill="#d4b76a" transform="rotate(15 100 35)" />
        <Ellipse cx={90} cy={33} rx={8} ry={4} fill="#c9a961" transform="rotate(20 90 33)" />
        <Ellipse cx={80} cy={31} rx={7} ry={3.5} fill="#d4b76a" transform="rotate(15 80 31)" />
        <Ellipse cx={70} cy={30} rx={8} ry={4} fill="#c9a961" transform="rotate(20 70 30)" />
      </G>

      {/* Right laurel branch */}
      <G opacity={0.85}>
        <Path
          d="M 140 50 Q 160 48 180 45 Q 200 42 220 38"
          stroke="#c9a961"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        
        <Ellipse cx={155} cy={46} rx={8} ry={4} fill="#d4b76a" transform="rotate(15 155 46)" />
        <Ellipse cx={165} cy={44} rx={9} ry={4.5} fill="#c9a961" transform="rotate(20 165 44)" />
        <Ellipse cx={175} cy={42} rx={8} ry={4} fill="#d4b76a" transform="rotate(15 175 42)" />
        <Ellipse cx={185} cy={40} rx={9} ry={4.5} fill="#c9a961" transform="rotate(20 185 40)" />
        <Ellipse cx={195} cy={38} rx={8} ry={4} fill="#d4b76a" transform="rotate(15 195 38)" />
        <Ellipse cx={205} cy={36} rx={9} ry={4.5} fill="#c9a961" transform="rotate(20 205 36)" />
        <Ellipse cx={215} cy={35} rx={8} ry={4} fill="#d4b76a" transform="rotate(15 215 35)" />
        
        <Ellipse cx={160} cy={40} rx={7} ry={3.5} fill="#d4b76a" transform="rotate(-15 160 40)" />
        <Ellipse cx={170} cy={37} rx={8} ry={4} fill="#c9a961" transform="rotate(-20 170 37)" />
        <Ellipse cx={180} cy={35} rx={7} ry={3.5} fill="#d4b76a" transform="rotate(-15 180 35)" />
        <Ellipse cx={190} cy={33} rx={8} ry={4} fill="#c9a961" transform="rotate(-20 190 33)" />
        <Ellipse cx={200} cy={31} rx={7} ry={3.5} fill="#d4b76a" transform="rotate(-15 200 31)" />
        <Ellipse cx={210} cy={30} rx={8} ry={4} fill="#c9a961" transform="rotate(-20 210 30)" />
      </G>

      {/* Center decorative element */}
      <Circle cx={140} cy={50} r={4} fill="#c9a961" opacity={0.8} />
      <Circle cx={140} cy={50} r={2} fill="#d4b76a" />
    </Svg>
  );
}
