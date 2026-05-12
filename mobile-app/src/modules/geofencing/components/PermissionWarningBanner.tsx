import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { t } from '@/lib/i18n';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  visible: boolean;
  onDismiss?: () => void;
  onDontAskAgain?: () => void;
  title?: string;
  message?: string;
  showDontAskAgain?: boolean;
}

export default function PermissionWarningBanner({
  visible,
  onDismiss,
  onDontAskAgain,
  title = t('permissionWarning.title'),
  message = t('permissionWarning.message'),
  showDontAskAgain = false,
}: Props) {
  const navigation = useNavigation<NavigationProp>();

  if (!visible) {
    return null;
  }

  const handleGoToSettings = () => {
    navigation.navigate('Permissions');
  };

  return (
    <View style={styles.container}>
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
        >
          <X size={18} color={colors.info.dark} />
        </TouchableOpacity>
      )}
      <View style={styles.content}>
        <Text style={styles.icon}>i</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleGoToSettings}
          accessible={true}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t('permissionWarning.goToSettings')}</Text>
        </TouchableOpacity>
        {showDontAskAgain && onDontAskAgain && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onDontAskAgain}
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>{t('permissionWarning.dontAskAgain')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.info.light,
    borderLeftWidth: 4,
    borderLeftColor: colors.info.main,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.md,
    borderRadius: borderRadius.md,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
    zIndex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.info.main,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.info.dark,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.info.dark,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  button: {
    backgroundColor: colors.info.main,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.info.dark,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
