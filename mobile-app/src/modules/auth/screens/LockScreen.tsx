/**
 * LockScreen - Biometric unlock screen for returning users
 *
 * Shown when user has biometric unlock enabled and returns to the app.
 * Follows N26/Revolut pattern with Face ID auto-prompt on mount.
 *
 * Options:
 * 1. Unlock with Face ID (primary, auto-triggered)
 * 2. Use device passcode (secondary)
 * 3. Sign in with email (tertiary - full sign out)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScanFace, Fingerprint } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';
import { BiometricService } from '@/lib/auth/BiometricService';
import { isTestMode } from '@/lib/testing/mockApi';

interface LockScreenProps {
  onUnlock: () => void;
  onSignInWithEmail: () => void;
}

export default function LockScreen({ onUnlock, onSignInWithEmail }: LockScreenProps) {
  const [biometricType, setBiometricType] = useState<string>('Face ID');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  // TEST_MODE bypass - check synchronously to avoid render flash
  const testMode = isTestMode();

  // Get biometric type for display
  useEffect(() => {
    BiometricService.getBiometricType().then(setBiometricType);
  }, []);

  // Auto-prompt biometric on mount (N26 pattern)
  useEffect(() => {
    // Skip auto-prompt in test mode - call onUnlock immediately
    if (testMode) {
      console.log('[LockScreen] Test mode - bypassing biometric');
      onUnlock();
      return;
    }

    // Only auto-prompt once
    if (!hasAttempted) {
      setHasAttempted(true);
      attemptBiometricUnlock();
    }
  }, [testMode, hasAttempted, onUnlock]);

  // In test mode, render nothing to avoid any UI flash
  if (testMode) {
    return null;
  }

  const attemptBiometricUnlock = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const success = await BiometricService.authenticate(
        t('biometric.promptReason')
      );

      if (success) {
        onUnlock();
      } else {
        setError(t('lock.authFailed'));
      }
    } catch (err) {
      console.error('[LockScreen] Biometric error:', err);
      setError(t('lock.authFailed'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const attemptPasscodeUnlock = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const success = await BiometricService.authenticateWithPasscodeOnly(
        t('biometric.promptReason')
      );

      if (success) {
        onUnlock();
      } else {
        setError(t('lock.authFailed'));
      }
    } catch (err) {
      console.error('[LockScreen] Passcode error:', err);
      setError(t('lock.authFailed'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignInWithEmail = () => {
    // Full sign out - clears stored credentials and shows login flow
    onSignInWithEmail();
  };

  // Determine which icon to show based on biometric type
  const BiometricIcon = biometricType.toLowerCase().includes('face')
    ? ScanFace
    : Fingerprint;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header / Branding */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('lock.title')}</Text>
        </View>

        {/* Biometric Icon */}
        <View style={styles.iconContainer}>
          <BiometricIcon
            size={80}
            color={colors.primary[500]}
            strokeWidth={1.5}
          />
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Primary: Unlock with Face ID / Touch ID */}
          <Button
            onPress={attemptBiometricUnlock}
            loading={isAuthenticating}
            disabled={isAuthenticating}
            fullWidth
            testID="unlock-biometric-button"
          >
            {t('lock.unlockWith', { type: biometricType })}
          </Button>

          {/* Secondary: Use device passcode */}
          <TouchableOpacity
            onPress={attemptPasscodeUnlock}
            disabled={isAuthenticating}
            style={styles.linkButton}
            testID="unlock-passcode-link"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.linkText, isAuthenticating && styles.linkTextDisabled]}>
              {t('lock.usePasscode')}
            </Text>
          </TouchableOpacity>

          {/* Tertiary: Sign in with email */}
          <TouchableOpacity
            onPress={handleSignInWithEmail}
            disabled={isAuthenticating}
            style={styles.linkButton}
            testID="sign-in-email-link"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.linkText, styles.linkTextTertiary, isAuthenticating && styles.linkTextDisabled]}>
              {t('lock.signInWithEmail')}
            </Text>
          </TouchableOpacity>
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
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  errorContainer: {
    backgroundColor: colors.error.light,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error.dark,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.lg,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.md,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  linkTextTertiary: {
    color: colors.text.secondary,
  },
  linkTextDisabled: {
    color: colors.text.disabled,
  },
});
