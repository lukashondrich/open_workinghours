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
      Alert.alert('Email required', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await AuthService.requestVerificationCode(email.trim());
      setCodeSent(true);
      Alert.alert('Code sent', 'Please check your email for the verification code');
    } catch (error) {
      Alert.alert('Failed to send code', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!code.trim()) {
      Alert.alert('Code required', 'Please enter the verification code from your email');
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
          'Account not found',
          'No account found with this email. Please register first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Register', onPress: onRegisterPress },
          ]
        );
      } else {
        Alert.alert('Login failed', errorMessage);
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to continue tracking hours</Text>

          {!codeSent ? (
            <>
              <Input
                label="Email Address"
                placeholder="your.email@example.com"
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
                Send Verification Code
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.hint}>Code sent to {email}</Text>

              <Input
                label="Verification Code"
                placeholder="Enter verification code"
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
                Log In
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
                  Change email address
                </Button>

                <Button
                  variant="ghost"
                  onPress={handleSendCode}
                  disabled={loading}
                  testID="resend-code-button"
                >
                  Resend code
                </Button>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Button
              variant="ghost"
              onPress={onRegisterPress}
              disabled={loading}
            >
              Register
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
