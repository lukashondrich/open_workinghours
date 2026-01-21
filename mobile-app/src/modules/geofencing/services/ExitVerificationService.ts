/**
 * Exit Verification Service
 *
 * Handles verification of geofence exits using scheduled notifications
 * and discrete GPS checks. This ensures clock-outs happen reliably
 * even when the app is in the background.
 *
 * Flow:
 * 1. On geofence exit → schedule 3 silent notifications (at 1, 3, 5 minutes)
 * 2. Each notification triggers a quick GPS check
 * 3. If confidently inside → cancel pending exit
 * 4. If confidently outside at 5 min → confirm clock-out
 * 5. If uncertain → let fallback handle it (app foreground)
 */

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from './Database';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { trackingEvents } from '@/lib/events/trackingEvents';

// ============================================================================
// Constants
// ============================================================================

// Notification identifiers for cancellation
const VERIFICATION_NOTIFICATION_IDS = [
  'exit-verify-1',
  'exit-verify-2',
  'exit-verify-3',
];

// Check intervals (minutes after exit)
const CHECK_INTERVALS_MINUTES = [1, 3, 5];

// Storage key for verification state
const VERIFICATION_STATE_KEY = 'EXIT_VERIFICATION_STATE';

// GPS check timeout (milliseconds)
const GPS_TIMEOUT_MS = 5000;

// ============================================================================
// Types
// ============================================================================

export interface VerificationState {
  sessionId: string;
  locationId: string;
  geofenceCenter: { latitude: number; longitude: number };
  geofenceRadius: number;
  pendingExitTime: string; // ISO timestamp
  checkIndex: number; // Which check we're on (0, 1, 2)
}

export interface ScheduleVerificationParams {
  sessionId: string;
  locationId: string;
  geofenceCenter: { latitude: number; longitude: number };
  geofenceRadius: number;
  pendingExitTime: string;
}

type CancelReason = 'returned' | 'manual' | 'geofence-reentry';

// ============================================================================
// Distance Calculation
// ============================================================================

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ============================================================================
// State Management
// ============================================================================

async function getVerificationState(): Promise<VerificationState | null> {
  try {
    const stateJson = await SecureStore.getItemAsync(VERIFICATION_STATE_KEY);
    if (!stateJson) return null;
    return JSON.parse(stateJson);
  } catch (error) {
    console.error('[ExitVerification] Failed to get state:', error);
    return null;
  }
}

async function setVerificationState(state: VerificationState): Promise<void> {
  try {
    await SecureStore.setItemAsync(VERIFICATION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[ExitVerification] Failed to set state:', error);
  }
}

async function clearVerificationState(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(VERIFICATION_STATE_KEY);
  } catch (error) {
    console.error('[ExitVerification] Failed to clear state:', error);
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Schedule verification checks after a geofence exit
 */
export async function scheduleVerificationChecks(
  params: ScheduleVerificationParams
): Promise<void> {
  console.log('[ExitVerification] Scheduling verification checks for session:', params.sessionId);

  // Save state for when notifications fire
  const state: VerificationState = {
    ...params,
    checkIndex: 0,
  };
  await setVerificationState(state);

  // Schedule silent notifications at 1, 3, 5 minutes
  for (let i = 0; i < CHECK_INTERVALS_MINUTES.length; i++) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: VERIFICATION_NOTIFICATION_IDS[i],
        content: {
          // Silent notification - just triggers the handler
          title: '',
          body: '',
          data: { type: 'exit-verification', checkIndex: i },
          sound: undefined,
        },
        trigger: {
          seconds: CHECK_INTERVALS_MINUTES[i] * 60,
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });
      console.log(`[ExitVerification] Scheduled check ${i + 1} at ${CHECK_INTERVALS_MINUTES[i]} minutes`);
    } catch (error) {
      console.error(`[ExitVerification] Failed to schedule check ${i + 1}:`, error);
    }
  }
}

/**
 * Cancel all verification checks and clean up
 */
export async function cancelVerification(
  sessionId: string,
  reason: CancelReason
): Promise<void> {
  console.log(`[ExitVerification] Cancelling verification: ${reason}`);

  // Cancel all scheduled notifications
  for (const id of VERIFICATION_NOTIFICATION_IDS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      // Notification might not exist, that's OK
    }
  }

  // Clear state
  await clearVerificationState();

  // If user returned, cancel the pending exit in database
  if (reason === 'returned' || reason === 'geofence-reentry') {
    try {
      const db = await getDatabase();
      await db.cancelPendingExit(sessionId);
      trackingEvents.emit('tracking-changed');
    } catch (error) {
      console.error('[ExitVerification] Failed to cancel pending exit:', error);
    }
  }
}

/**
 * Handle a verification check triggered by a scheduled notification
 */
export async function handleVerificationCheck(checkIndex: number): Promise<void> {
  console.log(`[ExitVerification] Handling check ${checkIndex + 1}`);

  const state = await getVerificationState();
  if (!state) {
    console.log('[ExitVerification] No pending verification state');
    return;
  }

  // Quick GPS check
  let location: Location.LocationObject;
  try {
    location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: GPS_TIMEOUT_MS,
    });
  } catch (error) {
    console.error('[ExitVerification] GPS check failed:', error);
    // If GPS fails, continue to next check (don't clock out yet)
    return;
  }

  // Calculate distance from geofence center
  const distance = calculateDistance(
    location.coords.latitude,
    location.coords.longitude,
    state.geofenceCenter.latitude,
    state.geofenceCenter.longitude
  );

  // Confidence-based detection (accounts for GPS accuracy)
  const accuracy = location.coords.accuracy ?? 50;
  const radius = state.geofenceRadius;

  // Must be confident about location before taking action
  const isConfidentlyInside = distance + accuracy < radius;
  const isConfidentlyOutside = distance - accuracy > radius;
  const isUncertain = !isConfidentlyInside && !isConfidentlyOutside;

  console.log(
    `[ExitVerification] Check ${checkIndex + 1}: distance=${distance.toFixed(0)}m, accuracy=${accuracy.toFixed(0)}m, radius=${radius}m`
  );
  console.log(
    `[ExitVerification] → inside=${isConfidentlyInside}, outside=${isConfidentlyOutside}, uncertain=${isUncertain}`
  );

  if (isConfidentlyInside) {
    // User definitely returned - cancel pending exit
    console.log('[ExitVerification] User confidently inside geofence');
    await cancelVerification(state.sessionId, 'returned');
    return;
  }

  // Is this the final check (5 minutes)?
  const isFinalCheck = checkIndex === CHECK_INTERVALS_MINUTES.length - 1;

  if (isFinalCheck) {
    if (isConfidentlyOutside) {
      // Confirm clock-out - we're confident user is outside
      console.log('[ExitVerification] Final check - confidently outside, confirming clock-out');
      await confirmClockOut(state);
    } else {
      // Uncertain on final check - don't auto clock-out
      // Clear state and let fallback handle it (manual or app foreground)
      console.log('[ExitVerification] Final check - uncertain, skipping auto clock-out');
      await clearVerificationState();
      // Pending exit remains in database - will be processed on next app foreground
    }
  } else {
    // Not final check - update state for next check
    await setVerificationState({
      ...state,
      checkIndex: checkIndex + 1,
    });
  }
}

/**
 * Confirm clock-out after successful verification
 */
async function confirmClockOut(state: VerificationState): Promise<void> {
  try {
    const db = await getDatabase();

    // Confirm the pending exit in database
    await db.confirmPendingExit(state.sessionId);

    // Get session details for notification
    const session = await db.getSession(state.sessionId);
    const location = await db.getLocation(state.locationId);
    const locationName = location?.name ?? 'Work Location';
    const durationMinutes = session?.durationMinutes ?? 0;

    // Clear verification state
    await clearVerificationState();

    // Send clock-out notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Clocked Out',
        body: `Clocked out from ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
      },
      trigger: null, // Immediate
    });

    // Notify listeners (Calendar refresh)
    trackingEvents.emit('tracking-changed');

    console.log('[ExitVerification] Clock-out confirmed');
  } catch (error) {
    console.error('[ExitVerification] Failed to confirm clock-out:', error);
  }
}

/**
 * Check if there's an active verification in progress
 */
export async function hasActiveVerification(): Promise<boolean> {
  const state = await getVerificationState();
  return state !== null;
}

/**
 * Get the session ID of the active verification (if any)
 */
export async function getActiveVerificationSessionId(): Promise<string | null> {
  const state = await getVerificationState();
  return state?.sessionId ?? null;
}
