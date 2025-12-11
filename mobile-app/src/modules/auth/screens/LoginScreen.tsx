/**
 * LoginScreen - For existing users to log in
 * Flow: Email → Request code → Enter code → Login
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
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <Text style={styles.hint}>Code sent to {email}</Text>

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
                onPress={handleLogin}
                disabled={loading}
                testID="login-button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Log In</Text>
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

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={onRegisterPress} disabled={loading}>
              <Text style={styles.linkText}>Register</Text>
            </TouchableOpacity>
          </View>
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
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6D7E',
    marginBottom: 48,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#5F6D7E',
  },
});
