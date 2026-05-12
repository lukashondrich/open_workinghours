/**
 * RegisterScreen - Email registration flow
 * Uses shared ProfileForm for the registration form.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '@/theme';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { AuthService } from '../services/AuthService';
import { t } from '@/lib/i18n';
import ProfileForm from '../components/ProfileForm';
import type { ProfileFormData } from '../components/ProfileForm';

interface RegisterScreenProps {
  email: string;
  onLoginPress: () => void;
}

export default function RegisterScreen({ email, onLoginPress }: RegisterScreenProps) {
  const { signIn } = useAuth();

  const handleSubmit = async (data: ProfileFormData) => {
    const result = await AuthService.register({
      email,
      hospitalId: data.hospitalId,
      specialty: data.specialty,
      roleLevel: data.roleLevel,
      stateCode: data.stateCode,
      profession: data.profession,
      seniority: data.seniority,
      departmentGroup: data.departmentGroup,
      hospitalRefId: data.hospitalRefId,
      termsVersion: data.termsVersion,
      privacyVersion: data.privacyVersion,
    });

    await signIn(result.user, result.token, result.expiresAt);
  };

  return (
    <ProfileForm
      onSubmit={handleSubmit}
      email={email}
      submitLabel={t('auth.register.createAccount')}
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.register.haveAccount')}</Text>
          <Button variant="ghost" onPress={onLoginPress}>
            {t('auth.register.logIn')}
          </Button>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
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
});
