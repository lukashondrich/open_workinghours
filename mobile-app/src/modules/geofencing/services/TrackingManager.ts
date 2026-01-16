import { Database } from './Database';
import { GeofenceEventData, IgnoreReason } from '../types';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import * as Notifications from 'expo-notifications';
import { trackingEvents } from '@/lib/events/trackingEvents';

// ============================================================================
// Hysteresis Configuration
// ============================================================================

// Time to wait before confirming clock-out (minutes)
const EXIT_HYSTERESIS_MINUTES = 5;

// Ignore exit events with GPS accuracy worse than this (meters)
// Higher values = more lenient (good for indoor environments)
const GPS_ACCURACY_THRESHOLD = 100;

// Ignore exit if accuracy is this many times worse than check-in accuracy
// E.g., 3 = ignore if exit accuracy is 3x worse than check-in
const DEGRADATION_FACTOR = 3;

// Minimum session duration to keep (minutes)
// Sessions shorter than this are kept but marked as short (not deleted)
const MIN_SESSION_MINUTES = 5;

export class TrackingManager {
  constructor(private db: Database) {}

  /**
   * Handle geofence enter event → auto clock-in or cancel pending exit
   */
  async handleGeofenceEnter(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Enter event:', event);

    // Always log the event for telemetry
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'enter',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      ignored: false,
      ignoreReason: null,
    });

    // Check for pending exit to cancel (re-entered before hysteresis expired)
    const pendingSession = await this.db.getPendingExitSession(event.locationId);
    if (pendingSession) {
      console.log('[TrackingManager] Cancelling pending exit - user re-entered');
      await this.db.cancelPendingExit(pendingSession.id);

      const location = await this.db.getLocation(event.locationId);
      const locationName = location?.name ?? 'Work Location';

      await this.sendNotification(
        'Welcome back',
        `Clock-out cancelled at ${locationName} - you're still clocked in`,
        { sessionId: pendingSession.id }
      );

      // Process any other pending exits while we're here
      await this.processPendingExits();
      return;
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
      ignored: false,
      ignoreReason: null,
    });

    // Layer 3: Check for existing pending exit
    if (activeSession.state === 'pending_exit') {
      console.log('[TrackingManager] Pending exit already exists, ignoring duplicate exit');
      await this.processPendingExits();
      return;
    }

    // Layer 4: Create pending exit (start hysteresis countdown)
    console.log('[TrackingManager] Creating pending exit - will confirm in 5 minutes');
    await this.db.markPendingExit(
      activeSession.id,
      event.timestamp,
      event.accuracy ?? null
    );

    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Work Location';

    await this.sendNotification(
      'Leaving work area',
      `Will clock out from ${locationName} in ${EXIT_HYSTERESIS_MINUTES} minutes if you don't return`,
      { sessionId: activeSession.id, pendingExit: true }
    );

    // Process any expired pending exits
    await this.processPendingExits();
  }

  /**
   * Process pending exits that have exceeded the hysteresis period
   */
  async processPendingExits(): Promise<void> {
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
      });
    } catch (error) {
      console.error('[TrackingManager] Failed to send notification:', error);
    }
  }
}
