import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function ListItem({
  title,
  subtitle,
  icon,
  rightElement,
  showChevron = true,
  onPress,
  onLongPress,
  disabled = false,
  destructive = false,
  style,
  testID,
}: ListItemProps) {
  const titleColor = destructive
    ? colors.error.main
    : disabled
    ? colors.text.disabled
    : colors.text.primary;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}

      <View style={styles.content}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {rightElement && <View style={styles.rightElement}>{rightElement}</View>}

      {showChevron && onPress && (
        <ChevronRight
          size={24}
          color={colors.grey[400]}
          style={styles.chevron}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  iconContainer: {
    marginRight: spacing.lg,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  rightElement: {
    marginLeft: spacing.md,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
