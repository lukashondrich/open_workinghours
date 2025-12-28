import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    isDisabled && styles[`variant_${variant}_disabled`],
    fullWidth && styles.fullWidth,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    styles[`text_${size}`],
    styles[`text_${variant}`],
    isDisabled && styles[`text_${variant}_disabled`],
    textStyle,
  ].filter(Boolean) as TextStyle[];

  const spinnerColor =
    variant === 'primary' || variant === 'danger'
      ? colors.white
      : colors.primary[500];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={spinnerColor}
          size={size === 'sm' ? 'small' : 'small'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={textStyles}>{children}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  fullWidth: {
    width: '100%',
  },

  // Sizes
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: 44,
  },
  size_lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: 52,
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.primary[500],
  },
  variant_primary_disabled: {
    backgroundColor: colors.primary[200],
  },
  variant_secondary: {
    backgroundColor: colors.grey[100],
  },
  variant_secondary_disabled: {
    backgroundColor: colors.grey[100],
  },
  variant_outline: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  variant_outline_disabled: {
    borderColor: colors.grey[300],
  },
  variant_danger: {
    backgroundColor: colors.error.main,
  },
  variant_danger_disabled: {
    backgroundColor: colors.error.light,
  },
  variant_ghost: {
    backgroundColor: colors.transparent,
    ...shadows.none,
  },
  variant_ghost_disabled: {},

  // Text styles
  text: {
    fontWeight: fontWeight.semibold,
  },
  text_sm: {
    fontSize: fontSize.sm,
  },
  text_md: {
    fontSize: fontSize.md,
  },
  text_lg: {
    fontSize: fontSize.lg,
  },
  text_primary: {
    color: colors.white,
  },
  text_primary_disabled: {
    color: colors.white,
  },
  text_secondary: {
    color: colors.text.primary,
  },
  text_secondary_disabled: {
    color: colors.text.disabled,
  },
  text_outline: {
    color: colors.primary[500],
  },
  text_outline_disabled: {
    color: colors.grey[400],
  },
  text_danger: {
    color: colors.white,
  },
  text_danger_disabled: {
    color: colors.error.dark,
  },
  text_ghost: {
    color: colors.primary[500],
  },
  text_ghost_disabled: {
    color: colors.text.disabled,
  },
});
