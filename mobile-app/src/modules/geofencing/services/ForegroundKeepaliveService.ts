import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { LOCATION_KEEPALIVE_TASK_NAME } from '../constants';
import { getDatabase } from './Database';

const KEEPALIVE_NOTIFICATION_TITLE = 'Open Working Hours';
const KEEPALIVE_NOTIFICATION_BODY = 'Automatische Zeiterfassung aktiv';
const KEEPALIVE_DISTANCE_INTERVAL_METERS = 200;
const KEEPALIVE_TIME_INTERVAL_MS = 300000; // 5 minutes

async function shouldKeepaliveRun(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }

  const db = await getDatabase();
  const activeLocations = await db.getActiveLocations();
  return activeLocations.length > 0;
}

async function startKeepalive(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_KEEPALIVE_TASK_NAME, {
    // Keep battery usage bounded while still producing usable fallback updates.
    accuracy: Location.Accuracy.Low,
    distanceInterval: KEEPALIVE_DISTANCE_INTERVAL_METERS,
    timeInterval: KEEPALIVE_TIME_INTERVAL_MS,
    deferredUpdatesInterval: KEEPALIVE_TIME_INTERVAL_MS,
    foregroundService: {
      notificationTitle: KEEPALIVE_NOTIFICATION_TITLE,
      notificationBody: KEEPALIVE_NOTIFICATION_BODY,
      notificationColor: '#2E7D32',
      killServiceOnDestroy: false,
    },
  });

  console.log('[ForegroundKeepalive] Service started');
}

async function stopKeepalive(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_KEEPALIVE_TASK_NAME);
  if (!isRegistered) {
    return;
  }

  await Location.stopLocationUpdatesAsync(LOCATION_KEEPALIVE_TASK_NAME);
  console.log('[ForegroundKeepalive] Service stopped');
}

/**
 * Single policy entrypoint for Android keepalive state.
 * Safe to call from any known foreground context.
 */
export async function syncKeepaliveState(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  if (await shouldKeepaliveRun()) {
    await startKeepalive();
    return;
  }

  await stopKeepalive();
}
