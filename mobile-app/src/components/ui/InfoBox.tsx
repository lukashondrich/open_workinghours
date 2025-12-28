import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import {
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';

type InfoBoxVariant = 'info' | 'warning' | 'error' | 'success';

interface InfoBoxProps {
  children: React.ReactNode;
  variant?: InfoBoxVariant;
  title?: string;
  showIcon?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const variantConfig = {
  info: {
    backgroundColor: colors.info.light,
    borderColor: colors.info.main,
    textColor: colors.info.dark,
    Icon: Info,
  },
  warning: {
    backgroundColor: colors.warning.light,
    borderColor: colors.warning.main,
    textColor: colors.warning.dark,
    Icon: AlertTriangle,
  },
  error: {
    backgroundColor: colors.error.light,
    borderColor: colors.error.main,
    textColor: colors.error.dark,
    Icon: AlertCircle,
  },
  success: {
    backgroundColor: colors.success.light,
    borderColor: colors.success.main,
    textColor: colors.success.dark,
    Icon: CheckCircle2,
  },
};

export function InfoBox({
  children,
  variant = 'info',
  title,
  showIcon = true,
  style,
  testID,
}: InfoBoxProps) {
  const config = variantConfig[variant];
  const IconComponent = config.Icon;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderLeftColor: config.borderColor,
        },
        style,
      ]}
      testID={testID}
    >
      {showIcon && (
        <View style={styles.iconContainer}>
          <IconComponent size={20} color={config.textColor} />
        </View>
      )}

      <View style={styles.content}>
        {title && (
          <Text style={[styles.title, { color: config.textColor }]}>
            {title}
          </Text>
        )}
        <Text style={[styles.text, { color: config.textColor }]}>
          {children}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
  },
  iconContainer: {
    marginRight: spacing.md,
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  text: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
