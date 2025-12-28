import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { format, parseISO } from 'date-fns';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { Button, Card, InfoBox } from '@/components/ui';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import type { DailySubmissionRecord } from '@/modules/geofencing/types';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { DailySubmissionService } from '@/modules/auth/services/DailySubmissionService';

interface DataSummary {
  locationCount: number;
  sessionCount: number;
}

export default function DataPrivacyScreen() {
  const [dataSummary, setDataSummary] = useState<DataSummary>({
    locationCount: 0,
    sessionCount: 0,
  });
  const [queueEntries, setQueueEntries] = useState<DailySubmissionRecord[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

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
      'Delete All Data',
      'Are you sure you want to delete ALL data?\n\nThis will permanently remove:\n• All work locations\n• All work sessions\n• All tracking history\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
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
        'Data Deleted',
        'All data has been permanently deleted.',
        [{ text: 'OK' }]
      );

      loadDataSummary();
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to delete data:', error);
      Alert.alert('Error', 'Failed to delete data. Please try again.');
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
      Alert.alert('No failed submissions', 'Everything looks good!');
      return;
    }
    try {
      setIsProcessingQueue(true);
      // Retry each failed submission
      for (const entry of failed) {
        await DailySubmissionService.retrySubmission(entry.id);
      }
      Alert.alert('Retry queued', 'Failed submissions were re-sent.');
      loadDataSummary();
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to retry submissions:', error);
      Alert.alert('Retry failed', 'Could not update submissions. Try again later.');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const formatDateLabel = (entry: DailySubmissionRecord) => {
    const date = parseISO(entry.date);
    return format(date, 'MMM d, yyyy');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Stored Data</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Work Locations:</Text>
            <Text style={styles.summaryValue}>{dataSummary.locationCount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Work Sessions:</Text>
            <Text style={styles.summaryValue}>{dataSummary.sessionCount}</Text>
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Daily Submissions</Text>
          <Text style={styles.submissionExplainer}>
            When you confirm a day in the calendar, it's automatically submitted to the backend (authenticated).
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pending:</Text>
            <Text style={styles.summaryValue}>{queueCounts['pending'] ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Failed:</Text>
            <Text style={[styles.summaryValue, styles.summaryValueWarning]}>{queueCounts['failed'] ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sent:</Text>
            <Text style={styles.summaryValue}>{queueCounts['sent'] ?? 0}</Text>
          </View>
          {queueEntries.length === 0 ? (
            <Text style={styles.queueEmptyText}>No submissions yet. Confirm days in the Calendar to get started.</Text>
          ) : (
            <ScrollView style={styles.queueList} nestedScrollEnabled>
              {queueEntries.map((entry) => (
                <View key={entry.id} style={styles.queueRow}>
                  <View>
                    <Text style={styles.queueWeek}>{formatDateLabel(entry)}</Text>
                    <Text style={styles.queueStatus}>Status: {entry.status}</Text>
                  </View>
                  <View style={styles.queueHoursContainer}>
                    <Text style={styles.queueHours}>
                      Planned: {entry.plannedHours.toFixed(1)}h
                    </Text>
                    <Text style={styles.queueHours}>
                      Actual: {entry.actualHours.toFixed(1)}h
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
                {isProcessingQueue ? 'Retrying...' : 'Retry Failed'}
              </Button>
            </View>
          )}
        </Card>

        <Button
          variant="danger"
          onPress={handleDeleteAllData}
          fullWidth
          style={styles.deleteButton}
        >
          Delete All Data
        </Button>

        <InfoBox variant="warning" style={styles.warningBox}>
          Warning: This action cannot be undone. All locations and work history will be
          permanently deleted.
        </InfoBox>

        <InfoBox variant="info" style={styles.infoBox}>
          Your GPS location never leaves your phone. All work sessions are stored locally with encryption.
          {'\n\n'}
          When you confirm a day, only your hours (planned and actual) are shared. Your data is combined with at least 10 other users and mathematically protected before any statistics are published.
          {'\n\n'}
          This keeps your personal data private while enabling collective insights.
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
  deleteButton: {
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
