/**
 * EmailVerificationScreen - Step 1 of authentication flow
 * User enters email → receives code → verifies code → proceeds to register or login
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { t } from '@/lib/i18n';
import { Button, Input } from '@/components/ui';
import { AuthService } from '../services/AuthService';

interface EmailVerificationScreenProps {
  onVerified: (email: string) => void;
  initialEmail?: string;
}

export default function EmailVerificationScreen({
  onVerified,
  initialEmail = '',
}: EmailVerificationScreenProps) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert(t('emailVerification.emailRequired'), t('emailVerification.emailRequiredMessage'));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t('emailVerification.invalidEmail'), t('emailVerification.invalidEmailMessage'));
      return;
    }

    try {
      setLoading(true);
      await AuthService.requestVerificationCode(email.trim());
      setCodeSent(true);
      Alert.alert(t('emailVerification.codeSentTitle'), t('emailVerification.codeSentMessage'));
    } catch (error) {
      Alert.alert(t('emailVerification.failedToSendCode'), error instanceof Error ? error.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      Alert.alert(t('emailVerification.codeRequired'), t('emailVerification.codeRequiredMessage'));
      return;
    }

    try {
      setLoading(true);
      const result = await AuthService.verifyCode(email.trim(), code.trim());

      if (result.success) {
        // Email verified successfully, proceed to next screen
        onVerified(email.trim().toLowerCase());
      } else {
        Alert.alert(t('emailVerification.verificationFailed'), result.message || t('emailVerification.invalidCode'));
      }
    } catch (error) {
      Alert.alert(t('emailVerification.verificationFailed'), error instanceof Error ? error.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('emailVerification.title')}</Text>
          <Text style={styles.subtitle}>{t('emailVerification.subtitle')}</Text>

          {!codeSent ? (
            <>
              <Input
                label={t('emailVerification.emailLabel')}
                placeholder={t('emailVerification.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                testID="email-input"
              />

              <Button
                onPress={handleSendCode}
                loading={loading}
                disabled={loading}
                fullWidth
                testID="send-code-button"
              >
                {t('emailVerification.sendCode')}
              </Button>

              <Text style={styles.hint}>
                {t('emailVerification.codeHint')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.hint}>{t('emailVerification.codeSentTo', { email })}</Text>

              <Input
                label={t('emailVerification.codeLabel')}
                placeholder={t('emailVerification.codePlaceholder')}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                testID="code-input"
              />

              <Button
                onPress={handleVerifyCode}
                loading={loading}
                disabled={loading}
                fullWidth
                testID="verify-code-button"
              >
                {t('emailVerification.verifyCode')}
              </Button>

              <View style={styles.linkContainer}>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setCodeSent(false);
                    setCode('');
                  }}
                  disabled={loading}
                  testID="change-email-button"
                >
                  {t('emailVerification.changeEmail')}
                </Button>

                <Button
                  variant="ghost"
                  onPress={handleSendCode}
                  disabled={loading}
                  testID="resend-code-button"
                >
                  {t('emailVerification.resendCode')}
                </Button>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.section,
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
    marginBottom: spacing.section,
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
