/**
 * LoginScreen - For existing users to log in
 * Flow: Email → Request code → Enter code → Login
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
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { AuthService } from '../services/AuthService';
import { t } from '@/lib/i18n';

interface LoginScreenProps {
  email: string;
  onRegisterPress: () => void;
}

export default function LoginScreen({ email: initialEmail, onRegisterPress }: LoginScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.login.emailRequired'), t('auth.login.emailRequiredMessage'));
      return;
    }

    try {
      setLoading(true);
      await AuthService.requestVerificationCode(email.trim());
      setCodeSent(true);
      Alert.alert(t('auth.login.codeSentTitle'), t('auth.login.codeSentMessage'));
    } catch (error) {
      Alert.alert(t('auth.login.failedToSendCode'), error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code.trim()) {
      Alert.alert(t('auth.login.codeRequired'), t('auth.login.codeRequiredMessage'));
      return;
    }

    try {
      setLoading(true);

      // Login returns JWT token + user info
      const result = await AuthService.login(email.trim(), code.trim());

      // Save auth state
      await signIn(result.user, result.token, result.expiresAt);

      // Navigation to main app happens automatically via AuthContext state change
    } catch (error) {
      console.error('[LoginScreen] Login failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error cases
      if (errorMessage.includes('not found') || errorMessage.includes('register first')) {
        Alert.alert(
          t('auth.login.accountNotFound'),
          t('auth.login.accountNotFoundMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.login.register'), onPress: onRegisterPress },
          ]
        );
      } else {
        Alert.alert(t('auth.login.loginFailed'), errorMessage);
      }
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
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

          {!codeSent ? (
            <>
              <Input
                label={t('auth.login.emailLabel')}
                placeholder={t('auth.login.emailPlaceholder')}
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
                {t('auth.login.sendCode')}
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.hint}>{t('auth.login.codeSent', { email })}</Text>

              <Input
                label={t('auth.login.codeLabel')}
                placeholder={t('auth.login.codePlaceholder')}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                testID="code-input"
              />

              <Button
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                fullWidth
                testID="login-button"
              >
                {t('auth.login.logIn')}
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
                  {t('auth.login.changeEmail')}
                </Button>

                <Button
                  variant="ghost"
                  onPress={handleSendCode}
                  disabled={loading}
                  testID="resend-code-button"
                >
                  {t('auth.login.resendCode')}
                </Button>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.login.noAccount')}</Text>
            <Button
              variant="ghost"
              onPress={onRegisterPress}
              disabled={loading}
            >
              {t('auth.login.register')}
            </Button>
          </View>
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
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.section,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
});
