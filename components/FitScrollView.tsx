import React, { useState } from 'react';
import { ScrollView, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';

/**
 * ScrollView that disables scrolling (and bounce) when content fits in the viewport.
 * Use for page bodies so short screens don't rubber-band under empty space.
 */
export function FitScrollView({
  children,
  onLayout,
  onContentSizeChange,
  scrollEnabled: scrollEnabledProp,
  bounces,
  alwaysBounceVertical,
  ...rest
}: ScrollViewProps) {
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const needsScroll = contentH > viewportH + 2;
  const scrollEnabled =
    scrollEnabledProp === false ? false : needsScroll;

  const handleLayout = (e: LayoutChangeEvent) => {
    setViewportH(e.nativeEvent.layout.height);
    onLayout?.(e);
  };

  const handleContentSizeChange = (w: number, h: number) => {
    setContentH(h);
    onContentSizeChange?.(w, h);
  };

  return (
    <ScrollView
      {...rest}
      onLayout={handleLayout}
      onContentSizeChange={handleContentSizeChange}
      scrollEnabled={scrollEnabled}
      bounces={bounces ?? scrollEnabled}
      alwaysBounceVertical={alwaysBounceVertical ?? false}
    >
      {children}
    </ScrollView>
  );
}
