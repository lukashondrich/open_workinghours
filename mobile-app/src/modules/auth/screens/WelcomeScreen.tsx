/**
 * WelcomeScreen - Entry point for unauthenticated users
 * Offers choice between "Log In" (returning users) and "Create Account" (new users)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';

interface WelcomeScreenProps {
  onLoginPress: () => void;
  onRegisterPress: () => void;
}

export default function WelcomeScreen({ onLoginPress, onRegisterPress }: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('welcome.title')}</Text>
          <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        </View>

        <View style={styles.buttons}>
          <Button
            onPress={onLoginPress}
            fullWidth
            testID="login-button"
          >
            {t('welcome.logIn')}
          </Button>

          <Button
            variant="secondary"
            onPress={onRegisterPress}
            fullWidth
            testID="register-button"
          >
            {t('welcome.createAccount')}
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.section,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    gap: spacing.md,
  },
});
