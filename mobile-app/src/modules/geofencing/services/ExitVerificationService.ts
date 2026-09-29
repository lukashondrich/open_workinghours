/**
 * Exit Verification Service
 *
 * Handles verification of geofence exits using scheduled notifications
 * and discrete GPS checks. This ensures clock-outs happen reliably
 * even when the app is in the background.
 *
 * Flow:
 * 1. On geofence exit → schedule 3 background-check notifications (at 1, 3, 5 minutes)
 * 2. Each notification triggers a quick GPS check
 * 3. If confidently inside → cancel pending exit
 * 4. If confidently outside at 5 min → confirm clock-out
 * 5. If uncertain → leave the pending exit to the expiry pass (rule 5: confirmed only
 *    with positive 'outside' evidence, otherwise cancelled)
 */

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getDatabase } from './Database';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { trackingEvents } from '@/lib/events/trackingEvents';
import { serialized } from './SessionQueue';
import { classifyFix } from './geo';

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
  /** 'android': the check's fix is handed to TrackingManagerAndroid.handleFix and
   *  decided there. Absent (iOS core): this service decides itself (shipped logic). */
  core?: 'android';
}

export interface ScheduleVerificationParams {
  sessionId: string;
  locationId: string;
  geofenceCenter: { latitude: number; longitude: number };
  geofenceRadius: number;
  pendingExitTime: string;
  core?: 'android';
}

type CancelReason =
  | 'returned'
  | 'manual'
  | 'manual-restore'
  | 'capped'
  | 'no-evidence'
  | 'expired'
  | 'geofence-reentry'
  | 'confirmed-on-reentry';

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

  // Schedule lightweight verification notifications at 1, 3, 5 minutes.
  // On Android these can still appear in the shade, so keep content explicit.
  for (let i = 0; i < CHECK_INTERVALS_MINUTES.length; i++) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: VERIFICATION_NOTIFICATION_IDS[i],
        content: {
          title: 'Open Working Hours',
          body: 'Checking location in background...',
          data: { type: 'exit-verification', checkIndex: i },
          sound: undefined,
        },
        trigger: {
          seconds: CHECK_INTERVALS_MINUTES[i] * 60,
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
        ...(Platform.OS === 'android' && { channelId: 'tracking' }),
      });
      console.log(`[ExitVerification] Scheduled check ${i + 1} at ${CHECK_INTERVALS_MINUTES[i]} minutes`);
    } catch (error) {
      console.error(`[ExitVerification] Failed to schedule check ${i + 1}:`, error);
    }
  }
}

/**
 * Cancel all verification checks and clean up (notifications + stored state).
 *
 * This never touches the session row. Callers inside the session queue
 * (TrackingManager) already own that write; the verification-check path
 * ('returned') does its own queued write in `restorePendingSession`.
 */
export async function cancelVerification(
  sessionId: string,
  reason: CancelReason
): Promise<void> {
  // The verification slot (notifications + stored state) is global; only the
  // session that owns it may cancel it, or capping/restoring session A would
  // kill session B's in-flight verification.
  const owner = await getVerificationState();
  if (owner && owner.sessionId !== sessionId) {
    console.log(`[ExitVerification] Not cancelling: verification belongs to ${owner.sessionId}, not ${sessionId} (${reason})`);
    return;
  }
  console.log(`[ExitVerification] Cancelling verification for ${sessionId}: ${reason}`);

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
}

/**
 * User is confidently back inside: restore the session to 'active'.
 * Runs in the session queue; re-checks the row because a queued job may have
 * already resolved it (manual clock-out, expired hysteresis, re-entry event).
 */
async function restorePendingSession(sessionId: string, pendingExitTime?: string): Promise<void> {
  await serialized(async () => {
    try {
      const db = await getDatabase();
      const session = await db.getSession(sessionId);
      if (!session || session.state !== 'pending_exit') {
        console.log('[ExitVerification] Session no longer pending - nothing to restore');
        return;
      }
      if (pendingExitTime !== undefined && session.pendingExitAt !== pendingExitTime) {
        console.log('[ExitVerification] Session is pending for a later exit - nothing to restore');
        return;
      }
      await db.cancelPendingExit(sessionId);
      trackingEvents.emit('tracking-changed');
    } catch (error) {
      console.error('[ExitVerification] Failed to cancel pending exit:', error);
    }
  });
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

  if (state.core === 'android') {
    // Android: one decision function for every fix (TrackingManagerAndroid rule 5).
    // Lazy require: the core imports this module.
    const { TrackingManagerAndroid } = require('./TrackingManagerAndroid') as typeof import('./TrackingManagerAndroid');
    const db = await getDatabase();
    await new TrackingManagerAndroid(db).handleFix(
      state.locationId,
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date(location.timestamp || Date.now()).toISOString(),
      },
      'verification'
    );
    const isFinal = checkIndex === CHECK_INTERVALS_MINUTES.length - 1;
    const current = await getVerificationState();
    if (current && current.sessionId === state.sessionId && current.pendingExitTime === state.pendingExitTime) {
      if (isFinal) await clearVerificationState();
      else await setVerificationState({ ...state, checkIndex: checkIndex + 1 });
    }
    return;
  }

  // Same geometry as every other fix judgement (an N/A accuracy is 'uncertain')
  const fixClass = classifyFix(
    { latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy },
    { latitude: state.geofenceCenter.latitude, longitude: state.geofenceCenter.longitude, radiusMeters: state.geofenceRadius }
  );
  const isConfidentlyInside = fixClass === 'inside';
  const isConfidentlyOutside = fixClass === 'outside';

  console.log(
    `[ExitVerification] Check ${checkIndex + 1}: ${fixClass} (accuracy ${location.coords.accuracy ?? 'N/A'}m, radius ${state.geofenceRadius}m)`
  );

  if (isConfidentlyInside) {
    // User definitely returned - cancel pending exit
    console.log('[ExitVerification] User confidently inside geofence');
    await cancelVerification(state.sessionId, 'returned');
    await restorePendingSession(state.sessionId, state.pendingExitTime);
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
      // Uncertain on the final check: no clock-out from here. The pending exit
      // stays; the next processing pass decides by its evidence (rule 5): it
      // confirms if some fix meanwhile proved "outside", otherwise it cancels.
      console.log('[ExitVerification] Final check - uncertain, leaving the pending exit to the expiry pass');
      await clearVerificationState();
    }
  } else {
    // An early check that is confidently outside is evidence the user left —
    // record it on the pending exit now, in case the final check never runs.
    if (isConfidentlyOutside) {
      await serialized(async () => {
        const db = await getDatabase();
        await db.upgradePendingExitEvidence(state.sessionId, location.coords.accuracy ?? null);
      });
    }
    // Not final check - update state for next check, unless a queued job
    // (manual clock-out, re-entry) already cleared or replaced it meanwhile —
    // re-writing would resurrect a dead verification.
    const current = await getVerificationState();
    if (current && current.sessionId === state.sessionId) {
      await setVerificationState({
        ...state,
        checkIndex: checkIndex + 1,
      });
    }
  }
}

/**
 * Confirm clock-out after successful verification.
 *
 * Runs in the session queue and re-reads the row first: by the time the 5-min
 * notification fires, a queued job may already have resolved the session
 * (manual clock-out, re-entry event, stale-exit cleanup), and a manual session
 * must never be closed by a location check (session rule 1).
 */
async function confirmClockOut(state: VerificationState): Promise<void> {
  await serialized(() => confirmClockOutImpl(state));
}

async function confirmClockOutImpl(state: VerificationState): Promise<void> {
  try {
    const db = await getDatabase();

    const current = await db.getSession(state.sessionId);
    if (!current || current.state !== 'pending_exit') {
      console.log('[ExitVerification] Session no longer pending - skipping clock-out confirmation');
      await clearVerificationState();
      return;
    }
    if (current.pendingExitAt !== state.pendingExitTime) {
      // The row is pending for a LATER exit than the one these checks were
      // scheduled for (exit → re-entry → exit again): this check is stale.
      console.log('[ExitVerification] Verification belongs to an earlier pending exit - skipping');
      return;
    }
    if (current.trackingMethod === 'manual') {
      console.log('[ExitVerification] Manual session - restoring instead of clocking out');
      await db.cancelPendingExit(state.sessionId);
      await clearVerificationState();
      trackingEvents.emit('tracking-changed');
      return;
    }

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
      ...(Platform.OS === 'android' && { channelId: 'alerts' }),
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
