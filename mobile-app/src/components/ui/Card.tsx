import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/theme';

type CardVariant = 'default' | 'elevated' | 'outlined';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  onPress,
  onLongPress,
  style,
  testID,
}: CardProps) {
  const cardStyles: ViewStyle[] = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`padding_${padding}`],
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
  },

  // Variants
  variant_default: {
    ...shadows.md,
  },
  variant_elevated: {
    ...shadows.lg,
  },
  variant_outlined: {
    ...shadows.none,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  // Padding
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: spacing.sm,
  },
  padding_md: {
    padding: spacing.lg,
  },
  padding_lg: {
    padding: spacing.xl,
  },
});
