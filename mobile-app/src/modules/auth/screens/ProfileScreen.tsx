/**
 * ProfileScreen — View and edit profile fields (GDPR Art. 16).
 * Accessible from Settings. Edits apply to future weeks only.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Text,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { Button, Picker, SettingsDetailLayout } from '@/components/ui';
import type { PickerOption } from '@/components/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { AuthService } from '../services/AuthService';
import { t } from '@/lib/i18n';
import {
  PROFESSIONS,
  SENIORITY_BY_PROFESSION,
  DEPARTMENT_GROUPS,
  GERMAN_STATES,
  getHospitalsByState,
} from '@/lib/taxonomy';
import type { Profession } from '@/lib/taxonomy';

export default function ProfileScreen() {
  const { state, signIn } = useAuth();
  const user = state.user;

  const [stateCode, setStateCode] = useState<string | null>(user?.stateCode || null);
  const [hospitalValue, setHospitalValue] = useState<string | null>(
    user?.hospitalRefId ? String(user.hospitalRefId) : null,
  );
  const [profession, setProfession] = useState<string | null>(user?.profession || null);
  const [seniority, setSeniority] = useState<string | null>(user?.seniority || null);
  const [departmentGroup, setDepartmentGroup] = useState<string | null>(user?.departmentGroup || null);
  const [saving, setSaving] = useState(false);

  const handleStateChange = useCallback((value: string) => {
    setStateCode(value);
    setHospitalValue(null);
  }, []);

  const handleProfessionChange = useCallback((value: string) => {
    setProfession(value);
    setSeniority(null);
  }, []);

  const seniorityOptions: PickerOption[] = useMemo(() => {
    if (!profession) return [];
    const prof = profession as Profession;
    const options = SENIORITY_BY_PROFESSION[prof];
    if (!options) return [];
    const lang = t('_locale') === 'de' ? 'labelDe' : 'labelEn';
    return options.map((s) => ({
      value: s.value,
      label: s[lang],
    }));
  }, [profession]);

  const stateOptions: PickerOption[] = useMemo(() => {
    return GERMAN_STATES.map((s) => ({
      value: s.code,
      label: `${s.name} (${s.code})`,
    }));
  }, []);

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

  const departmentOptions: PickerOption[] = useMemo(() => {
    const lang = t('_locale') === 'de' ? 'labelDe' : 'labelEn';
    return DEPARTMENT_GROUPS.map((d) => ({
      value: d.value,
      label: d[lang],
    }));
  }, []);

  const professionOptions: PickerOption[] = useMemo(() => {
    const lang = t('_locale') === 'de' ? 'labelDe' : 'labelEn';
    return PROFESSIONS.map((p) => ({
      value: p.value,
      label: p[lang],
    }));
  }, []);

  const hasChanges = useMemo(() => {
    if (!user) return false;
    const currentHospitalValue = user.hospitalRefId ? String(user.hospitalRefId) : null;
    return (
      stateCode !== (user.stateCode || null) ||
      hospitalValue !== currentHospitalValue ||
      profession !== (user.profession || null) ||
      seniority !== (user.seniority || null) ||
      departmentGroup !== (user.departmentGroup || null)
    );
  }, [user, stateCode, hospitalValue, profession, seniority, departmentGroup]);

  const handleSave = async () => {
    if (!state.token || !user) return;

    try {
      setSaving(true);
      const hospitalRefId = hospitalValue && hospitalValue !== 'other'
        ? parseInt(hospitalValue, 10)
        : undefined;

      const updatedUser = await AuthService.updateProfile(
        state.token,
        user.email,
        {
          stateCode: stateCode || undefined,
          hospitalRefId,
          profession: profession || undefined,
          seniority: seniority || undefined,
          departmentGroup: departmentGroup || undefined,
        },
      );
      await signIn(updatedUser, state.token, state.expiresAt!);
      Alert.alert(t('auth.profile.saved'), t('auth.profile.savedMessage'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(t('auth.profile.saveFailed'), msg);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <SettingsDetailLayout title={t('navigation.profile')}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>{t('auth.profile.profileSection')}</Text>

        <Picker
          label={t('auth.register.stateLabel')}
          value={stateCode}
          options={stateOptions}
          onSelect={handleStateChange}
          placeholder={t('auth.register.statePlaceholder')}
          testID="profile-state-picker"
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
            testID="profile-hospital-picker"
          />
        )}

        <Picker
          label={t('auth.register.professionLabel')}
          value={profession}
          options={professionOptions}
          onSelect={handleProfessionChange}
          placeholder={t('auth.register.professionPlaceholder')}
          testID="profile-profession-picker"
        />

        {profession && (
          <Picker
            label={t('auth.register.seniorityLabel')}
            value={seniority}
            options={seniorityOptions}
            onSelect={setSeniority}
            placeholder={t('auth.register.seniorityPlaceholder')}
            testID="profile-seniority-picker"
          />
        )}

        <Picker
          label={t('auth.register.departmentLabel')}
          value={departmentGroup}
          options={departmentOptions}
          onSelect={setDepartmentGroup}
          placeholder={t('auth.register.departmentPlaceholder')}
          testID="profile-department-picker"
        />

        <Button
          onPress={handleSave}
          loading={saving}
          disabled={saving || !hasChanges}
          fullWidth
          testID="profile-save-button"
          style={styles.saveButton}
        >
          {t('auth.profile.save')}
        </Button>

        <Text style={styles.hint}>{t('auth.profile.futureWeeksHint')}</Text>
      </ScrollView>
    </SettingsDetailLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xxl,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
