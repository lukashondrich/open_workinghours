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
    accuracy_source: string | null;
    ignored: boolean;
    ignore_reason: string | null;
    location_name?: string | null;
  }>;
  accuracy_stats: {
    min: number;
    max: number;
    avg: number;
    count: number;
  };
  ignored_events_count: number;
  signal_degradation_count: number;
  debounced_events_count: number;
  manual_session_count: number;
  stale_timestamp_count: number;
}

/**
 * Session telemetry: the tracking sessions themselves (no coordinates).
 * Needed to diagnose duplicate/overlapping sessions, negative durations and
 * unexpected clock-outs — the geofence event log alone cannot show those.
 */
interface SessionTelemetryEntry {
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  tracking_method: 'geofence_auto' | 'manual';
  state: string;
  pending_exit_at: string | null;
  checkin_accuracy: number | null;
  exit_accuracy: number | null;
  /** When the row was written/updated — a late replay is visible as created_at ≫ clock_in. */
  created_at: string;
  updated_at: string;
  /** Per-report opaque index so sessions of the same workplace can be grouped without naming it. */
  location_index: number;
  location_name?: string | null;
}

// Data minimisation: only what a tracking bug report needs — recent sessions,
// bounded by count AND by age (about two weeks covers every tester story so far).
const SESSION_TELEMETRY_LIMIT = 50;
const SESSION_TELEMETRY_MAX_AGE_DAYS = 14;

interface AppStateSnapshot {
  user: User | null;
  locations: {
    total: number;
    details: Array<{ name: string; latitude: number; longitude: number }> | null;
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
  session_telemetry: SessionTelemetryEntry[];
}

interface ReportIssueOptions {
  description?: string;
  featureArea?: string;
  includeLocationDiagnostics?: boolean;
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Collect GPS telemetry for parameter tuning
 */
async function collectGpsTelemetry(includeLocationDiagnostics: boolean): Promise<GpsTelemetry> {
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
    recent_events: recentEvents.map(e => {
      const event: GpsTelemetry['recent_events'][number] = {
        timestamp: e.timestamp,
        event_type: e.eventType,
        accuracy_meters: e.accuracy ?? null,
        accuracy_source: e.accuracySource ?? null,
        ignored: e.ignored,
        ignore_reason: e.ignoreReason,
      };

      if (!includeLocationDiagnostics) {
        return event;
      }

      return {
        ...event,
        location_name: e.locationName ?? 'Unknown',
      };
    }),
    accuracy_stats: accuracyStats,
    ignored_events_count: recentEvents.filter(e => e.ignored).length,
    signal_degradation_count: recentEvents.filter(e => e.ignoreReason === 'signal_degradation').length,
    debounced_events_count: recentEvents.filter(e => e.ignoreReason === 'debounced').length,
    manual_session_count: recentEvents.filter(e => e.ignoreReason === 'manual_session').length,
    stale_timestamp_count: recentEvents.filter(e => e.ignoreReason === 'stale_timestamp').length,
  };
}

/**
 * Collect the most recent tracking sessions (newest first, no coordinates).
 */
async function collectSessionTelemetry(includeLocationDiagnostics: boolean): Promise<SessionTelemetryEntry[]> {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - SESSION_TELEMETRY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sessions = (await db.getRecentSessions(SESSION_TELEMETRY_LIMIT)).filter((s) => s.clockIn >= cutoff);

  // Opaque per-report index (stable within the report only)
  const locationIndex = new Map<string, number>();
  for (const s of sessions) {
    if (!locationIndex.has(s.locationId)) locationIndex.set(s.locationId, locationIndex.size);
  }

  const locationNames = new Map<string, string>();
  if (includeLocationDiagnostics) {
    for (const loc of await db.getAllLocations()) {
      locationNames.set(loc.id, loc.name);
    }
  }

  return sessions.map((s) => {
    const entry: SessionTelemetryEntry = {
      clock_in: s.clockIn,
      clock_out: s.clockOut,
      duration_minutes: s.durationMinutes,
      tracking_method: s.trackingMethod,
      state: s.state,
      pending_exit_at: s.pendingExitAt ?? null,
      checkin_accuracy: s.checkinAccuracy ?? null,
      exit_accuracy: s.exitAccuracy ?? null,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      location_index: locationIndex.get(s.locationId) ?? 0,
    };
    if (includeLocationDiagnostics) {
      entry.location_name = locationNames.get(s.locationId) ?? 'Unknown';
    }
    return entry;
  });
}

/**
 * Collect app state snapshot for bug report
 */
export async function collectAppState(
  user: User | null,
  includeLocationDiagnostics = false,
): Promise<AppStateSnapshot> {
  const db = await getDatabase();

  // Get active locations
  const locations = await db.getActiveLocations();

  // Note: Work events are tracked via tracking sessions in this app
  const allSessions = await db.getAllSessions();

  // Collect GPS telemetry for parameter tuning
  const gpsTelemetry = await collectGpsTelemetry(includeLocationDiagnostics);
  const sessionTelemetry = await collectSessionTelemetry(includeLocationDiagnostics);

  return {
    user,
    locations: {
      total: locations.length,
      details: includeLocationDiagnostics
        ? locations.map(loc => ({
          name: loc.name,
          latitude: roundCoordinate(loc.latitude),
          longitude: roundCoordinate(loc.longitude),
        }))
        : null,
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
    session_telemetry: sessionTelemetry,
  };
}

/**
 * Submit bug report to backend API
 */
export async function reportIssue(
  user: User | null,
  options: ReportIssueOptions = {},
): Promise<void> {
  try {
    const includeLocationDiagnostics = options.includeLocationDiagnostics === true;

    // Collect app state
    const appState = await collectAppState(user, includeLocationDiagnostics);

    // Prepare API payload
    const payload = {
      user_id: user?.userId || null,
      hospital_id: null,
      specialty: null,
      role_level: null,
      state_code: null,
      include_location_diagnostics: includeLocationDiagnostics,
      diagnostics_scope: includeLocationDiagnostics ? 'location' : 'standard',
      feature_area: options.featureArea || null,

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
      // Tracking sessions (no coordinates) for session-integrity debugging
      session_telemetry: appState.session_telemetry,

      description: options.description || null,
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
