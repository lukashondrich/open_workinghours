import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { View, Text, ActivityIndicator, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AppNavigator from '@/navigation/AppNavigator';
import { AuthProvider } from '@/lib/auth/auth-context';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import { GeofenceRegistrationService } from '@/modules/geofencing/services/GeofenceRegistrationService';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import * as ExitVerificationService from '@/modules/geofencing/services/ExitVerificationService';
import { GEOFENCE_TASK_NAME, LOCATION_KEEPALIVE_TASK_NAME } from '@/modules/geofencing/constants';
import { syncKeepaliveState } from '@/modules/geofencing/services/ForegroundKeepaliveService';
import { handleKeepaliveTaskPayload } from '@/modules/geofencing/services/KeepaliveHealthCheckService';
import { AccuracySource, GeofenceEventData } from '@/modules/geofencing/types';
import { seedTestDeviceDataIfEnabled } from '@/test-utils/deviceDbSeed';
import { seedDashboardTestData } from '@/test-utils/seedDashboardData';
console.log('SUBMISSION URL', process.env.EXPO_PUBLIC_SUBMISSION_BASE_URL);

// ============================================================================
// Background task definitions — MUST be at module scope for headless launches.
// When the OS restarts the app via PendingIntent (process was killed),
// React components don't mount, so useEffect never fires. Module-scope
// defineTask ensures the handler is always registered.
// ============================================================================

// Keep a reference to the TrackingManager for foreground processing
let globalTrackingManager: TrackingManager | null = null;
let geofenceTaskQueue: Promise<void> = Promise.resolve();
const GEOFENCE_ACTIVE_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_LOCATION_ACCURACY_METERS = 100;

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMeters = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

async function getCurrentPositionWithTimeout(
  accuracy: Location.Accuracy,
  timeoutMs: number
): Promise<Location.LocationObject> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('current position timeout')),
        timeoutMs
      );
    });

    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      timeoutPromise,
    ]) as Location.LocationObject;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

// Geofence background task — handles enter/exit events from the OS
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[GeofenceTask] Task error:', error);
    return;
  }
  if (!data) return;

  geofenceTaskQueue = geofenceTaskQueue
    .catch(() => undefined)
    .then(async () => {
      const { eventType, region } = data as {
        eventType: Location.GeofencingEventType;
        region: Location.LocationRegion;
      };

      // Extract location data with accuracy if available
      const locationData = (data as any).location as Location.LocationObject | undefined;

      // Active GPS fetch if no location data came with the event
      let gpsReading = locationData;
      let accuracySource: AccuracySource = locationData ? 'event' : null;

      if (!gpsReading) {
        try {
          gpsReading = await getCurrentPositionWithTimeout(
            Location.Accuracy.Balanced,
            GEOFENCE_ACTIVE_FETCH_TIMEOUT_MS
          );
          accuracySource = 'active_fetch';
          console.log(`[GeofenceTask] Active GPS fetch: accuracy=${gpsReading.coords.accuracy}m`);
        } catch (fetchError) {
          console.warn('[GeofenceTask] Active GPS fetch failed:', fetchError);
        }
      }

      // Guard against stale/false "enter" callbacks.
      // If we cannot get a GPS reading, or if the reading is confidently outside
      // the geofence region, ignore this enter event.
      if (eventType === Location.GeofencingEventType.Enter) {
        if (!gpsReading) {
          console.warn(`[GeofenceTask] Ignoring enter for ${region.identifier} - no GPS reading available`);
          return;
        }

        const distanceMeters = calculateDistanceMeters(
          gpsReading.coords.latitude,
          gpsReading.coords.longitude,
          region.latitude,
          region.longitude
        );
        const accuracyMeters = gpsReading.coords.accuracy ?? DEFAULT_LOCATION_ACCURACY_METERS;
        const radiusMeters = region.radius ?? 100;
        const confidentlyOutside = distanceMeters - accuracyMeters > radiusMeters;

        if (confidentlyOutside) {
          console.warn(
            `[GeofenceTask] Ignoring enter for ${region.identifier} - confidently outside (${distanceMeters.toFixed(0)}m from center, accuracy ${accuracyMeters.toFixed(0)}m, radius ${radiusMeters}m)`
          );
          return;
        }
      }

      const event: GeofenceEventData = {
        eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
        locationId: region.identifier ?? '',
        // Prefer the triggering fix's own timestamp so a delayed/batched geofence
        // callback records when the transition actually happened, not when Android
        // finally delivered it. Falls back to now when no GPS reading is available.
        timestamp: gpsReading?.timestamp
          ? new Date(gpsReading.timestamp).toISOString()
          : new Date().toISOString(),
        latitude: gpsReading?.coords?.latitude ?? region.latitude,
        longitude: gpsReading?.coords?.longitude ?? region.longitude,
        accuracy: gpsReading?.coords?.accuracy ?? undefined,
        accuracySource,
      };

      console.log(`[GeofenceTask] Geofence ${event.eventType} event for ${event.locationId}, accuracy: ${event.accuracy ?? 'unknown'}m (${accuracySource ?? 'none'})`);

      // Use existing TrackingManager if app is running, otherwise create one
      let trackingManager = globalTrackingManager;
      if (!trackingManager) {
        console.log('[GeofenceTask] Headless launch — creating TrackingManager');
        const db = await getDatabase();
        trackingManager = new TrackingManager(db);
      }

      try {
        if (event.eventType === 'enter') {
          await trackingManager.handleGeofenceEnter(event);
        } else if (event.eventType === 'exit') {
          await trackingManager.handleGeofenceExit(event);
        }
      } catch (err) {
        console.error('[GeofenceTask] Error handling geofence event:', err);
      }
    });

  await geofenceTaskQueue;
});

// Location keepalive task — runs lightweight fallback health checks on updates.
TaskManager.defineTask(LOCATION_KEEPALIVE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[LocationKeepalive] Task error:', error);
    return;
  }

  try {
    await handleKeepaliveTaskPayload(data);
  } catch (err) {
    console.error('[LocationKeepalive] Task handler failed:', err);
  }
});

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: string } | undefined;
    const isExitVerification = data?.type === 'exit-verification';

    return {
      // Keep verification checks quiet/non-visual while app is foregrounded.
      shouldPlaySound: !isExitVerification,
      shouldSetBadge: false,
      shouldShowBanner: !isExitVerification,
      shouldShowList: !isExitVerification,
    };
  },
});

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeApp();
  }, []);

  // Process pending exits when app comes to foreground
  // This is a safety net to ensure clock-outs happen even if verification notifications didn't fire
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[App] App came to foreground - processing pending exits');
        if (globalTrackingManager) {
          try {
            await globalTrackingManager.processPendingExits();
          } catch (error) {
            console.warn('[App] Error processing pending exits on foreground:', error);
          }
        }

        try {
          await syncKeepaliveState();
        } catch (error) {
          console.warn('[App] Failed to sync keepalive on foreground:', error);
        }

        try {
          await GeofenceRegistrationService.ensureRegisteredGeofences();
        } catch (error) {
          console.warn('[App] Error ensuring geofences on foreground:', error);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Initializing...');

      // Initialize database
      const db = await getDatabase();
      console.log('[App] Database initialized');

      // Seed test fixtures when explicitly enabled (Detox/CI)
      if (Constants.expoConfig?.extra?.TEST_DB_SEED || (process as any)?.env?.TEST_DB_SEED) {
        await seedTestDeviceDataIfEnabled();
        console.log('[App] Seeded test data');
      }

      // Rich seed for App Store screenshots: 14 days of varied shifts,
      // overtime tracking, vacation/sick days, future "Next Shift" entries.
      if (Constants.expoConfig?.extra?.TEST_SCREENSHOT_SEED) {
        await seedDashboardTestData();
        console.log('[App] Seeded screenshot dashboard data');
      }

      // Initialize geofencing
      const geofenceService = getGeofenceService();
      const trackingManager = new TrackingManager(db);

      // Store reference so the module-scope task handler uses the initialized instance
      globalTrackingManager = trackingManager;

      console.log('[App] Background task already defined at module scope');

      // Set up Android notification channels
      if (Platform.OS === 'android') {
        // Channel for background verification checks (exit verification).
        // Keep it low-importance to reduce intrusiveness.
        await Notifications.setNotificationChannelAsync('tracking', {
          name: 'Work Tracking',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // Channel for audible clock-in/out alerts
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Clock In/Out Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250],
        });

        console.log('[App] Android notification channels created');
      }

      // Set up listener for exit verification notifications.
      // These trigger background GPS checks for pending exits.
      Notifications.addNotificationReceivedListener(async (notification) => {
        const data = notification.request.content.data;

        if (data?.type === 'exit-verification' && typeof data?.checkIndex === 'number') {
          console.log('[App] Exit verification notification received, check:', data.checkIndex);
          try {
            await ExitVerificationService.handleVerificationCheck(data.checkIndex);
          } catch (error) {
            console.error('[App] Error handling exit verification:', error);
          }
        }
      });

      // Re-register any existing geofences if background permission is already granted.
      try {
        const result = await GeofenceRegistrationService.ensureRegisteredGeofences();
        if (result.skippedReason) {
          console.log('[App] Skipped geofence registration:', result.skippedReason);
        } else {
          console.log('[App] Re-registered geofences:', result.registeredCount);
        }
      } catch (error) {
        console.warn('[App] Failed to re-register geofences:', error);
      }

      try {
        await syncKeepaliveState();
      } catch (error) {
        console.warn('[App] Failed to sync keepalive state:', error);
      }

      // Process any pending exits that may have expired while app was backgrounded
      console.log('[App] Processing pending exits...');
      try {
        await trackingManager.processPendingExits();
        console.log('[App] Pending exits processed');
      } catch (error) {
        console.warn('[App] Error processing pending exits:', error);
      }

      console.log('[App] Initialization complete');
      setIsReady(true);
    } catch (error) {
      console.error('[App] Initialization error:', error);
      // Don't show error screen - let the app continue with manual mode
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
