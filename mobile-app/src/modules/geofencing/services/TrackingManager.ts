import { Database } from './Database';
import { GeofenceEventData } from './GeofenceService';
import * as Notifications from 'expo-notifications';

export class TrackingManager {
  constructor(private db: Database) {}

  /**
   * Handle geofence enter event → auto clock-in
   */
  async handleGeofenceEnter(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Enter event:', event);

    // Check if already clocked in
    const activeSession = await this.db.getActiveSession(event.locationId);
    if (activeSession) {
      console.log('[TrackingManager] Already clocked in, ignoring enter event');
      return;
    }

    // Clock in
    const session = await this.db.clockIn(
      event.locationId,
      event.timestamp,
      'geofence_auto'
    );

    // Log event
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'enter',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
    });

    // Get location name for notification
    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Unknown Location';

    // Send notification
    await this.sendNotification(
      'Clocked In',
      `🟢 Clocked in at ${locationName}`,
      { sessionId: session.id }
    );
  }

  /**
   * Handle geofence exit event → auto clock-out
   */
  async handleGeofenceExit(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Exit event:', event);

    // Get active session
    const activeSession = await this.db.getActiveSession(event.locationId);
    if (!activeSession) {
      console.log('[TrackingManager] No active session, ignoring exit event');
      return;
    }

    // Clock out (immediate - no hysteresis for simplicity)
    await this.db.clockOut(activeSession.id, event.timestamp);

    // Log event
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'exit',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
    });

    // Get updated session with duration
    const completedSession = await this.db.getSession(activeSession.id);
    const hours = completedSession?.durationMinutes
      ? (completedSession.durationMinutes / 60).toFixed(1)
      : '0';

    // Get location name
    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Unknown Location';

    // Send notification
    await this.sendNotification(
      'Clocked Out',
      `Clocked out from ${locationName}. Worked ${hours} hours.`,
      { sessionId: activeSession.id }
    );
  }

  /**
   * Manual clock-in
   */
  async clockIn(locationId: string): Promise<void> {
    const activeSession = await this.db.getActiveSession(locationId);
    if (activeSession) {
      throw new Error('Already clocked in at this location');
    }

    const session = await this.db.clockIn(locationId, new Date().toISOString(), 'manual');

    // Get location name for notification
    const location = await this.db.getLocation(locationId);
    const locationName = location?.name ?? 'Unknown Location';

    await this.sendNotification(
      'Clocked In',
      `✋ Manually clocked in at ${locationName}`,
      { sessionId: session.id }
    );
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

    // Get updated session with duration
    const completedSession = await this.db.getSession(activeSession.id);
    const hours = completedSession?.durationMinutes
      ? (completedSession.durationMinutes / 60).toFixed(1)
      : '0';

    // Get location name
    const location = await this.db.getLocation(locationId);
    const locationName = location?.name ?? 'Unknown Location';

    await this.sendNotification(
      'Clocked Out',
      `✋ Manually clocked out from ${locationName}. Worked ${hours} hours.`,
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
