import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MapView, { Circle as MapCircle, Marker } from 'react-native-maps';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Circle, Bot, Hand } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
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
      Alert.alert(t('common.error'), t('tracking.loadFailed'));
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
      Alert.alert(t('common.error'), error.message || t('tracking.clockInFailed'));
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
      Alert.alert(t('common.error'), error.message || t('tracking.clockOutFailed'));
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

  // Map circle colors
  const MAP_CIRCLE_STROKE = 'rgba(46, 139, 107, 0.6)';
  const MAP_CIRCLE_FILL = 'rgba(46, 139, 107, 0.2)';

  return (
    <View style={styles.container}>
      {/* Map showing saved location */}
      {location && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            scrollEnabled={true}
            zoomEnabled={true}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
            />
            <MapCircle
              center={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              radius={location.radiusMeters}
              strokeColor={MAP_CIRCLE_STROKE}
              fillColor={MAP_CIRCLE_FILL}
              strokeWidth={2}
            />
          </MapView>
          <View style={styles.mapOverlay}>
            <Text style={styles.locationName}>{location.name}</Text>
            <Text style={styles.radiusText}>{location.radiusMeters}m radius</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.statusContainer}>
          <Badge
          variant={isTracking ? 'success' : 'default'}
          size="md"
          icon={<Circle size={16} color={isTracking ? colors.primary[500] : colors.grey[400]} fill={isTracking ? colors.primary[500] : 'transparent'} />}
          style={styles.statusBadge}
        >
          {isTracking ? t('tracking.currentlyWorking') : t('tracking.notTracking')}
        </Badge>

        {isTracking && activeSession && (
          <Card style={styles.sessionCard}>
            <Text style={styles.sessionLabel}>{t('tracking.clockedIn')}</Text>
            <Text style={styles.sessionTime}>
              {new Date(activeSession.clockIn).toLocaleTimeString()}
            </Text>
            <Text style={styles.elapsedTime}>{elapsedTime}</Text>
            <View style={styles.trackingMethodRow}>
              {activeSession.trackingMethod === 'geofence_auto' ? (
                <>
                  <Bot size={16} color={colors.text.secondary} />
                  <Text style={styles.sessionHint}>{t('tracking.automaticallyTracked')}</Text>
                </>
              ) : (
                <>
                  <Hand size={16} color={colors.text.secondary} />
                  <Text style={styles.sessionHint}>{t('tracking.manuallyClocked')}</Text>
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
              {t('tracking.clockOut')}
            </Button>
          ) : (
            <Button
              onPress={handleClockIn}
              loading={actionLoading}
              disabled={actionLoading}
              fullWidth
              size="lg"
            >
              {t('tracking.clockIn')}
            </Button>
          )}

          <Text style={styles.hint}>
            {isTracking
              ? t('tracking.hintTracking')
              : t('tracking.hintNotTracking')}
          </Text>

          <Button variant="ghost" onPress={handleViewHistory}>
            {t('tracking.viewHistory')}
          </Button>
        </View>
      </ScrollView>
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
  mapContainer: {
    height: 200,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: spacing.md,
    paddingRight: spacing.xl,
  },
  locationName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  radiusText: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: spacing.xl,
  },
  statusContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  statusBadge: {
    marginBottom: spacing.lg,
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
