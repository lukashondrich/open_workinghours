import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';

interface DataSummary {
  locationCount: number;
  sessionCount: number;
}

export default function DataPrivacyScreen() {
  const [dataSummary, setDataSummary] = useState<DataSummary>({
    locationCount: 0,
    sessionCount: 0,
  });

  useEffect(() => {
    loadDataSummary();
  }, []);

  const loadDataSummary = async () => {
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();
      const sessions = await db.getAllSessions();

      setDataSummary({
        locationCount: locations.length,
        sessionCount: sessions.length,
      });
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
});
