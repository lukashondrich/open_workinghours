/**
 * RegisterScreen - Step 2 of registration flow
 * Collects hospital, specialty, role, state info → creates account
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

interface RegisterScreenProps {
  email: string;
  onLoginPress: () => void;
}

export default function RegisterScreen({ email, onLoginPress }: RegisterScreenProps) {
  const { signIn } = useAuth();
  const [hospitalId, setHospitalId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [roleLevel, setRoleLevel] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!hospitalId.trim()) {
      Alert.alert('Hospital required', 'Please enter your hospital ID');
      return;
    }
    if (!specialty.trim()) {
      Alert.alert('Specialty required', 'Please enter your medical specialty');
      return;
    }
    if (!roleLevel.trim()) {
      Alert.alert('Role required', 'Please enter your role level (e.g., resident, attending)');
      return;
    }

    try {
      setLoading(true);

      // Call backend registration endpoint
      const result = await AuthService.register({
        email,
        hospitalId: hospitalId.trim(),
        specialty: specialty.trim(),
        roleLevel: roleLevel.trim(),
        stateCode: stateCode.trim() || undefined,
      });

      // Save auth state
      await signIn(result.user, result.token, result.expiresAt);

      // Navigation to main app happens automatically via AuthContext state change
    } catch (error) {
      console.error('[RegisterScreen] Registration failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error cases
      if (errorMessage.includes('already exists')) {
        Alert.alert(
          'Account exists',
          'An account with this email already exists. Please use login instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Login', onPress: onLoginPress },
          ]
        );
      } else {
        Alert.alert('Registration failed', errorMessage);
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Complete your profile to start tracking hours</Text>

          <Text style={styles.emailLabel}>Email: {email}</Text>

          <Text style={styles.label}>Hospital ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Charité-Berlin, UKE-Hamburg"
            value={hospitalId}
            onChangeText={setHospitalId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            testID="hospital-input"
          />

          <Text style={styles.label}>Specialty</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Internal Medicine, Surgery, Pediatrics"
            value={specialty}
            onChangeText={setSpecialty}
            autoCapitalize="words"
            editable={!loading}
            testID="specialty-input"
          />

          <Text style={styles.label}>Role Level</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Resident, Attending, Fellow"
            value={roleLevel}
            onChangeText={setRoleLevel}
            autoCapitalize="words"
            editable={!loading}
            testID="role-input"
          />

          <Text style={styles.label}>State Code (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., BW, BY, BE (leave blank if unknown)"
            value={stateCode}
            onChangeText={setStateCode}
            autoCapitalize="characters"
            maxLength={2}
            editable={!loading}
            testID="state-input"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            testID="register-button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={onLoginPress} disabled={loading}>
              <Text style={styles.linkText}>Log in</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyHint}>
            By creating an account, you agree to our privacy policy. Your work hours will be
            aggregated with other users (k-anonymity ≥10) before being published.
          </Text>
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
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6D7E',
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
    marginTop: 12,
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
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#A7C8FF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#5F6D7E',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  privacyHint: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
