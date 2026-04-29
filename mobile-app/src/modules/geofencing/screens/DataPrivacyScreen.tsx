import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  TouchableOpacity,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { Button, Card, InfoBox, SettingsDetailLayout } from '@/components/ui';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import type { ReportsWeekQueueRecord } from '@/modules/geofencing/types';
import { AuthService } from '@/modules/auth/services/AuthService';
import { useAuth } from '@/lib/auth/auth-context';
import { AuthStorage } from '@/lib/auth/AuthStorage';
import { BiometricService } from '@/lib/auth/BiometricService';
import { ConsentStorage } from '@/lib/auth/ConsentStorage';
import { t, getDateLocale } from '@/lib/i18n';
import { openTermsUrl, openPrivacyUrl } from '@/lib/utils/legalUrls';

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
  const [weekQueue, setWeekQueue] = useState<ReportsWeekQueueRecord[]>([]);
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
      const queue = await db.getReportsWeekQueue();

      setDataSummary({
        locationCount: locations.length,
        sessionCount: sessions.length,
      });
      setWeekQueue(queue);
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

  const queuedCount = weekQueue.filter((w) => w.status === 'queued').length;
  const sentCount = weekQueue.filter((w) => w.status === 'sent').length;

  const formatConsentDate = (isoDate: string | undefined) => {
    if (!isoDate) return '\u2014';
    try {
      const date = parseISO(isoDate);
      const locale = getDateLocale() === 'de' ? deLocale : undefined;
      return format(date, 'PPP', { locale });
    } catch {
      return '\u2014';
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
    if (queuedCount > 0) {
      Alert.alert(
        t('dataPrivacyScreen.pendingDataTitle'),
        t('dataPrivacyScreen.pendingDataWarning', { count: queuedCount }),
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

        // Clear auth storage and biometric settings (full cleanup for account deletion)
        await AuthStorage.clearAuth();
        await BiometricService.clear();
      } catch (localError) {
        // Log but don't fail - backend is already deleted
        console.error('[DataPrivacyScreen] Local cleanup failed:', localError);
      }

      // Step 3: Sign out (just updates UI state, storage already cleared above)
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
    <SettingsDetailLayout title={t('navigation.dataPrivacy')}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Consent Status Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dataPrivacyScreen.consentStatus')}</Text>

          <TouchableOpacity style={styles.summaryRowTappable} onPress={openTermsUrl}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.termsAccepted')}</Text>
            <View style={styles.summaryValueRow}>
              <Text style={[
                styles.summaryValue,
                authState.user?.termsAcceptedVersion
                  ? styles.summaryValueSuccess
                  : styles.summaryValueNotAccepted
              ]}>
                {authState.user?.termsAcceptedVersion
                  ? t('dataPrivacyScreen.accepted')
                  : t('dataPrivacyScreen.notAccepted')}
              </Text>
              <ChevronRight size={16} color={colors.grey[400]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.summaryRowTappable} onPress={openPrivacyUrl}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.privacyAccepted')}</Text>
            <View style={styles.summaryValueRow}>
              <Text style={[
                styles.summaryValue,
                authState.user?.privacyAcceptedVersion
                  ? styles.summaryValueSuccess
                  : styles.summaryValueNotAccepted
              ]}>
                {authState.user?.privacyAcceptedVersion
                  ? t('dataPrivacyScreen.accepted')
                  : t('dataPrivacyScreen.notAccepted')}
              </Text>
              <ChevronRight size={16} color={colors.grey[400]} />
            </View>
          </TouchableOpacity>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.acceptedOnLabel')}</Text>
            <Text style={styles.summaryValue}>
              {formatConsentDate(authState.user?.consentAcceptedAt)}
            </Text>
          </View>
        </Card>

        {/* Export Data Button */}
        <Button
          variant="secondary"
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

        {/* Weekly Submissions Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dataPrivacyScreen.weeklySubmissions')}</Text>
          <Text style={styles.submissionExplainer}>
            {t('dataPrivacyScreen.weeklySubmissionExplainer')}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.queued')}</Text>
            <Text style={styles.summaryValue}>{queuedCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dataPrivacyScreen.sent')}</Text>
            <Text style={styles.summaryValue}>{sentCount}</Text>
          </View>
        </Card>

        <Button
          variant="secondary"
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
    </SettingsDetailLayout>
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
  summaryRowTappable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: -spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  summaryValueSuccess: {
    color: colors.success.main,
  },
  summaryValueNotAccepted: {
    color: colors.warning.main,
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
  submissionExplainer: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
});
