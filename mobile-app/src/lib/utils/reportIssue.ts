/**
 * Report Issue Utility
 * Collects app state and submits bug reports to backend
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { User } from '@/lib/auth/auth-types';
import { Database } from '@/modules/geofencing/services/Database';

const BASE_URL = Constants.expoConfig?.extra?.authBaseUrl || 'http://localhost:8000';

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
}

/**
 * Collect app state snapshot for bug report
 */
export async function collectAppState(user: User | null): Promise<AppStateSnapshot> {
  const db = Database.getInstance();

  // Get locations
  const locations = await db.getAllLocations();

  // Get work events stats
  const allWorkEvents = await db.getAllWorkEvents();
  const pendingEvents = allWorkEvents.filter(event => !event.confirmed);

  // Find last submission (most recent confirmed event)
  const confirmedEvents = allWorkEvents.filter(event => event.confirmed);
  const lastSubmission = confirmedEvents.length > 0
    ? confirmedEvents.reduce((latest, event) =>
        event.confirmedAt && (!latest || event.confirmedAt > latest)
          ? event.confirmedAt
          : latest
      , null as Date | null)
    : null;

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
      total: allWorkEvents.length,
      lastSubmission,
      pending: pendingEvents.length,
    },
    appInfo: {
      version: Constants.expoConfig?.version || 'unknown',
      buildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode?.toString() || 'unknown',
      platform: Device.osName || 'unknown',
      deviceModel: Device.modelName,
      osVersion: Device.osVersion,
    },
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
