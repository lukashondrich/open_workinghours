import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { Button, Card, InfoBox } from '@/components/ui';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import type { DailySubmissionRecord } from '@/modules/geofencing/types';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { DailySubmissionService } from '@/modules/auth/services/DailySubmissionService';
import { AuthService } from '@/modules/auth/services/AuthService';
import { useAuth } from '@/lib/auth/auth-context';
import { ConsentStorage } from '@/lib/auth/ConsentStorage';
import { t, getDateLocale } from '@/lib/i18n';

interface DataSummary {
  locationCount: number;
  sessionCount: number;
}

export default function DataPrivacyScreen() {
  const { state: authState, signOut } = useAuth();
  const [dataSummary, setDataSummary] = useState<DataSummary>({
    locationCount: 0,
    sessionCount: 0,
  });
  const [queueEntries, setQueueEntries] = useState<DailySubmissionRecord[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadDataSummary();
  }, []);

  const loadDataSummary = async () => {
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();
      const sessions = await db.getAllSessions();
      const submissions = await db.getDailySubmissionQueue();

      setDataSummary({
        locationCount: locations.length,
        sessionCount: sessions.length,
      });
      setQueueEntries(submissions);
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to load data summary:', error);
    }
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      t('dataPrivacyScreen.deleteConfirmTitle'),
      t('dataPrivacyScreen.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dataPrivacyScreen.deleteEverything'),
          style: 'destructive',
          onPress: confirmDeleteAllData,
        },
      ]
    );
  };

  const confirmDeleteAllData = async () => {
    try {
      const db = await getDatabase();
      const geofenceService = getGeofenceService();

      // Unregister all geofences
      const locations = await db.getActiveLocations();
      for (const location of locations) {
        try {
          await geofenceService.unregisterGeofence(location.id);
        } catch (error) {
          console.warn('[DataPrivacyScreen] Failed to unregister geofence:', error);
        }
      }

      // Delete all database data
      await db.deleteAllData();

      Alert.alert(
        t('dataPrivacyScreen.dataDeletedTitle'),
        t('dataPrivacyScreen.dataDeletedMessage'),
        [{ text: t('common.ok') }]
      );

      loadDataSummary();
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to delete data:', error);
      Alert.alert(t('common.error'), t('dataPrivacyScreen.deleteFailed'));
    }
  };

  const queueCounts = useMemo(() => {
    return queueEntries.reduce(
      (acc, entry) => {
        acc[entry.status] = (acc[entry.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [queueEntries]);
  const pendingCount = queueCounts['pending'] ?? 0;
  const failedCount = queueCounts['failed'] ?? 0;

  const handleRetryFailed = async () => {
    const failed = queueEntries.filter((entry) => entry.status === 'failed');
    if (failed.length === 0) {
      Alert.alert(t('dataPrivacyScreen.noFailedTitle'), t('dataPrivacyScreen.noFailedMessage'));
      return;
    }
    try {
      setIsProcessingQueue(true);
      // Retry each failed submission
      for (const entry of failed) {
        await DailySubmissionService.retrySubmission(entry.id);
      }
      Alert.alert(t('dataPrivacyScreen.retryQueued'), t('dataPrivacyScreen.retryQueuedMessage'));
      loadDataSummary();
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to retry submissions:', error);
      Alert.alert(t('dataPrivacyScreen.retryFailedTitle'), t('dataPrivacyScreen.retryFailedMessage'));
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const formatDateLabel = (entry: DailySubmissionRecord) => {
    const date = parseISO(entry.date);
    const locale = getDateLocale() === 'de' ? deLocale : undefined;
    return format(date, 'MMM d, yyyy', { locale });
  };

  const formatConsentDate = (isoDate: string | undefined) => {
    if (!isoDate) return '—';
    try {
      const date = parseISO(isoDate);
      const locale = getDateLocale() === 'de' ? deLocale : undefined;
      return format(date, 'PPP', { locale });
    } catch {
      return '—';
    }
  };

  const handleExportData = async () => {
    if (!authState.token) {
      Alert.alert(t('common.error'), t('dataPrivacyScreen.sessionExpired'));
      return;
    }

    setIsExporting(true);
    try {
      const data = await AuthService.exportUserData(authState.token);
      const jsonString = JSON.stringify(data, null, 2);

      await Share.share({
        message: jsonString,
        title: t('dataPrivacyScreen.exportTitle'),
      });
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to export data:', error);
      const message = error instanceof Error ? error.message : t('dataPrivacyScreen.exportFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWithdrawConsent = () => {
    // Check for pending submissions first
    if (pendingCount > 0) {
      Alert.alert(
        t('dataPrivacyScreen.pendingDataTitle'),
        t('dataPrivacyScreen.pendingDataWarning', { count: pendingCount }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('dataPrivacyScreen.continueAnyway'),
            style: 'destructive',
            onPress: showWithdrawConfirmation,
          },
        ]
      );
    } else {
      showWithdrawConfirmation();
    }
  };

  const showWithdrawConfirmation = () => {
    Alert.alert(
      t('dataPrivacyScreen.withdrawConfirmTitle'),
      t('dataPrivacyScreen.withdrawConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dataPrivacyScreen.withdrawConfirmButton'),
          style: 'destructive',
          onPress: confirmWithdrawConsent,
        },
      ]
    );
  };

  const confirmWithdrawConsent = async () => {
    if (!authState.token) {
      Alert.alert(t('common.error'), t('dataPrivacyScreen.sessionExpired'));
      return;
    }

    setIsDeleting(true);
    try {
      // Step 1: Delete backend account
      await AuthService.deleteAccount(authState.token);

      // Step 2: Clean up local data (best effort - backend is already deleted)
      try {
        const db = await getDatabase();
        const geofenceService = getGeofenceService();

        // Unregister all geofences
        const locations = await db.getActiveLocations();
        for (const location of locations) {
          try {
            await geofenceService.unregisterGeofence(location.id);
          } catch (error) {
            console.warn('[DataPrivacyScreen] Failed to unregister geofence:', error);
          }
        }

        // Delete all database data
        await db.deleteAllData();

        // Clear consent storage
        await ConsentStorage.clear();
      } catch (localError) {
        // Log but don't fail - backend is already deleted
        console.error('[DataPrivacyScreen] Local cleanup failed:', localError);
      }

      // Step 3: Sign out
      await signOut();

      // Step 4: Show success message
      Alert.alert(
        t('dataPrivacyScreen.accountDeleted'),
        t('dataPrivacyScreen.accountDeletedMessage'),
        [{ text: t('common.ok') }]
      );
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to delete account:', error);
      const message = error instanceof Error ? error.message : t('dataPrivacyScreen.deletionFailed');

      if (message.includes('401') || message.includes('expired')) {
        Alert.alert(t('common.error'), t('dataPrivacyScreen.sessionExpired'));
      } else if (message.includes('403')) {
        Alert.alert(t('common.error'), t('dataPrivacyScreen.cannotDelete'));
      } else {
        Alert.alert(t('common.error'), message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Consent Status Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dataPrivacyScreen.consentStatus')}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.termsAccepted')}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueSuccess]}>
              {authState.user?.termsAcceptedVersion
                ? t('dataPrivacyScreen.accepted')
                : t('dataPrivacyScreen.notAccepted')}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.privacyAccepted')}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueSuccess]}>
              {authState.user?.privacyAcceptedVersion
                ? t('dataPrivacyScreen.accepted')
                : t('dataPrivacyScreen.notAccepted')}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.acceptedOnLabel')}</Text>
            <Text style={styles.summaryValue}>
              {formatConsentDate(authState.user?.consentAcceptedAt)}
            </Text>
          </View>
        </Card>

        {/* Export Data Button */}
        <Button
          variant="outline"
          onPress={handleExportData}
          loading={isExporting}
          disabled={isExporting}
          fullWidth
          style={styles.exportButton}
        >
          {isExporting
            ? t('dataPrivacyScreen.exporting')
            : t('dataPrivacyScreen.exportData')}
        </Button>

        {/* Local Data Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dataPrivacyScreen.storedData')}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.workLocations')}</Text>
            <Text style={styles.summaryValue}>{dataSummary.locationCount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.workSessions')}</Text>
            <Text style={styles.summaryValue}>{dataSummary.sessionCount}</Text>
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dataPrivacyScreen.dailySubmissions')}</Text>
          <Text style={styles.submissionExplainer}>
            {t('dataPrivacyScreen.submissionExplainer')}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.pending')}</Text>
            <Text style={styles.summaryValue}>{queueCounts['pending'] ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.failed')}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueWarning]}>{queueCounts['failed'] ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.sent')}</Text>
            <Text style={styles.summaryValue}>{queueCounts['sent'] ?? 0}</Text>
          </View>
          {queueEntries.length === 0 ? (
            <Text style={styles.queueEmptyText}>{t('dataPrivacyScreen.queueEmpty')}</Text>
          ) : (
            <ScrollView style={styles.queueList} nestedScrollEnabled>
              {queueEntries.map((entry) => (
                <View key={entry.id} style={styles.queueRow}>
                  <View>
                    <Text style={styles.queueWeek}>{formatDateLabel(entry)}</Text>
                    <Text style={styles.queueStatus}>{t('dataPrivacyScreen.status', { status: entry.status })}</Text>
                  </View>
                  <View style={styles.queueHoursContainer}>
                    <Text style={styles.queueHours}>
                      {t('dataPrivacyScreen.plannedHours', { hours: entry.plannedHours.toFixed(1) })}
                    </Text>
                    <Text style={styles.queueHours}>
                      {t('dataPrivacyScreen.actualHours', { hours: entry.actualHours.toFixed(1) })}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          {failedCount > 0 && (
            <View style={styles.queueActions}>
              <Button
                variant="outline"
                onPress={handleRetryFailed}
                loading={isProcessingQueue}
                disabled={isProcessingQueue}
                fullWidth
              >
                {isProcessingQueue ? t('dataPrivacyScreen.retrying') : t('dataPrivacyScreen.retryFailed')}
              </Button>
            </View>
          )}
        </Card>

        <Button
          variant="outline"
          onPress={handleDeleteAllData}
          fullWidth
          style={styles.deleteButton}
        >
          {t('dataPrivacyScreen.deleteAllData')}
        </Button>

        <InfoBox variant="warning" style={styles.warningBox}>
          {t('dataPrivacyScreen.warningBox')}
        </InfoBox>

        <InfoBox variant="info" style={styles.infoBox}>
          {t('dataPrivacyScreen.privacyInfo')}
        </InfoBox>

        {/* Withdraw Consent & Delete Account */}
        <Button
          variant="danger"
          onPress={handleWithdrawConsent}
          loading={isDeleting}
          disabled={isDeleting}
          fullWidth
          style={styles.withdrawButton}
        >
          {isDeleting
            ? t('dataPrivacyScreen.deleting')
            : t('dataPrivacyScreen.withdrawConsent')}
        </Button>

        <InfoBox variant="warning" style={styles.withdrawWarning}>
          {t('dataPrivacyScreen.withdrawWarning')}
        </InfoBox>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  summaryCard: {
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  summaryValueWarning: {
    color: colors.error.main,
  },
  summaryValueSuccess: {
    color: colors.success.main,
  },
  exportButton: {
    marginBottom: spacing.xl,
  },
  deleteButton: {
    marginBottom: spacing.xl,
  },
  withdrawButton: {
    marginBottom: spacing.md,
  },
  withdrawWarning: {
    marginBottom: spacing.xl,
  },
  warningBox: {
    marginBottom: spacing.xl,
  },
  infoBox: {
    marginBottom: spacing.xl,
  },
  queueEmptyText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[200],
  },
  queueWeek: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  queueStatus: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  queueHoursContainer: {
    alignItems: 'flex-end',
  },
  queueHours: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  submissionExplainer: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  queueActions: {
    marginTop: spacing.md,
  },
  queueList: {
    maxHeight: 200,
    marginTop: spacing.sm,
  },
});
