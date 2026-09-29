import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { LOCATION_KEEPALIVE_TASK_NAME } from '../constants';
import { getDatabase } from './Database';

const KEEPALIVE_NOTIFICATION_TITLE = 'Open Working Hours';
const KEEPALIVE_NOTIFICATION_BODY = 'Automatische Zeiterfassung aktiv';
// HEARTBEAT: a fix every 5 minutes whether or not the phone moves. expo-location
// maps distanceInterval to the fused provider's minimum update distance, which is
// a hard filter — with the earlier 200 m a phone sitting still at work produced
// NO fixes at all, so silence could not be told apart from "left". The Android
// core (TrackingManagerAndroid) relies on this stream being regular; see its
// header. Background deliveries are batched by deferredUpdatesInterval.
const KEEPALIVE_DISTANCE_INTERVAL_METERS = 0;
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
    // Balanced = PRIORITY_BALANCED_POWER_ACCURACY (block level, mostly Wi-Fi/cell).
    // expo-location 19 maps Accuracy.Low to the same priority, so this is a
    // statement of intent, not a behaviour change. Every 5 minutes keeps the
    // battery cost bounded.
    accuracy: Location.Accuracy.Balanced,
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
