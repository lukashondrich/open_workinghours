import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { View, Text, ActivityIndicator, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AppNavigator from '@/navigation/AppNavigator';
import { AuthProvider } from '@/lib/auth/auth-context';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import * as ExitVerificationService from '@/modules/geofencing/services/ExitVerificationService';
import { GEOFENCE_TASK_NAME, LOCATION_KEEPALIVE_TASK_NAME } from '@/modules/geofencing/constants';
import { syncKeepaliveState } from '@/modules/geofencing/services/ForegroundKeepaliveService';
import { handleKeepaliveTaskPayload } from '@/modules/geofencing/services/KeepaliveHealthCheckService';
import { AccuracySource, GeofenceEventData } from '@/modules/geofencing/types';
import { seedTestDeviceDataIfEnabled } from '@/test-utils/deviceDbSeed';
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

      const event: GeofenceEventData = {
        eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
        locationId: region.identifier ?? '',
        timestamp: new Date().toISOString(),
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
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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

      // Initialize geofencing
      const geofenceService = getGeofenceService();
      const trackingManager = new TrackingManager(db);

      // Store reference so the module-scope task handler uses the initialized instance
      globalTrackingManager = trackingManager;

      console.log('[App] Background task already defined at module scope');

      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[App] Notification permission not granted');
      } else {
        console.log('[App] Notification permission granted');
      }

      // Set up Android notification channels
      if (Platform.OS === 'android') {
        // Channel for silent tracking notifications (exit verification)
        await Notifications.setNotificationChannelAsync('tracking', {
          name: 'Work Tracking',
          importance: Notifications.AndroidImportance.HIGH,
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

      // Set up listener for exit verification notifications
      // These are scheduled silent notifications that trigger GPS checks
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

      // Re-register any existing geofences (in case app was killed)
      const locations = await db.getActiveLocations();
      console.log('[App] Found', locations.length, 'active locations');

      for (const location of locations) {
        try {
          await geofenceService.registerGeofence(location);
          console.log('[App] Re-registered geofence:', location.name);
        } catch (error) {
          console.warn('[App] Failed to register geofence for', location.name, ':', error);
          // Continue with other locations even if one fails
        }
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
      <SafeAreaProvider>
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
