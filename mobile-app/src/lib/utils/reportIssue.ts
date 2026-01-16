/**
 * Report Issue Utility
 * Collects app state and submits bug reports to backend
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { User } from '@/lib/auth/auth-types';
import { getDatabase } from '@/modules/geofencing/services/Database';

const BASE_URL = Constants.expoConfig?.extra?.authBaseUrl || 'http://localhost:8000';

interface GpsTelemetry {
  recent_events: Array<{
    timestamp: string;
    event_type: 'enter' | 'exit';
    accuracy_meters: number | null;
    ignored: boolean;
    ignore_reason: string | null;
    location_name: string;
  }>;
  accuracy_stats: {
    min: number;
    max: number;
    avg: number;
    count: number;
  };
  ignored_events_count: number;
  signal_degradation_count: number;
}

interface AppStateSnapshot {
  user: User | null;
  locations: {
    total: number;
    details: Array<{ name: string; latitude: number; longitude: number }>;
  };
  workEvents: {
    total: number;
    lastSubmission: Date | null;
    pending: number;
  };
  appInfo: {
    version: string;
    buildNumber: string;
    platform: string;
    deviceModel: string | null;
    osVersion: string | null;
  };
  gps_telemetry: GpsTelemetry;
}

/**
 * Collect GPS telemetry for parameter tuning
 */
async function collectGpsTelemetry(): Promise<GpsTelemetry> {
  const db = await getDatabase();

  // Get last 100 geofence events with accuracy data
  const recentEvents = await db.getRecentGeofenceEvents(100);

  // Calculate accuracy statistics from events that have accuracy data
  const accuracyValues = recentEvents
    .filter(e => e.accuracy != null)
    .map(e => e.accuracy!);

  const accuracyStats = {
    min: accuracyValues.length > 0 ? Math.min(...accuracyValues) : 0,
    max: accuracyValues.length > 0 ? Math.max(...accuracyValues) : 0,
    avg: accuracyValues.length > 0
      ? accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length
      : 0,
    count: accuracyValues.length,
  };

  return {
    recent_events: recentEvents.map(e => ({
      timestamp: e.timestamp,
      event_type: e.eventType,
      accuracy_meters: e.accuracy ?? null,
      ignored: e.ignored,
      ignore_reason: e.ignoreReason,
      location_name: e.locationName ?? 'Unknown',
    })),
    accuracy_stats: accuracyStats,
    ignored_events_count: recentEvents.filter(e => e.ignored).length,
    signal_degradation_count: recentEvents.filter(e => e.ignoreReason === 'signal_degradation').length,
  };
}

/**
 * Collect app state snapshot for bug report
 */
export async function collectAppState(user: User | null): Promise<AppStateSnapshot> {
  const db = await getDatabase();

  // Get active locations
  const locations = await db.getActiveLocations();

  // Note: Work events are tracked via tracking sessions in this app
  const allSessions = await db.getAllSessions();

  // Collect GPS telemetry for parameter tuning
  const gpsTelemetry = await collectGpsTelemetry();

  return {
    user,
    locations: {
      total: locations.length,
      details: locations.map(loc => ({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
      })),
    },
    workEvents: {
      total: allSessions.length,
      lastSubmission: null, // Not tracked in current architecture
      pending: 0, // Not applicable
    },
    appInfo: {
      version: Constants.expoConfig?.version || 'unknown',
      buildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode?.toString() || 'unknown',
      platform: Device.osName || 'unknown',
      deviceModel: Device.modelName,
      osVersion: Device.osVersion,
    },
    gps_telemetry: gpsTelemetry,
  };
}

/**
 * Submit bug report to backend API
 */
export async function reportIssue(user: User | null, description?: string): Promise<void> {
  try {
    // Collect app state
    const appState = await collectAppState(user);

    // Prepare API payload
    const payload = {
      user_id: user?.userId || null,
      user_email: user?.email || null,
      hospital_id: user?.hospitalId || null,
      specialty: user?.specialty || null,
      role_level: user?.roleLevel || null,
      state_code: user?.stateCode || null,

      locations_count: appState.locations.total,
      locations_details: appState.locations.details,

      work_events_total: appState.workEvents.total,
      work_events_pending: appState.workEvents.pending,
      last_submission: appState.workEvents.lastSubmission,

      app_version: appState.appInfo.version,
      build_number: appState.appInfo.buildNumber,
      platform: appState.appInfo.platform,
      device_model: appState.appInfo.deviceModel,
      os_version: appState.appInfo.osVersion,

      // GPS telemetry for parameter tuning
      gps_telemetry: appState.gps_telemetry,

      description: description || null,
    };

    // Submit to backend
    const response = await fetch(`${BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to submit bug report');
    }

    const result = await response.json();
    console.log('[reportIssue] Bug report submitted successfully:', result);
  } catch (error) {
    console.error('[reportIssue] Failed to submit bug report:', error);
    throw error;
  }
}
