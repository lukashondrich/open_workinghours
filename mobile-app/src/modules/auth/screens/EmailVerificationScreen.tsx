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
      Alert.alert('Email required', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address');
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

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Code required', 'Please enter the verification code from your email');
      return;
    }

    try {
      setLoading(true);
      const result = await AuthService.verifyCode(email.trim(), code.trim());

      if (result.success) {
        // Email verified successfully, proceed to next screen
        onVerified(email.trim().toLowerCase());
      } else {
        Alert.alert('Verification failed', result.message || 'Invalid code');
      }
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Unknown error');
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
          <Text style={styles.title}>Open Working Hours</Text>
          <Text style={styles.subtitle}>Privacy-first hour tracking for healthcare workers</Text>

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

              <Text style={styles.hint}>
                You'll receive a 6-digit verification code via email
              </Text>
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
                onPress={handleVerifyCode}
                loading={loading}
                disabled={loading}
                fullWidth
                testID="verify-code-button"
              >
                Verify Code
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
