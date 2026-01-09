/**
 * RegisterScreen - Step 2 of registration flow
 * Collects hospital, specialty, role, state info → creates account
 * Shows GDPR consent modal before registration
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
import { t } from '@/lib/i18n';
import { ConsentBottomSheet } from '../components/ConsentBottomSheet';
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  createConsentRecord,
} from '@/lib/auth/consent-types';
import { ConsentStorage } from '@/lib/auth/ConsentStorage';

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
  const [showConsent, setShowConsent] = useState(false);

  // Validate form before showing consent modal
  const validateForm = (): boolean => {
    if (!hospitalId.trim()) {
      Alert.alert(t('auth.register.hospitalRequired'), t('auth.register.hospitalRequiredMessage'));
      return false;
    }
    if (!specialty.trim()) {
      Alert.alert(t('auth.register.specialtyRequired'), t('auth.register.specialtyRequiredMessage'));
      return false;
    }
    if (!roleLevel.trim()) {
      Alert.alert(t('auth.register.roleRequired'), t('auth.register.roleRequiredMessage'));
      return false;
    }
    return true;
  };

  // Called when user taps "Create Account" - shows consent modal
  const handleCreateAccountPress = () => {
    if (!validateForm()) return;
    setShowConsent(true);
  };

  // Called after user accepts consent - proceeds with registration
  const handleConsentAccepted = async () => {
    try {
      setLoading(true);

      // Create consent record
      const consentRecord = createConsentRecord();

      // Call backend registration endpoint with consent data
      const result = await AuthService.register({
        email,
        hospitalId: hospitalId.trim(),
        specialty: specialty.trim(),
        roleLevel: roleLevel.trim(),
        stateCode: stateCode.trim() || undefined,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      });

      // Save consent locally
      await ConsentStorage.save(consentRecord);

      // Close consent modal
      setShowConsent(false);

      // Save auth state - navigation happens automatically
      await signIn(result.user, result.token, result.expiresAt);
    } catch (error) {
      console.error('[RegisterScreen] Registration failed:', error);
      setShowConsent(false);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error cases
      if (errorMessage.includes('already exists')) {
        Alert.alert(
          t('auth.register.accountExists'),
          t('auth.register.accountExistsMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.register.goToLogin'), onPress: onLoginPress },
          ]
        );
      } else {
        Alert.alert(t('auth.register.registrationFailed'), errorMessage);
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
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>

          <Text style={styles.emailLabel}>{t('auth.register.email', { email })}</Text>

          <Input
            label={t('auth.register.hospitalLabel')}
            placeholder={t('auth.register.hospitalPlaceholder')}
            value={hospitalId}
            onChangeText={setHospitalId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            testID="hospital-input"
          />

          <Input
            label={t('auth.register.specialtyLabel')}
            placeholder={t('auth.register.specialtyPlaceholder')}
            value={specialty}
            onChangeText={setSpecialty}
            autoCapitalize="words"
            editable={!loading}
            testID="specialty-input"
          />

          <Input
            label={t('auth.register.roleLabel')}
            placeholder={t('auth.register.rolePlaceholder')}
            value={roleLevel}
            onChangeText={setRoleLevel}
            autoCapitalize="words"
            editable={!loading}
            testID="role-input"
          />

          <Input
            label={t('auth.register.stateLabel')}
            placeholder={t('auth.register.statePlaceholder')}
            value={stateCode}
            onChangeText={setStateCode}
            autoCapitalize="characters"
            maxLength={2}
            editable={!loading}
            testID="state-input"
          />

          <Button
            onPress={handleCreateAccountPress}
            loading={loading}
            disabled={loading}
            fullWidth
            testID="register-button"
            style={styles.registerButton}
          >
            {t('auth.register.createAccount')}
          </Button>

          <Text style={styles.preAnnounce}>{t('consent.preAnnounce')}</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.haveAccount')}</Text>
            <Button
              variant="ghost"
              onPress={onLoginPress}
              disabled={loading}
            >
              {t('auth.register.logIn')}
            </Button>
          </View>

        </View>
      </ScrollView>

      {/* GDPR Consent Modal */}
      <ConsentBottomSheet
        visible={showConsent}
        onAccept={handleConsentAccepted}
        onCancel={() => setShowConsent(false)}
        mode="initial"
        loading={loading}
      />
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
  preAnnounce: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
