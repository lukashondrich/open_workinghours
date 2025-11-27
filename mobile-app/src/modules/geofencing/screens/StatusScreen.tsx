import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import PermissionWarningBanner from '@/modules/geofencing/components/PermissionWarningBanner';
import type { UserLocation } from '@/modules/geofencing/types';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type StatusScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LocationStatus {
  location: UserLocation;
  isCheckedIn: boolean;
  clockInTime?: string;
  elapsedMinutes?: number;
}

export default function StatusScreen() {
  const navigation = useNavigation<StatusScreenNavigationProp>();

  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(true);

  // Refresh status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadLocationStatuses();
      checkBackgroundPermission();
    }, [])
  );

  const checkBackgroundPermission = async () => {
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      setHasBackgroundPermission(status === 'granted');
    } catch (error) {
      console.error('[StatusScreen] Failed to check background permission:', error);
    }
  };

  // Update elapsed time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      updateElapsedTimes();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [locationStatuses]);

  const loadLocationStatuses = async () => {
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();

      const statuses: LocationStatus[] = [];

      for (const location of locations) {
        // Get active session for this location
        const activeSession = await db.getActiveSession(location.id);

        console.log('[StatusScreen] Location:', location.name, 'Active session:', activeSession);

        if (activeSession && !activeSession.clockOut) {
          // Checked in (clockOut is null or undefined)
          const checkInDate = new Date(activeSession.clockIn);
          const now = new Date();
          const elapsedMs = now.getTime() - checkInDate.getTime();
          const elapsedMinutes = Math.floor(elapsedMs / 60000);

          statuses.push({
            location,
            isCheckedIn: true,
            clockInTime: activeSession.clockIn,
            elapsedMinutes,
          });
        } else {
          // Checked out
          statuses.push({
            location,
            isCheckedIn: false,
          });
        }
      }

      setLocationStatuses(statuses);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('[StatusScreen] Failed to load location statuses:', error);
      Alert.alert('Error', 'Failed to load location statuses');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateElapsedTimes = () => {
    setLocationStatuses((prevStatuses) =>
      prevStatuses.map((status) => {
        if (status.isCheckedIn && status.clockInTime) {
          const checkInDate = new Date(status.clockInTime);
          const now = new Date();
          const elapsedMs = now.getTime() - checkInDate.getTime();
          const elapsedMinutes = Math.floor(elapsedMs / 60000);

          return {
            ...status,
            elapsedMinutes,
          };
        }
        return status;
      })
    );
  };

  const handleManualCheckIn = async (locationId: string) => {
    try {
      const db = await getDatabase();
      const trackingManager = new TrackingManager(db);

      await trackingManager.clockIn(locationId);

      Alert.alert('Success', 'Manually checked in');
      await loadLocationStatuses();
    } catch (error) {
      console.error('[StatusScreen] Failed to manually check in:', error);

      // If already checked in, refresh the status to show correct state
      if (error instanceof Error && error.message.includes('Already clocked in')) {
        Alert.alert(
          'Already Checked In',
          'You are already checked in at this location. Refreshing status...',
          [{ text: 'OK', onPress: () => loadLocationStatuses() }]
        );
        await loadLocationStatuses();
      } else {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to check in');
      }
    }
  };

  const handleManualCheckOut = async (locationId: string) => {
    try {
      const db = await getDatabase();
      const trackingManager = new TrackingManager(db);

      await trackingManager.clockOut(locationId);

      Alert.alert('Success', 'Manually checked out');
      await loadLocationStatuses();
    } catch (error) {
      console.error('[StatusScreen] Failed to manually check out:', error);

      // If not checked in, refresh the status to show correct state
      if (error instanceof Error && error.message.includes('No active session')) {
        Alert.alert(
          'Not Checked In',
          'You are not currently checked in at this location. Refreshing status...',
          [{ text: 'OK', onPress: () => loadLocationStatuses() }]
        );
        await loadLocationStatuses();
      } else {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to check out');
      }
    }
  };

  const formatElapsedTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const renderLocationStatus = ({ item }: { item: LocationStatus }) => {
    const { location, isCheckedIn, elapsedMinutes } = item;

    return (
      <View style={styles.locationCard}>
        <View style={styles.locationHeader}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationName}>{location.name}</Text>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusIndicator,
              isCheckedIn ? styles.statusIndicatorActive : styles.statusIndicatorInactive,
            ]}
          />
          <Text style={styles.statusText}>
            {isCheckedIn ? 'Checked In' : 'Checked Out'}
          </Text>
        </View>

        {isCheckedIn && elapsedMinutes !== undefined && (
          <Text style={styles.elapsedTime}>⏱️ {formatElapsedTime(elapsedMinutes)}</Text>
        )}

        <TouchableOpacity
          style={[
            styles.manualButton,
            isCheckedIn ? styles.manualButtonCheckOut : styles.manualButtonCheckIn,
          ]}
          onPress={() =>
            isCheckedIn
              ? handleManualCheckOut(location.id)
              : handleManualCheckIn(location.id)
          }
        >
          <Text style={styles.manualButtonText}>
            {isCheckedIn ? 'Check Out Now' : 'Check In Now'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Open Working Hours</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Permission Warning Banner */}
      <PermissionWarningBanner visible={!hasBackgroundPermission} />

      {/* Location Status List */}
      <FlatList
        data={locationStatuses}
        keyExtractor={(item) => item.location.id}
        renderItem={renderLocationStatus}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadLocationStatuses();
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No locations saved yet</Text>
            <Text style={styles.emptySubtext}>
              Go to Settings → Work Locations to add your first location
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  listContent: {
    padding: 20,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusIndicatorActive: {
    backgroundColor: '#4CAF50', // Green
  },
  statusIndicatorInactive: {
    backgroundColor: '#9E9E9E', // Grey
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  elapsedTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  manualButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualButtonCheckIn: {
    backgroundColor: '#4CAF50',
  },
  manualButtonCheckOut: {
    backgroundColor: '#FF5722',
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
