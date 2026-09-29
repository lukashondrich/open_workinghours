/**
 * Platform selector for the tracking core.
 *
 *  - iOS     → TrackingManagerIOS: the logic shipped in every public iOS release
 *              (v2.1.0 … v2.1.4). Left untouched on purpose — see its header.
 *  - Android → TrackingManagerAndroid: the 2026-09 rework (session rules 1–5) built
 *              from the Android tester's stories; the keepalive service exists
 *              only on Android and is the Android core's primary signal.
 *
 * Both classes share the same public surface (`TrackingManager` interface
 * below), the same Database and the same ExitVerificationService. Code that
 * is platform-specific by nature (KeepaliveHealthCheckService) imports the Android core
 * directly; screens and App.tsx go through this selector. Tests import the
 * concrete class they mean — the scenario suite runs both profiles.
 */
import { Platform } from 'react-native';
import type { Database } from './Database';
import type { GeofenceEventData, TrackingSession } from '../types';
import { TrackingManagerIOS } from './TrackingManagerIOS';
import { TrackingManagerAndroid } from './TrackingManagerAndroid';

export interface TrackingManager {
  handleGeofenceEnter(event: GeofenceEventData): Promise<void>;
  handleGeofenceExit(event: GeofenceEventData): Promise<void>;
  processPendingExits(): Promise<void>;
  clockIn(locationId: string): Promise<void>;
  clockOut(locationId: string): Promise<void>;
  getActiveSession(locationId: string): Promise<TrackingSession | null>;
  getHistory(locationId: string, limit?: number): Promise<TrackingSession[]>;
}

export const TrackingManager: new (db: Database) => TrackingManager =
  Platform.OS === 'ios' ? TrackingManagerIOS : TrackingManagerAndroid;

