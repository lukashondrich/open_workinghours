/**
 * ProfileForm - Shared registration form for email and social auth flows.
 *
 * Contains: state/hospital/profession/seniority/department pickers,
 * form validation, GDPR consent modal, and submit button.
 *
 * Used by both RegisterScreen (email) and SocialRegistrationScreen (social auth).
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import { Button, Picker } from '@/components/ui';
import type { PickerOption } from '@/components/ui';
import { t } from '@/lib/i18n';
import { ConsentBottomSheet } from './ConsentBottomSheet';
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  createConsentRecord,
} from '@/lib/auth/consent-types';
import { ConsentStorage } from '@/lib/auth/ConsentStorage';
import {
  PROFESSIONS,
  SENIORITY_BY_PROFESSION,
  DEPARTMENT_GROUPS,
  GERMAN_STATES,
  getHospitalsByState,
} from '@/lib/taxonomy';
import type { Profession, Seniority, DepartmentGroup } from '@/lib/taxonomy';

export interface ProfileFormData {
  stateCode: string;
  hospitalValue: string;
  hospitalRefId: number | undefined;
  profession: Profession;
  seniority: Seniority;
  departmentGroup: DepartmentGroup | undefined;
  termsVersion: string;
  privacyVersion: string;
  // Legacy field mappings
  hospitalId: string;
  specialty: string;
  roleLevel: string;
}

interface ProfileFormProps {
  /** Called when form is submitted and consent is accepted */
  onSubmit: (data: ProfileFormData) => Promise<void>;
  /** Email to display (email registration only) */
  email?: string;
  /** Label for the submit button */
  submitLabel: string;
  /** Footer content rendered below the form */
  footer?: React.ReactNode;
}

export default function ProfileForm({ onSubmit, email, submitLabel, footer }: ProfileFormProps) {
  // Required fields
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [hospitalValue, setHospitalValue] = useState<string | null>(null);
  const [profession, setProfession] = useState<Profession | null>(null);
  const [seniority, setSeniority] = useState<Seniority | null>(null);

  // Optional fields
  const [departmentGroup, setDepartmentGroup] = useState<DepartmentGroup | null>(null);

  const [loading, setLoading] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  // When state changes, reset hospital selection
  const handleStateChange = useCallback((value: string) => {
    setStateCode(value);
    setHospitalValue(null);
  }, []);

  // When profession changes, reset seniority
  const handleProfessionChange = useCallback((value: string) => {
    setProfession(value as Profession);
    setSeniority(null);
  }, []);

  // Build seniority options based on selected profession
  const seniorityOptions: PickerOption[] = useMemo(() => {
    if (!profession) return [];
    const lang = t('_locale') === 'de' ? 'labelDe' : 'labelEn';
    return SENIORITY_BY_PROFESSION[profession].map((s) => ({
      value: s.value,
      label: s[lang],
    }));
  }, [profession]);

  // Build state options
  const stateOptions: PickerOption[] = useMemo(() => {
    return GERMAN_STATES.map((s) => ({
      value: s.code,
      label: `${s.name} (${s.code})`,
    }));
  }, []);

  // Build hospital options (filtered by selected state)
  const hospitalOptions: PickerOption[] = useMemo(() => {
    if (!stateCode) return [];
    const hospitals = getHospitalsByState(stateCode);
    const options: PickerOption[] = hospitals.map((h) => ({
      value: String(h.id),
      label: h.name,
      subtitle: h.city,
    }));
    options.push({
      value: 'other',
      label: t('auth.register.hospitalOther'),
      pinned: true,
    });
    return options;
  }, [stateCode]);

  // Build department group options
  const departmentOptions: PickerOption[] = useMemo(() => {
    const lang = t('_locale') === 'de' ? 'labelDe' : 'labelEn';
    return DEPARTMENT_GROUPS.map((d) => ({
      value: d.value,
      label: d[lang],
    }));
  }, []);

  // Build profession options
  const professionOptions: PickerOption[] = useMemo(() => {
    const lang = t('_locale') === 'de' ? 'labelDe' : 'labelEn';
    return PROFESSIONS.map((p) => ({
      value: p.value,
      label: p[lang],
    }));
  }, []);

  const validateForm = (): boolean => {
    if (!stateCode) {
      Alert.alert(t('auth.register.stateRequired'), t('auth.register.stateRequiredMessage'));
      return false;
    }
    if (!hospitalValue) {
      Alert.alert(t('auth.register.hospitalRequired'), t('auth.register.hospitalRequiredMessage'));
      return false;
    }
    if (!profession) {
      Alert.alert(t('auth.register.professionRequired'), t('auth.register.professionRequiredMessage'));
      return false;
    }
    if (!seniority) {
      Alert.alert(t('auth.register.seniorityRequired'), t('auth.register.seniorityRequiredMessage'));
      return false;
    }
    return true;
  };

  const handleSubmitPress = () => {
    if (!validateForm()) return;
    setShowConsent(true);
  };

  const handleConsentAccepted = async () => {
    try {
      setLoading(true);

      const consentRecord = createConsentRecord();
      const hospitalRefId = hospitalValue && hospitalValue !== 'other'
        ? parseInt(hospitalValue, 10)
        : undefined;

      await onSubmit({
        stateCode: stateCode!,
        hospitalValue: hospitalValue!,
        hospitalRefId,
        profession: profession!,
        seniority: seniority!,
        departmentGroup: departmentGroup || undefined,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        // Legacy field mappings
        hospitalId: 'not_specified',
        specialty: departmentGroup || 'not_specified',
        roleLevel: seniority || 'not_specified',
      });

      await ConsentStorage.save(consentRecord);
      setShowConsent(false);
    } catch (error) {
      console.error('[ProfileForm] Submission failed:', error);
      setShowConsent(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(t('auth.register.registrationFailed'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>

          {email && (
            <Text style={styles.emailLabel}>{t('auth.register.email', { email })}</Text>
          )}

          <Picker
            label={t('auth.register.stateLabel')}
            value={stateCode}
            options={stateOptions}
            onSelect={handleStateChange}
            placeholder={t('auth.register.statePlaceholder')}
            testID="state-picker"
          />

          {stateCode && (
            <Picker
              label={t('auth.register.hospitalLabel')}
              value={hospitalValue}
              options={hospitalOptions}
              onSelect={setHospitalValue}
              placeholder={t('auth.register.hospitalPlaceholder')}
              searchable
              searchPlaceholder={t('auth.register.hospitalPlaceholder')}
              searchMinChars={2}
              searchHint={t('auth.register.hospitalSearchHint')}
              testID="hospital-picker"
            />
          )}

          <Picker
            label={t('auth.register.professionLabel')}
            value={profession}
            options={professionOptions}
            onSelect={handleProfessionChange}
            placeholder={t('auth.register.professionPlaceholder')}
            testID="profession-picker"
          />

          {profession && (
            <Picker
              label={t('auth.register.seniorityLabel')}
              value={seniority}
              options={seniorityOptions}
              onSelect={(v) => setSeniority(v as Seniority)}
              placeholder={t('auth.register.seniorityPlaceholder')}
              testID="seniority-picker"
            />
          )}

          <Picker
            label={t('auth.register.departmentLabel')}
            value={departmentGroup}
            options={departmentOptions}
            onSelect={(v) => setDepartmentGroup(v as DepartmentGroup)}
            placeholder={t('auth.register.departmentPlaceholder')}
            testID="department-picker"
          />

          <Button
            onPress={handleSubmitPress}
            loading={loading}
            disabled={loading}
            fullWidth
            testID="register-button"
            style={styles.registerButton}
          >
            {submitLabel}
          </Button>

          <Text style={styles.preAnnounce}>{t('consent.preAnnounce')}</Text>

          {footer}
        </View>
      </ScrollView>

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
  preAnnounce: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
