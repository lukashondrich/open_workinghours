/**
 * EmailVerificationScreen - Step 1 of authentication flow
 * User enters email → receives code → verifies code → proceeds to register or login
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
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
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                testID="email-input"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
                testID="send-code-button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Verification Code</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.hint}>
                You'll receive a 6-digit verification code via email
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <Text style={styles.hint}>
                Code sent to {email}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter verification code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                testID="code-input"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
                testID="verify-code-button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setCodeSent(false);
                  setCode('');
                }}
                disabled={loading}
                testID="change-email-button"
              >
                <Text style={styles.linkText}>Change email address</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleSendCode}
                disabled={loading}
                testID="resend-code-button"
              >
                <Text style={styles.linkText}>Resend code</Text>
              </TouchableOpacity>
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
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6D7E',
    marginBottom: 48,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#A7C8FF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  linkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
