/**
 * RegisterScreen - Step 2 of registration flow
 * Collects hospital, specialty, role, state info → creates account
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
import { Button, Input, InfoBox } from '@/components/ui';
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

          <Input
            label="Hospital ID"
            placeholder="e.g., Charite-Berlin, UKE-Hamburg"
            value={hospitalId}
            onChangeText={setHospitalId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            testID="hospital-input"
          />

          <Input
            label="Specialty"
            placeholder="e.g., Internal Medicine, Surgery, Pediatrics"
            value={specialty}
            onChangeText={setSpecialty}
            autoCapitalize="words"
            editable={!loading}
            testID="specialty-input"
          />

          <Input
            label="Role Level"
            placeholder="e.g., Resident, Attending, Fellow"
            value={roleLevel}
            onChangeText={setRoleLevel}
            autoCapitalize="words"
            editable={!loading}
            testID="role-input"
          />

          <Input
            label="State Code (Optional)"
            placeholder="e.g., BW, BY, BE (leave blank if unknown)"
            value={stateCode}
            onChangeText={setStateCode}
            autoCapitalize="characters"
            maxLength={2}
            editable={!loading}
            testID="state-input"
          />

          <Button
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            fullWidth
            testID="register-button"
            style={styles.registerButton}
          >
            Create Account
          </Button>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Button
              variant="ghost"
              onPress={onLoginPress}
              disabled={loading}
            >
              Log in
            </Button>
          </View>

          <InfoBox variant="info" style={styles.privacyInfo}>
            By creating an account, you agree to our privacy policy. Your work hours will be
            aggregated with other users (k-anonymity ≥10) before being published.
          </InfoBox>
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
    paddingVertical: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
  },
  emailLabel: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.xxl,
  },
  registerButton: {
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  privacyInfo: {
    marginTop: spacing.xxl,
  },
});
