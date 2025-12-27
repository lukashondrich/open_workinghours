import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { getDatabase } from '@/modules/geofencing/services/Database';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import {
  loadDashboardData,
  DashboardData,
} from '@/modules/geofencing/services/DashboardDataService';
import PermissionWarningBanner from '@/modules/geofencing/components/PermissionWarningBanner';
import HoursSummaryWidget from '@/modules/geofencing/components/HoursSummaryWidget';
import NextShiftWidget from '@/modules/geofencing/components/NextShiftWidget';
import type { UserLocation } from '@/modules/geofencing/types';
import type { RootStackParamList, MainTabParamList } from '@/navigation/AppNavigator';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type StatusScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Status'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface LocationStatus {
  location: UserLocation;
  isCheckedIn: boolean;
  clockInTime?: string;
  elapsedMinutes?: number;
}

function CollapsedStatusLine({
  status,
  onCheckIn,
  onCheckOut,
}: {
  status: LocationStatus;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const { location, isCheckedIn, elapsedMinutes } = status;

  const formatElapsed = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <View style={styles.statusLineCard}>
      <View style={styles.statusLineContent}>
        <View
          style={[
            styles.statusDot,
            isCheckedIn ? styles.statusDotActive : styles.statusDotInactive,
          ]}
        />
        <Text style={styles.locationName} numberOfLines={1}>
          {location.name}
        </Text>
        <Text style={styles.statusText}>
          {isCheckedIn
            ? `Checked in${elapsedMinutes !== undefined ? ` · ${formatElapsed(elapsedMinutes)}` : ''}`
            : 'Not checked in'}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.statusButton,
          isCheckedIn ? styles.checkOutButton : styles.checkInButton,
        ]}
        onPress={isCheckedIn ? onCheckOut : onCheckIn}
      >
        <Text style={styles.statusButtonText}>
          {isCheckedIn ? 'Out' : 'In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function StatusScreen() {
  const navigation = useNavigation<StatusScreenNavigationProp>();

  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(true);

  const loadAllData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();

      // Load location statuses
      const statuses: LocationStatus[] = [];
      for (const location of locations) {
        const activeSession = await db.getActiveSession(location.id);

        if (activeSession && !activeSession.clockOut) {
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
          statuses.push({
            location,
            isCheckedIn: false,
          });
        }
      }
      setLocationStatuses(statuses);

      // Load dashboard data
      const dashboard = await loadDashboardData();
      setDashboardData(dashboard);

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('[StatusScreen] Failed to load data:', error);
      Alert.alert('Error', 'Failed to load status data');
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const checkBackgroundPermission = async () => {
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      setHasBackgroundPermission(status === 'granted');
    } catch (error) {
      console.error('[StatusScreen] Failed to check background permission:', error);
    }
  };

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
      checkBackgroundPermission();
    }, [loadAllData])
  );

  // Update every 60 seconds for live data
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllData();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadAllData]);

  // Update elapsed times every minute (for checked-in status)
  useEffect(() => {
    const interval = setInterval(() => {
      setLocationStatuses((prevStatuses) =>
        prevStatuses.map((status) => {
          if (status.isCheckedIn && status.clockInTime) {
            const checkInDate = new Date(status.clockInTime);
            const now = new Date();
            const elapsedMs = now.getTime() - checkInDate.getTime();
            const elapsedMinutes = Math.floor(elapsedMs / 60000);
            return { ...status, elapsedMinutes };
          }
          return status;
        })
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleManualCheckIn = async (locationId: string) => {
    try {
      const db = await getDatabase();
      const trackingManager = new TrackingManager(db);
      await trackingManager.clockIn(locationId);
      Alert.alert('Success', 'Manually checked in');
      await loadAllData();
    } catch (error) {
      console.error('[StatusScreen] Failed to check in:', error);
      if (error instanceof Error && error.message.includes('Already clocked in')) {
        Alert.alert('Already Checked In', 'You are already checked in at this location.');
        await loadAllData();
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
      await loadAllData();
    } catch (error) {
      console.error('[StatusScreen] Failed to check out:', error);
      if (error instanceof Error && error.message.includes('No active session')) {
        Alert.alert('Not Checked In', 'You are not currently checked in at this location.');
        await loadAllData();
      } else {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to check out');
      }
    }
  };

  const handleNavigateToCalendar = () => {
    navigation.navigate('Calendar', {});
  };

  const handleNavigateToCalendarWithDate = (date: string) => {
    navigation.navigate('Calendar', { targetDate: date });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
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

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Collapsed Status Lines */}
        {locationStatuses.length > 0 ? (
          <View style={styles.statusSection}>
            {locationStatuses.map((status) => (
              <CollapsedStatusLine
                key={status.location.id}
                status={status}
                onCheckIn={() => handleManualCheckIn(status.location.id)}
                onCheckOut={() => handleManualCheckOut(status.location.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyLocationState}>
            <Text style={styles.emptyText}>No locations saved yet</Text>
            <Text style={styles.emptySubtext}>
              Go to Settings → Work Locations to add your first location
            </Text>
          </View>
        )}

        {/* Hours Summary Widget */}
        {dashboardData && (
          <HoursSummaryWidget
            data={dashboardData.hoursSummary}
            isLive={dashboardData.isLive}
            onPress={handleNavigateToCalendar}
          />
        )}

        {/* Next Shift Widget */}
        {dashboardData && (
          <NextShiftWidget
            nextShift={dashboardData.nextShift}
            onPress={() =>
              dashboardData.nextShift
                ? handleNavigateToCalendarWithDate(dashboardData.nextShift.date)
                : handleNavigateToCalendar()
            }
          />
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  statusSection: {
    marginBottom: 8,
  },
  statusLineCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statusLineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusDotActive: {
    backgroundColor: '#4CAF50',
  },
  statusDotInactive: {
    backgroundColor: '#9E9E9E',
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  statusButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginLeft: 8,
  },
  checkInButton: {
    backgroundColor: '#4CAF50',
  },
  checkOutButton: {
    backgroundColor: '#FF5722',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyLocationState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 40,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});
