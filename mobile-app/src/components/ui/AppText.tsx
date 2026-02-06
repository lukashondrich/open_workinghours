import React from 'react';
import { Text, TextProps } from 'react-native';

const MAX_FONT_SCALE = 1.3;

export function AppText(props: TextProps) {
  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
