import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
  Switch,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, Download } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { t } from '@/lib/i18n';
import { ListItem } from '@/components/ui';
import { SettingsDetailLayout } from '@/components/ui/SettingsDetailLayout';
import { getCalendarExportManager } from '@/modules/calendar/services/CalendarExportManager';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { buildDesiredManagedCalendarEvents } from '@/modules/calendar/services/CalendarExportNormalize';
import { addLocalDays, formatDateKey, startOfLocalDay } from '@/modules/calendar/services/CalendarExportDateWindow';
import { exportEventsToIcs } from '@/modules/calendar/services/IcsFileGenerator';
import type { CalendarExportEventDTO } from '@/modules/calendar/services/CalendarExportTypes';

const ICON_SIZE = 24;

type ExportPreset = 'next4weeks' | 'next3months' | 'allFuture' | 'pastMonth';

function getPresetRange(preset: ExportPreset, now: Date): { startDate: Date; endDate: Date } {
  const today = startOfLocalDay(now);
  switch (preset) {
    case 'next4weeks':
      return { startDate: today, endDate: addLocalDays(today, 28) };
    case 'next3months':
      return { startDate: today, endDate: addLocalDays(today, 90) };
    case 'allFuture':
      return { startDate: today, endDate: addLocalDays(today, 365 * 2) };
    case 'pastMonth':
      return { startDate: addLocalDays(today, -30), endDate: today };
  }
}

export default function CalendarExportScreen() {
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(true);
  const [calendarSyncWarning, setCalendarSyncWarning] = useState(false);
  const [exportingPreset, setExportingPreset] = useState<ExportPreset | null>(null);
  const isMountedRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      void refreshCalendarSyncState();

      return () => {
        isMountedRef.current = false;
      };
    }, [])
  );

  const refreshCalendarSyncState = async () => {
    try {
      const manager = await getCalendarExportManager();
      const exportState = await manager.getState();
      if (!isMountedRef.current) return;
      setCalendarSyncEnabled(exportState?.enabled === true);
      setCalendarSyncWarning(
        exportState?.enabled === true && exportState.lastSyncError === 'permission-denied'
      );
    } catch (error) {
      console.error('[CalendarExportScreen] Failed to load calendar sync state:', error);
    } finally {
      if (isMountedRef.current) {
        setCalendarSyncLoading(false);
      }
    }
  };

  const selectAndroidTarget = async () => {
    const manager = await getCalendarExportManager();
    const targets = await manager.getAndroidTargets();

    if (targets.length <= 1) {
      const target = targets[0] ?? null;
      return target
        ? {
            targetMode: target.mode,
            targetSourceId: target.source.id ?? null,
          }
        : undefined;
    }

    return new Promise<{ targetMode: 'android-account' | 'android-local'; targetSourceId: string | null } | null>((resolve) => {
      Alert.alert(
        t('settings.calendarSyncAndroidPickerTitle'),
        t('settings.calendarSyncAndroidPickerMessage'),
        [
          ...targets.map((target) => ({
            text: target.label,
            onPress: () => resolve({
              targetMode: target.mode,
              targetSourceId: target.source.id ?? null,
            }),
          })),
          {
            text: t('common.cancel'),
            style: 'cancel' as const,
            onPress: () => resolve(null),
          },
        ],
      );
    });
  };

  const handleDeleteBlocked = (onKeepEvents: () => Promise<void>) => {
    Alert.alert(
      t('settings.calendarSyncDeleteBlockedTitle'),
      t('settings.calendarSyncDeleteBlockedMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.calendarSyncOpenSettings'),
          onPress: () => {
            void Linking.openSettings();
          },
        },
        {
          text: t('settings.keepExportedEvents'),
          onPress: () => {
            void onKeepEvents();
          },
        },
      ],
    );
  };

  const handleCalendarSyncToggle = async (value: boolean) => {
    if (calendarSyncLoading) {
      return;
    }

    if (!value) {
      Alert.alert(
        t('settings.calendarSyncDisableTitle'),
        t('settings.calendarSyncDisableMessage'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('settings.keepExportedEvents'),
            onPress: async () => {
              setCalendarSyncLoading(true);
              try {
                const manager = await getCalendarExportManager();
                await manager.markDisabledKeepingEvents();
                await refreshCalendarSyncState();
              } finally {
                setCalendarSyncLoading(false);
              }
            },
          },
          {
            text: t('settings.deleteExportedEvents'),
            style: 'destructive',
            onPress: async () => {
              setCalendarSyncLoading(true);
              try {
                const manager = await getCalendarExportManager();
                const result = await manager.deleteExportedCalendarData();
                if (result.status === 'blocked-permission') {
                  handleDeleteBlocked(async () => {
                    await manager.markDisabledKeepingEvents();
                    await refreshCalendarSyncState();
                  });
                  return;
                }
                await refreshCalendarSyncState();
              } finally {
                setCalendarSyncLoading(false);
              }
            },
          },
        ],
      );
      return;
    }

    setCalendarSyncLoading(true);
    try {
      const manager = await getCalendarExportManager();
      const targetSelection = Platform.OS === 'android'
        ? await selectAndroidTarget()
        : undefined;

      if (Platform.OS === 'android' && targetSelection === null) {
        return;
      }

      const result = await manager.enableSync(targetSelection ?? undefined);
      if (result.status === 'blocked-permission') {
        Alert.alert(
          t('settings.calendarSyncPermissionTitle'),
          t('settings.calendarSyncPermissionMessage'),
        );
      }
    } catch (error) {
      console.error('[CalendarExportScreen] Failed to enable calendar sync:', error);
      Alert.alert(t('common.error'), t('settings.calendarSyncEnableFailed'));
    } finally {
      await refreshCalendarSyncState();
      if (isMountedRef.current) {
        setCalendarSyncLoading(false);
      }
    }
  };

  const handleExportPreset = async (preset: ExportPreset) => {
    if (exportingPreset) {
      return;
    }

    setExportingPreset(preset);
    try {
      const now = new Date();
      const range = getPresetRange(preset, now);
      const startDateKey = formatDateKey(range.startDate);
      const endDateKey = formatDateKey(range.endDate);
      const queryStartDateKey = formatDateKey(addLocalDays(range.startDate, -1));

      const storage = await getCalendarStorage();
      const [shifts, absences] = await Promise.all([
        storage.getShiftInstancesForDateRange(queryStartDateKey, endDateKey),
        storage.getAbsenceInstancesForDateRange(queryStartDateKey, endDateKey),
      ]);

      const window = {
        todayStart: range.startDate,
        horizonEndExclusive: addLocalDays(range.endDate, 1),
        queryStartDate: queryStartDateKey,
        queryEndDate: endDateKey,
        horizonDays: Math.round((range.endDate.getTime() - range.startDate.getTime()) / 86400000),
      };

      const desiredEvents = buildDesiredManagedCalendarEvents({ shifts, absences, window });

      if (desiredEvents.length === 0) {
        Alert.alert(t('settings.calendarExport'), t('settings.calendarExportEmpty'));
        return;
      }

      const exportDTOs: CalendarExportEventDTO[] = desiredEvents.map((event) => ({
        appId: event.appId,
        entityType: event.entityType,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay,
      }));

      await exportEventsToIcs(exportDTOs, startDateKey, endDateKey);
    } catch (error) {
      console.error('[CalendarExportScreen] ICS export failed:', error);
      Alert.alert(t('common.error'), t('settings.calendarExportFailed'));
    } finally {
      if (isMountedRef.current) {
        setExportingPreset(null);
      }
    }
  };

  const presets: { key: ExportPreset; label: string; testID: string }[] = [
    { key: 'next4weeks', label: t('settings.calendarExportNext4Weeks'), testID: 'ics-export-next4weeks' },
    { key: 'next3months', label: t('settings.calendarExportNext3Months'), testID: 'ics-export-next3months' },
    { key: 'allFuture', label: t('settings.calendarExportAllFuture'), testID: 'ics-export-allfuture' },
    { key: 'pastMonth', label: t('settings.calendarExportPastMonth'), testID: 'ics-export-pastmonth' },
  ];

  return (
    <SettingsDetailLayout title={t('settings.calendarExport')}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section} testID="calendar-sync-section">
          <Text style={styles.sectionTitle}>{t('settings.calendarSyncLiveSync')}</Text>
          <ListItem
            title={t('settings.calendarSyncTitle')}
            subtitle={t('settings.calendarSyncDescription')}
            icon={<Calendar size={ICON_SIZE} color={colors.primary[500]} />}
            testID="calendar-sync-item"
            rightElement={calendarSyncLoading ? (
              <ActivityIndicator color={colors.primary[500]} size="small" testID="calendar-sync-loading" />
            ) : (
              <Switch
                testID="calendar-sync-toggle"
                value={calendarSyncEnabled}
                onValueChange={handleCalendarSyncToggle}
                trackColor={{ false: colors.grey[300], true: colors.primary[300] }}
                thumbColor={calendarSyncEnabled ? colors.primary[500] : colors.grey[100]}
              />
            )}
            showChevron={false}
          />
          {calendarSyncWarning && (
            <Text style={styles.warningText} testID="calendar-sync-warning">
              {t('settings.calendarSyncPermissionWarning')}
            </Text>
          )}
        </View>

        <View style={styles.section} testID="ics-export-section">
          <Text style={styles.sectionTitle}>{t('settings.calendarExportDownload')}</Text>
          <Text style={styles.descriptionText}>
            {t('settings.calendarExportDownloadDescription')}
          </Text>
          <View style={styles.presetButtons}>
            {presets.map((preset) => (
              <TouchableOpacity
                key={preset.key}
                testID={preset.testID}
                accessible={true}
                accessibilityRole="button"
                style={[
                  styles.presetButton,
                  exportingPreset === preset.key && styles.presetButtonDisabled,
                ]}
                disabled={exportingPreset !== null}
                onPress={() => void handleExportPreset(preset.key)}
              >
                {exportingPreset === preset.key ? (
                  <ActivityIndicator color={colors.primary[500]} size="small" />
                ) : (
                  <Download size={18} color={colors.primary[500]} />
                )}
                <Text style={styles.presetButtonText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SettingsDetailLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  warningText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.error.main,
  },
  descriptionText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  presetButtons: {
    gap: spacing.sm,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
  },
  presetButtonDisabled: {
    opacity: 0.6,
  },
  presetButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
});
