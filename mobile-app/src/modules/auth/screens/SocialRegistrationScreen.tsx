/**
 * SocialRegistrationScreen - Registration for first-time social auth users
 *
 * Shown after Apple/Google sign-in returns `registration_required`.
 * Uses the same ProfileForm as email registration to maintain
 * identical onboarding strictness.
 */

import React from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { AuthService } from '../services/AuthService';
import { t } from '@/lib/i18n';
import ProfileForm from '../components/ProfileForm';
import type { ProfileFormData } from '../components/ProfileForm';

interface SocialRegistrationScreenProps {
  socialRegistrationToken: string;
}

export default function SocialRegistrationScreen({
  socialRegistrationToken,
}: SocialRegistrationScreenProps) {
  const { signIn } = useAuth();

  const handleSubmit = async (data: ProfileFormData) => {
    const result = await AuthService.completeSocialRegistration({
      socialRegistrationToken,
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
      submitLabel={t('auth.register.completeSetup') || 'Complete Setup'}
    />
  );
}
