import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

const MAX_FONT_SCALE = 1.3;

export function AppTextInput(props: TextInputProps) {
  return <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
