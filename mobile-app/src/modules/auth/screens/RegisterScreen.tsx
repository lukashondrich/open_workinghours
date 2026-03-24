/**
 * RegisterScreen - Step 2 of registration flow
 * Collects profession, seniority, state (required) + optional department/hospital
 * Shows GDPR consent modal before registration
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
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { Button, Picker } from '@/components/ui';
import type { PickerOption } from '@/components/ui';
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
import {
  PROFESSIONS,
  SENIORITY_BY_PROFESSION,
  DEPARTMENT_GROUPS,
  GERMAN_STATES,
  getHospitalsByState,
} from '@/lib/taxonomy';
import type { Profession, Seniority, DepartmentGroup, HospitalEntry } from '@/lib/taxonomy';

interface RegisterScreenProps {
  email: string;
  onLoginPress: () => void;
}

export default function RegisterScreen({ email, onLoginPress }: RegisterScreenProps) {
  const { signIn } = useAuth();

  // Required fields
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [hospitalValue, setHospitalValue] = useState<string | null>(null); // hospital id as string, or 'other'
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

  const handleCreateAccountPress = () => {
    if (!validateForm()) return;
    setShowConsent(true);
  };

  const handleConsentAccepted = async () => {
    try {
      setLoading(true);

      const consentRecord = createConsentRecord();

      // Build legacy field values from taxonomy for backward compat
      const seniorityLabel = seniority || 'not_specified';
      const departmentLabel = departmentGroup || 'not_specified';

      // Resolve hospitalRefId: numeric id if a real hospital was picked, undefined for "other"
      const hospitalRefId = hospitalValue && hospitalValue !== 'other'
        ? parseInt(hospitalValue, 10)
        : undefined;

      const result = await AuthService.register({
        email,
        // Legacy fields (backward compat with old backend)
        hospitalId: 'not_specified',
        specialty: departmentLabel,
        roleLevel: seniorityLabel,
        stateCode: stateCode || undefined,
        // v2 taxonomy fields
        profession: profession || undefined,
        seniority: seniority || undefined,
        departmentGroup: departmentGroup || undefined,
        hospitalRefId,
        // GDPR consent
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      });

      await ConsentStorage.save(consentRecord);
      setShowConsent(false);
      await signIn(result.user, result.token, result.expiresAt);
    } catch (error) {
      console.error('[RegisterScreen] Registration failed:', error);
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

          <Text style={styles.emailLabel}>{t('auth.register.email', { email })}</Text>

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
