import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import type { UserLocation, TrackingSession } from '@/modules/geofencing/types';
import { formatDistanceToNow } from 'date-fns';

type TrackingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Tracking'>;
type TrackingScreenRouteProp = RouteProp<RootStackParamList, 'Tracking'>;

interface Props {
  navigation: TrackingScreenNavigationProp;
  route: TrackingScreenRouteProp;
}

export default function TrackingScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [activeSession, setActiveSession] = useState<TrackingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('');

  useEffect(() => {
    loadLocation();
    const interval = setInterval(loadActiveSession, 5000);
    loadActiveSession();

    return () => clearInterval(interval);
  }, [locationId]);

  useEffect(() => {
    if (activeSession) {
      const updateElapsedTime = () => {
        const clockInTime = new Date(activeSession.clockIn);
        const now = new Date();
        const diffMs = now.getTime() - clockInTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setElapsedTime(`${hours}h ${minutes}m`);
      };

      updateElapsedTime();
      const interval = setInterval(updateElapsedTime, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const loadLocation = async () => {
    try {
      const db = await getDatabase();
      const loc = await db.getLocation(locationId);
      setLocation(loc);
    } catch (error) {
      console.error('Error loading location:', error);
      Alert.alert('Error', 'Failed to load location');
    }
  };

  const loadActiveSession = async () => {
    try {
      const db = await getDatabase();
      const manager = new TrackingManager(db);
      const session = await manager.getActiveSession(locationId);
      setActiveSession(session);
      setLoading(false);
    } catch (error) {
      console.error('Error loading session:', error);
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      const db = await getDatabase();
      const manager = new TrackingManager(db);
      await manager.clockIn(locationId);
      await loadActiveSession();
    } catch (error: any) {
      console.error('Error clocking in:', error);
      Alert.alert('Error', error.message || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      const db = await getDatabase();
      const manager = new TrackingManager(db);
      await manager.clockOut(locationId);
      await loadActiveSession();
    } catch (error: any) {
      console.error('Error clocking out:', error);
      Alert.alert('Error', error.message || 'Failed to clock out');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewHistory = () => {
    navigation.navigate('Log', { locationId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isTracking = activeSession !== null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.locationName}>{location?.name || 'Unknown Location'}</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, isTracking ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusIcon}>{isTracking ? '🟢' : '⚪'}</Text>
          <Text style={styles.statusText}>
            {isTracking ? 'Currently Working' : 'Not Tracking'}
          </Text>
        </View>

        {isTracking && activeSession && (
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionLabel}>Clocked in</Text>
            <Text style={styles.sessionTime}>
              {new Date(activeSession.clockIn).toLocaleTimeString()}
            </Text>
            <Text style={styles.elapsedTime}>{elapsedTime}</Text>
            <Text style={styles.sessionHint}>
              {activeSession.trackingMethod === 'geofence_auto'
                ? '🤖 Automatically tracked'
                : '✋ Manually clocked in'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonClockOut, actionLoading && styles.buttonDisabled]}
            onPress={handleClockOut}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Clock Out</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonClockIn, actionLoading && styles.buttonDisabled]}
            onPress={handleClockIn}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Clock In</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>
          {isTracking
            ? 'Leave the geofence area to automatically clock out'
            : 'Enter the geofence area to automatically clock in'}
        </Text>

        <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
          <Text style={styles.historyButtonText}>View Work History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  locationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 30,
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
  },
  statusInactive: {
    backgroundColor: '#f5f5f5',
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sessionInfo: {
    alignItems: 'center',
  },
  sessionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  elapsedTime: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  sessionHint: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonClockIn: {
    backgroundColor: '#4CAF50',
  },
  buttonClockOut: {
    backgroundColor: '#f44336',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  historyButton: {
    padding: 12,
    alignItems: 'center',
  },
  historyButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
