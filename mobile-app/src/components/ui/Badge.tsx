import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

const variantStyles = {
  default: {
    backgroundColor: colors.grey[200],
    textColor: colors.text.primary,
  },
  primary: {
    backgroundColor: colors.primary[100],
    textColor: colors.primary[700],
  },
  success: {
    backgroundColor: colors.success.light,
    textColor: colors.success.dark,
  },
  warning: {
    backgroundColor: colors.warning.light,
    textColor: colors.warning.dark,
  },
  error: {
    backgroundColor: colors.error.light,
    textColor: colors.error.dark,
  },
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  style,
  testID,
}: BadgeProps) {
  const variantStyle = variantStyles[variant];

  return (
    <View
      style={[
        styles.container,
        styles[`size_${size}`],
        { backgroundColor: variantStyle.backgroundColor },
        style,
      ]}
      testID={testID}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.text,
          styles[`text_${size}`],
          { color: variantStyle.textColor },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  size_sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  size_md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  icon: {},
  text: {
    fontWeight: fontWeight.medium,
  },
  text_sm: {
    fontSize: fontSize.xs,
  },
  text_md: {
    fontSize: fontSize.sm,
  },
});
