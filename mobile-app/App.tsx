import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import AppNavigator from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Initializing...');

      // Initialize database
      const db = await getDatabase();
      console.log('[App] Database initialized');

      // Initialize geofencing
      const geofenceService = getGeofenceService();
      const trackingManager = new TrackingManager(db);

      // Define background task for geofence events
      geofenceService.defineBackgroundTask(async (event) => {
        console.log('[App] Geofence event:', event.eventType, event.locationId);

        try {
          if (event.eventType === 'enter') {
            await trackingManager.handleGeofenceEnter(event);
          } else if (event.eventType === 'exit') {
            await trackingManager.handleGeofenceExit(event);
          }
        } catch (error) {
          console.error('[App] Error handling geofence event:', error);
        }
      });

      console.log('[App] Background task defined');

      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[App] Notification permission not granted');
      } else {
        console.log('[App] Notification permission granted');
      }

      // Re-register any existing geofences (in case app was killed)
      const locations = await db.getActiveLocations();
      console.log('[App] Found', locations.length, 'active locations');

      for (const location of locations) {
        await geofenceService.registerGeofence(location);
        console.log('[App] Re-registered geofence:', location.name);
      }

      console.log('[App] Initialization complete');
      setIsReady(true);
    } catch (error) {
      console.error('[App] Initialization error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsReady(true); // Still show the app even if there's an error
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

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
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
