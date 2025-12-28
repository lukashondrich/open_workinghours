import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Circle, Bot, Hand } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { Button, Card, Badge } from '@/components/ui';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import type { UserLocation, TrackingSession } from '@/modules/geofencing/types';

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
        <ActivityIndicator size="large" color={colors.primary[500]} />
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
        <Badge
          variant={isTracking ? 'success' : 'default'}
          size="md"
          icon={<Circle size={16} color={isTracking ? colors.primary[500] : colors.grey[400]} fill={isTracking ? colors.primary[500] : 'transparent'} />}
          style={styles.statusBadge}
        >
          {isTracking ? 'Currently Working' : 'Not Tracking'}
        </Badge>

        {isTracking && activeSession && (
          <Card style={styles.sessionCard}>
            <Text style={styles.sessionLabel}>Clocked in</Text>
            <Text style={styles.sessionTime}>
              {new Date(activeSession.clockIn).toLocaleTimeString()}
            </Text>
            <Text style={styles.elapsedTime}>{elapsedTime}</Text>
            <View style={styles.trackingMethodRow}>
              {activeSession.trackingMethod === 'geofence_auto' ? (
                <>
                  <Bot size={16} color={colors.text.secondary} />
                  <Text style={styles.sessionHint}>Automatically tracked</Text>
                </>
              ) : (
                <>
                  <Hand size={16} color={colors.text.secondary} />
                  <Text style={styles.sessionHint}>Manually clocked in</Text>
                </>
              )}
            </View>
          </Card>
        )}
      </View>

      <View style={styles.controls}>
        {isTracking ? (
          <Button
            variant="danger"
            onPress={handleClockOut}
            loading={actionLoading}
            disabled={actionLoading}
            fullWidth
            size="lg"
          >
            Clock Out
          </Button>
        ) : (
          <Button
            onPress={handleClockIn}
            loading={actionLoading}
            disabled={actionLoading}
            fullWidth
            size="lg"
          >
            Clock In
          </Button>
        )}

        <Text style={styles.hint}>
          {isTracking
            ? 'Leave the geofence area to automatically clock out'
            : 'Enter the geofence area to automatically clock in'}
        </Text>

        <Button variant="ghost" onPress={handleViewHistory}>
          View Work History
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
  },
  header: {
    backgroundColor: colors.background.paper,
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  locationName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  statusBadge: {
    marginBottom: spacing.xxxl,
  },
  sessionCard: {
    alignItems: 'center',
    width: '100%',
    padding: spacing.xxl,
  },
  sessionLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  sessionTime: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  elapsedTime: {
    fontSize: fontSize.xl,
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  trackingMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionHint: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  controls: {
    backgroundColor: colors.background.paper,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginVertical: spacing.lg,
    lineHeight: 18,
  },
});
