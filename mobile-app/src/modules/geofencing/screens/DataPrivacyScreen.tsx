import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import type { WeeklySubmissionRecord } from '@/modules/geofencing/types';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { processSubmissionQueue } from '@/modules/calendar/services/SubmissionQueueWorker';

interface DataSummary {
  locationCount: number;
  sessionCount: number;
}

export default function DataPrivacyScreen() {
  const [dataSummary, setDataSummary] = useState<DataSummary>({
    locationCount: 0,
    sessionCount: 0,
  });
  const [queueEntries, setQueueEntries] = useState<WeeklySubmissionRecord[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  useEffect(() => {
    loadDataSummary();
  }, []);

  const loadDataSummary = async () => {
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();
      const sessions = await db.getAllSessions();
      const submissions = await db.getWeeklySubmissions();

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
      const db = await getDatabase();
      for (const entry of failed) {
        await db.updateWeeklySubmissionStatus(entry.id, 'pending', null);
      }
      await processSubmissionQueue(failed.map((entry) => entry.id));
      Alert.alert('Retry queued', 'Failed submissions were re-sent.');
      loadDataSummary();
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to retry submissions:', error);
      Alert.alert('Retry failed', 'Could not update submissions. Try again later.');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const handleSendPending = async () => {
    if (pendingCount === 0) {
      Alert.alert('No pending submissions', 'Confirm a week and tap “Submit Week” in the Calendar first.');
      return;
    }
    try {
      setIsProcessingQueue(true);
      await processSubmissionQueue();
      Alert.alert('Sent', 'Pending weeks were sent to the backend.');
      loadDataSummary();
    } catch (error) {
      console.error('[DataPrivacyScreen] Failed to send pending submissions:', error);
      Alert.alert('Send failed', error instanceof Error ? error.message : 'Unable to reach submission endpoint.');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const handleUnlockInfo = () => {
    Alert.alert(
      'Unlocking weeks',
      'Unlock a week from the Calendar header after selecting the week you want to edit.',
    );
  };

  const formatWeekLabel = (entry: WeeklySubmissionRecord) => {
    const start = parseISO(entry.weekStart);
    const end = parseISO(entry.weekEnd);
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Stored Data</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Work Locations:</Text>
            <Text style={styles.summaryValue}>{dataSummary.locationCount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Work Sessions:</Text>
            <Text style={styles.summaryValue}>{dataSummary.sessionCount}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Weekly Submissions</Text>
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
            <Text style={styles.queueEmptyText}>No submissions yet. Confirm a full week to get started.</Text>
          ) : (
            <ScrollView style={styles.queueList} nestedScrollEnabled>
              {queueEntries.map((entry) => (
                <View key={entry.id} style={styles.queueRow}>
                  <View>
                    <Text style={styles.queueWeek}>{formatWeekLabel(entry)}</Text>
                    <Text style={styles.queueStatus}>Status: {entry.status}</Text>
                  </View>
                  <Text style={styles.queueHours}>
                    {formatDuration(entry.plannedMinutesTrue)} planned / {formatDuration(entry.actualMinutesTrue)} actual
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.queueActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, isProcessingQueue && styles.secondaryButtonDisabled]}
              onPress={handleSendPending}
              disabled={isProcessingQueue}
            >
              <Text style={styles.secondaryButtonText}>
                {isProcessingQueue ? 'Processing…' : 'Send Pending'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, isProcessingQueue && styles.secondaryButtonDisabled]}
              onPress={handleRetryFailed}
              disabled={isProcessingQueue || failedCount === 0}
            >
              <Text style={styles.secondaryButtonText}>Retry Failed</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.secondaryButton, styles.unlockButton]} onPress={handleUnlockInfo}>
            <Text style={styles.secondaryButtonText}>Unlock Help</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAllData}
        >
          <Text style={styles.deleteButtonText}>Delete All Data</Text>
        </TouchableOpacity>

        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Warning: This action cannot be undone. All locations and work history will be
            permanently deleted.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Your data is stored locally on your device using encrypted SQLite. GPS coordinates and
            work session times never leave your device unless you explicitly export or donate data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  summaryValueWarning: {
    color: '#C62828',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#C62828',
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  queueEmptyText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
  },
  queueWeek: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  queueStatus: {
    fontSize: 13,
    color: '#666',
  },
  queueHours: {
    fontSize: 13,
    color: '#444',
    textAlign: 'right',
  },
  queueActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  queueList: {
    maxHeight: 200,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  unlockButton: {
    marginTop: 8,
  },
});
