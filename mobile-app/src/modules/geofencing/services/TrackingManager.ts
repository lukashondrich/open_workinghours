import { Database } from './Database';
import { GeofenceEventData, IgnoreReason } from '../types';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { trackingEvents } from '@/lib/events/trackingEvents';
import * as ExitVerificationService from './ExitVerificationService';

// ============================================================================
// Hysteresis Configuration
// ============================================================================

// Time to wait before confirming clock-out (minutes)
const EXIT_HYSTERESIS_MINUTES = 5;

// GPS accuracy threshold for immediate clock-out (meters)
// If exit accuracy is better (lower) than this, clock out immediately without hysteresis
// If accuracy is worse or N/A, use hysteresis + verification
const IMMEDIATE_EXIT_ACCURACY_THRESHOLD = 50;

// Ignore exit events with GPS accuracy worse than this (meters)
// Higher values = more lenient (good for indoor environments)
const GPS_ACCURACY_THRESHOLD = 100;

// Ignore exit if accuracy is this many times worse than check-in accuracy
// E.g., 3 = ignore if exit accuracy is 3x worse than check-in
const DEGRADATION_FACTOR = 3;

// Minimum session duration to keep (minutes)
// Sessions shorter than this are kept but marked as short (not deleted)
const MIN_SESSION_MINUTES = 5;

// Event debouncing: Ignore events within this cooldown period (milliseconds)
// Prevents rapid oscillation when GPS bounces near geofence boundary
const EVENT_COOLDOWN_MS = 10000;

// Stale pending exit cleanup threshold (minutes)
// If verification doesn't run, pending exits older than this are auto-confirmed
// This is the "act on Stage 1 info" fallback
const STALE_PENDING_EXIT_MINUTES = 10;

export class TrackingManager {
  constructor(private db: Database) {}

  /**
   * Handle geofence enter event → auto clock-in or cancel pending exit
   */
  async handleGeofenceEnter(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Enter event:', event);

    // Debounce: Ignore events that happen too quickly after the last event
    const recentEvent = await this.db.getLastEventForLocation(event.locationId);
    if (recentEvent) {
      const elapsed = Date.now() - new Date(recentEvent.timestamp).getTime();
      if (elapsed < EVENT_COOLDOWN_MS) {
        console.log(`[TrackingManager] Debouncing enter - ${elapsed}ms since last event`);
        await this.db.logGeofenceEvent({
          locationId: event.locationId,
          eventType: 'enter',
          timestamp: event.timestamp,
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy,
          accuracySource: event.accuracySource,
          ignored: true,
          ignoreReason: 'debounced',
        });
        return;
      }
    }

    // Always log the event for telemetry
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'enter',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      accuracySource: event.accuracySource,
      ignored: false,
      ignoreReason: null,
    });

    // Check for pending exit - either cancel (user came back quickly) or confirm (user was gone)
    const pendingSession = await this.db.getPendingExitSession(event.locationId);
    if (pendingSession) {
      const pendingExitTime = pendingSession.pendingExitAt
        ? new Date(pendingSession.pendingExitAt).getTime()
        : 0;
      const elapsed = Date.now() - pendingExitTime;
      const hysteresisMs = EXIT_HYSTERESIS_MINUTES * 60 * 1000;

      if (elapsed > hysteresisMs) {
        // User was gone for longer than hysteresis - CONFIRM the exit (they really left)
        console.log(`[TrackingManager] Confirming expired pending exit (${Math.round(elapsed / 60000)} min old) - user returned after leaving`);
        await this.db.confirmPendingExit(pendingSession.id);
        await ExitVerificationService.cancelVerification(pendingSession.id, 'confirmed-on-reentry');

        // Notify of the completed session
        const completedSession = await this.db.getSession(pendingSession.id);
        const durationMinutes = completedSession?.durationMinutes ?? 0;
        const locationName = pendingSession.locationName ?? 'Work Location';

        trackingEvents.emit('tracking-changed');

        if (durationMinutes >= MIN_SESSION_MINUTES) {
          await this.sendNotification(
            'Clocked Out',
            `Clocked out from ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
            { sessionId: pendingSession.id }
          );
        }

        // Continue to clock-in logic below (don't return)
      } else {
        // User came back quickly - CANCEL the pending exit (false alarm)
        console.log(`[TrackingManager] Cancelling pending exit - user re-entered within ${Math.round(elapsed / 1000)}s`);
        await this.db.cancelPendingExit(pendingSession.id);
        await ExitVerificationService.cancelVerification(pendingSession.id, 'geofence-reentry');

        // Process any other pending exits while we're here
        await this.processPendingExits();
        return;
      }
    }

    // Check if already clocked in (active state)
    const activeSession = await this.db.getActiveSession(event.locationId);
    if (activeSession) {
      console.log('[TrackingManager] Already clocked in, ignoring enter event');
      // Process any pending exits while we're here
      await this.processPendingExits();
      return;
    }

    // Clock in with accuracy recorded
    const session = await this.db.clockIn(
      event.locationId,
      event.timestamp,
      'geofence_auto',
      event.accuracy ?? null
    );

    // Get location name for notification
    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Work Location';

    // Send notification
    await this.sendNotification(
      'Clocked In',
      `Clocked in at ${locationName}`,
      { sessionId: session.id }
    );

    // Notify listeners (e.g., Calendar) of tracking state change
    trackingEvents.emit('tracking-changed');

    // Process any pending exits
    await this.processPendingExits();
  }

  /**
   * Handle geofence exit event → create pending exit (with hysteresis)
   */
  async handleGeofenceExit(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Exit event:', event);

    // Debounce: Ignore events that happen too quickly after the last event
    const recentEvent = await this.db.getLastEventForLocation(event.locationId);
    if (recentEvent) {
      const elapsed = Date.now() - new Date(recentEvent.timestamp).getTime();
      if (elapsed < EVENT_COOLDOWN_MS) {
        console.log(`[TrackingManager] Debouncing exit - ${elapsed}ms since last event`);
        await this.db.logGeofenceEvent({
          locationId: event.locationId,
          eventType: 'exit',
          timestamp: event.timestamp,
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy,
          accuracySource: event.accuracySource,
          ignored: true,
          ignoreReason: 'debounced',
        });
        return;
      }
    }

    // Get active session (includes pending_exit state)
    const activeSession = await this.db.getActiveSession(event.locationId);
    if (!activeSession) {
      console.log('[TrackingManager] No active session, logging orphan exit event');
      await this.db.logGeofenceEvent({
        locationId: event.locationId,
        eventType: 'exit',
        timestamp: event.timestamp,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracy: event.accuracy,
        accuracySource: event.accuracySource,
        ignored: true,
        ignoreReason: 'no_session',
      });
      // Process any pending exits while we're here
      await this.processPendingExits();
      return;
    }

    // Layer 1: GPS accuracy filtering (absolute threshold)
    if (event.accuracy !== undefined && event.accuracy > GPS_ACCURACY_THRESHOLD) {
      console.log(`[TrackingManager] Ignoring exit - poor GPS accuracy: ${event.accuracy}m > ${GPS_ACCURACY_THRESHOLD}m threshold`);
      await this.logIgnoredExit(event, 'poor_accuracy');
      await this.processPendingExits();
      return;
    }

    // Layer 2: Signal degradation detection (relative to check-in)
    const checkinAccuracy = activeSession.checkinAccuracy;
    if (checkinAccuracy !== null && event.accuracy !== undefined) {
      const degradationRatio = event.accuracy / checkinAccuracy;
      if (degradationRatio > DEGRADATION_FACTOR) {
        console.log(
          `[TrackingManager] Ignoring exit - signal degradation: ${event.accuracy}m is ${degradationRatio.toFixed(1)}x worse than check-in accuracy ${checkinAccuracy}m`
        );
        await this.logIgnoredExit(event, 'signal_degradation');
        await this.processPendingExits();
        return;
      }
    }

    // Log valid exit event
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'exit',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      accuracySource: event.accuracySource,
      ignored: false,
      ignoreReason: null,
    });

    // Layer 3: Check for existing pending exit
    if (activeSession.state === 'pending_exit') {
      console.log('[TrackingManager] Pending exit already exists, ignoring duplicate exit');
      await this.processPendingExits();
      return;
    }

    // Get location details
    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Work Location';

    // Decision: Immediate clock-out vs. hysteresis based on GPS quality
    // Good GPS (< 50m) = high confidence, clock out immediately
    // Bad GPS (>= 50m) or N/A = use hysteresis + verification
    const hasGoodGps = event.accuracy !== undefined && event.accuracy < IMMEDIATE_EXIT_ACCURACY_THRESHOLD;

    if (hasGoodGps) {
      // IMMEDIATE CLOCK-OUT: Good GPS means high confidence user really left
      console.log(`[TrackingManager] Good GPS accuracy (${event.accuracy}m < ${IMMEDIATE_EXIT_ACCURACY_THRESHOLD}m) - immediate clock-out`);

      await this.db.clockOut(activeSession.id, event.timestamp);

      // Get updated session with duration
      const completedSession = await this.db.getSession(activeSession.id);
      const durationMinutes = completedSession?.durationMinutes ?? 0;

      // Notify listeners
      trackingEvents.emit('tracking-changed');

      // Send appropriate notification
      if (durationMinutes < MIN_SESSION_MINUTES) {
        console.log(`[TrackingManager] Short session (${durationMinutes} min) - keeping for review`);
        await this.sendNotification(
          'Short session recorded',
          `${durationMinutes} min session at ${locationName} saved - you can adjust it in the calendar`,
          { sessionId: activeSession.id, shortSession: true }
        );
      } else {
        await this.sendNotification(
          'Clocked Out',
          `Clocked out from ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
          { sessionId: activeSession.id }
        );
      }
    } else {
      // HYSTERESIS PATH: Bad GPS or N/A, use verification to confirm
      console.log(`[TrackingManager] GPS accuracy uncertain (${event.accuracy ?? 'N/A'}m) - using hysteresis + verification`);

      await this.db.markPendingExit(
        activeSession.id,
        event.timestamp,
        event.accuracy ?? null
      );

      // Determine geofence center coordinates
      const centerLat = location?.latitude ?? event.latitude;
      const centerLon = location?.longitude ?? event.longitude;

      // Schedule verification checks (if they run, great; if not, fallback will handle it)
      if (centerLat !== undefined && centerLon !== undefined) {
        await ExitVerificationService.scheduleVerificationChecks({
          sessionId: activeSession.id,
          locationId: event.locationId,
          geofenceCenter: {
            latitude: centerLat,
            longitude: centerLon,
          },
          geofenceRadius: location?.radiusMeters ?? 100,
          pendingExitTime: event.timestamp,
        });
      } else {
        console.warn('[TrackingManager] No coordinates available for verification - relying on fallback');
      }
    }

    // Process any expired pending exits
    await this.processPendingExits();
  }

  /**
   * Process pending exits that have exceeded the hysteresis period
   */
  async processPendingExits(): Promise<void> {
    // First, clean up any stale pending exits (fallback if verification didn't run)
    // This ensures we "act on Stage 1 info" - if we got an exit event but verification
    // failed to run, we still clock out after STALE_PENDING_EXIT_MINUTES
    const staleHours = STALE_PENDING_EXIT_MINUTES / 60;
    await this.db.confirmStalePendingExits(staleHours);

    const expiredPending = await this.db.getExpiredPendingExits(EXIT_HYSTERESIS_MINUTES);

    for (const session of expiredPending) {
      console.log(`[TrackingManager] Confirming pending exit for session ${session.id}`);

      // Confirm the clock-out
      await this.db.confirmPendingExit(session.id);

      // Get updated session to check duration
      const completedSession = await this.db.getSession(session.id);
      const durationMinutes = completedSession?.durationMinutes ?? 0;
      const locationName = session.locationName ?? 'Work Location';

      // Don't delete short sessions - keep them visible for manual adjustment
      if (durationMinutes < MIN_SESSION_MINUTES) {
        console.log(`[TrackingManager] Short session (${durationMinutes} min) - keeping for review`);
        await this.sendNotification(
          'Short session recorded',
          `${durationMinutes} min session at ${locationName} saved - you can adjust it in the calendar`,
          { sessionId: session.id, shortSession: true }
        );
      } else {
        await this.sendNotification(
          'Clocked Out',
          `Clocked out from ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
          { sessionId: session.id }
        );
      }

      // Notify listeners (e.g., Calendar) of tracking state change
      trackingEvents.emit('tracking-changed');
    }
  }

  /**
   * Manual clock-in
   */
  async clockIn(locationId: string): Promise<void> {
    const activeSession = await this.db.getActiveSession(locationId);
    if (activeSession) {
      throw new Error('Already clocked in at this location');
    }

    const session = await this.db.clockIn(locationId, new Date().toISOString(), 'manual', null);

    // Get location name for notification
    const location = await this.db.getLocation(locationId);
    const locationName = location?.name ?? 'Work Location';

    await this.sendNotification(
      'Clocked In',
      `Manually clocked in at ${locationName}`,
      { sessionId: session.id }
    );

    // Notify listeners (e.g., Calendar) of tracking state change
    trackingEvents.emit('tracking-changed');
  }

  /**
   * Manual clock-out
   */
  async clockOut(locationId: string): Promise<void> {
    const activeSession = await this.db.getActiveSession(locationId);
    if (!activeSession) {
      throw new Error('No active session at this location');
    }

    // Cancel any pending verification (user is manually clocking out)
    await ExitVerificationService.cancelVerification(activeSession.id, 'manual');

    await this.db.clockOut(activeSession.id, new Date().toISOString());

    // Notify listeners (e.g., Calendar) of tracking state change
    trackingEvents.emit('tracking-changed');

    // Get updated session with duration
    const completedSession = await this.db.getSession(activeSession.id);
    const durationMinutes = completedSession?.durationMinutes ?? 0;

    // Get location name
    const location = await this.db.getLocation(locationId);
    const locationName = location?.name ?? 'Work Location';

    // Don't delete short sessions - keep them visible for manual adjustment
    if (durationMinutes < MIN_SESSION_MINUTES) {
      console.log(`[TrackingManager] Short manual session (${durationMinutes} min) - keeping for review`);
      await this.sendNotification(
        'Short session recorded',
        `${durationMinutes} min session at ${locationName} saved - you can adjust it in the calendar`,
        { sessionId: activeSession.id, shortSession: true }
      );
      return;
    }

    await this.sendNotification(
      'Clocked Out',
      `Manually clocked out from ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
      { sessionId: activeSession.id }
    );
  }

  /**
   * Get active session for a location
   */
  async getActiveSession(locationId: string) {
    return await this.db.getActiveSession(locationId);
  }

  /**
   * Get tracking history
   */
  async getHistory(locationId: string, limit: number = 50) {
    return await this.db.getSessionHistory(locationId, limit);
  }

  /**
   * Helper: Log an ignored exit event
   */
  private async logIgnoredExit(event: GeofenceEventData, reason: IgnoreReason): Promise<void> {
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'exit',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      accuracySource: event.accuracySource,
      ignored: true,
      ignoreReason: reason,
    });
  }

  /**
   * Send push notification
   */
  private async sendNotification(
    title: string,
    body: string,
    data: any = {}
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: null, // Send immediately
        ...(Platform.OS === 'android' && { channelId: 'alerts' }),
      });
    } catch (error) {
      console.error('[TrackingManager] Failed to send notification:', error);
    }
  }
}
