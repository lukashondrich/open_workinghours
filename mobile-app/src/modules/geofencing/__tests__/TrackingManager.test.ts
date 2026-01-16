import { TrackingManager } from '../services/TrackingManager';
import { Database } from '../services/Database';
import { GeofenceEventData } from '../types';
import * as Notifications from 'expo-notifications';
import { v4 as uuidv4 } from 'uuid';

jest.mock('expo-notifications');

describe('TrackingManager', () => {
  let db: Database;
  let manager: TrackingManager;
  let testLocationId: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initialize();
    manager = new TrackingManager(db);

    // Create a test location
    testLocationId = uuidv4();
    await db.insertLocation({
      id: testLocationId,
      name: 'Test Hospital',
      latitude: 37.7625,
      longitude: -122.4577,
      radiusMeters: 200,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Geofence Enter Events', () => {
    it('should clock in on geofence enter', async () => {
      const event: GeofenceEventData = {
        eventType: 'enter',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
        latitude: 37.7625,
        longitude: -122.4577,
      };

      await manager.handleGeofenceEnter(event);

      const session = await db.getActiveSession(testLocationId);
      expect(session).not.toBeNull();
      expect(session?.trackingMethod).toBe('geofence_auto');
      expect(session?.clockOut).toBeNull();
    });

    it('should ignore enter if already clocked in', async () => {
      // First clock in
      await db.clockIn(testLocationId, new Date().toISOString(), 'manual');

      const event: GeofenceEventData = {
        eventType: 'enter',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };

      await manager.handleGeofenceEnter(event);

      // Should still have only one session
      const sessions = await db.getSessionHistory(testLocationId, 10);
      expect(sessions).toHaveLength(1);
    });

    it('should send notification on clock-in', async () => {
      const event: GeofenceEventData = {
        eventType: 'enter',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };

      await manager.handleGeofenceEnter(event);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Clocked In',
          body: expect.stringContaining('Test Hospital'),
          data: expect.any(Object),
        },
        trigger: null,
      });
    });

    it('should log geofence event', async () => {
      const event: GeofenceEventData = {
        eventType: 'enter',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
        latitude: 37.7625,
        longitude: -122.4577,
      };

      await manager.handleGeofenceEnter(event);

      const events = await db.getGeofenceEvents(testLocationId, 10);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('enter');
    });
  });

  describe('Geofence Exit Events', () => {
    it('should create pending exit on geofence exit (hysteresis)', async () => {
      // First clock in (use current time so pending exit doesn't expire)
      const clockInTime = new Date().toISOString();
      await db.clockIn(testLocationId, clockInTime, 'geofence_auto');

      // Then exit (use current time - not in the past, so it won't immediately expire)
      const exitTime = new Date().toISOString();
      const event: GeofenceEventData = {
        eventType: 'exit',
        locationId: testLocationId,
        timestamp: exitTime,
      };

      await manager.handleGeofenceExit(event);

      // Session should still be active but in pending_exit state
      const session = await db.getActiveSession(testLocationId);
      expect(session).not.toBeNull();
      expect(session?.state).toBe('pending_exit');
      expect(session?.pendingExitAt).toBe(exitTime);
    });

    it('should ignore exit if not clocked in', async () => {
      const event: GeofenceEventData = {
        eventType: 'exit',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      await manager.handleGeofenceExit(event);

      const sessions = await db.getSessionHistory(testLocationId, 10);
      expect(sessions).toHaveLength(0);
    });

    it('should send leaving notification on exit (hysteresis)', async () => {
      // First clock in
      await db.clockIn(testLocationId, new Date().toISOString(), 'geofence_auto');

      const event: GeofenceEventData = {
        eventType: 'exit',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };

      await manager.handleGeofenceExit(event);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Leaving work area',
          body: expect.stringContaining('5 minutes'),
          data: expect.any(Object),
        },
        trigger: null,
      });
    });

    it('should log geofence event', async () => {
      // First clock in
      await db.clockIn(testLocationId, new Date().toISOString(), 'geofence_auto');

      const event: GeofenceEventData = {
        eventType: 'exit',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
        latitude: 37.7625,
        longitude: -122.4577,
      };

      await manager.handleGeofenceExit(event);

      const events = await db.getGeofenceEvents(testLocationId, 10);
      expect(events.some(e => e.eventType === 'exit')).toBe(true);
    });

    it('should cancel pending exit on re-enter', async () => {
      // Clock in
      await db.clockIn(testLocationId, new Date().toISOString(), 'geofence_auto');

      // Exit (creates pending exit)
      const exitEvent: GeofenceEventData = {
        eventType: 'exit',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };
      await manager.handleGeofenceExit(exitEvent);

      // Re-enter
      const enterEvent: GeofenceEventData = {
        eventType: 'enter',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };
      await manager.handleGeofenceEnter(enterEvent);

      // Session should be back to active state
      const session = await db.getActiveSession(testLocationId);
      expect(session).not.toBeNull();
      expect(session?.state).toBe('active');
      expect(session?.pendingExitAt).toBeNull();
    });
  });

  describe('Manual Clock In/Out', () => {
    it('should allow manual clock-in', async () => {
      await manager.clockIn(testLocationId);

      const session = await db.getActiveSession(testLocationId);
      expect(session).not.toBeNull();
      expect(session?.trackingMethod).toBe('manual');
    });

    it('should throw if already clocked in', async () => {
      await db.clockIn(testLocationId, new Date().toISOString(), 'manual');

      await expect(manager.clockIn(testLocationId)).rejects.toThrow(
        'Already clocked in'
      );
    });

    it('should allow manual clock-out', async () => {
      await db.clockIn(testLocationId, new Date().toISOString(), 'manual');

      await manager.clockOut(testLocationId);

      const session = await db.getActiveSession(testLocationId);
      expect(session).toBeNull();
    });

    it('should throw if not clocked in', async () => {
      await expect(manager.clockOut(testLocationId)).rejects.toThrow(
        'No active session'
      );
    });

    it('should send notification on manual clock-in', async () => {
      await manager.clockIn(testLocationId);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Clocked In',
          body: expect.stringContaining('Manually'),
          data: expect.any(Object),
        },
        trigger: null,
      });
    });

    it('should send notification on manual clock-out', async () => {
      // Use a time far in the past to ensure session is > 5 minutes
      const clockInTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      await db.clockIn(testLocationId, clockInTime, 'manual');

      await manager.clockOut(testLocationId);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Clocked Out',
          body: expect.stringContaining('Manually'),
          data: expect.any(Object),
        },
        trigger: null,
      });
    });

    it('should keep short sessions (not delete them)', async () => {
      // Clock in just now (session will be < 5 minutes)
      await db.clockIn(testLocationId, new Date().toISOString(), 'manual');

      await manager.clockOut(testLocationId);

      // Session should still exist (not deleted)
      const history = await db.getSessionHistory(testLocationId, 10);
      expect(history).toHaveLength(1);

      // Notification should mention short session
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Short session recorded',
          body: expect.stringContaining('saved'),
          data: expect.any(Object),
        },
        trigger: null,
      });
    });
  });

  describe('Query Methods', () => {
    it('should get active session', async () => {
      await db.clockIn(testLocationId, new Date().toISOString(), 'manual');

      const session = await manager.getActiveSession(testLocationId);

      expect(session).not.toBeNull();
      expect(session?.locationId).toBe(testLocationId);
    });

    it('should get tracking history', async () => {
      // Create 3 sessions
      for (let i = 0; i < 3; i++) {
        const clockIn = new Date(`2025-01-${10 + i}T08:00:00Z`).toISOString();
        const clockOut = new Date(`2025-01-${10 + i}T16:00:00Z`).toISOString();
        const session = await db.clockIn(testLocationId, clockIn, 'manual');
        await db.clockOut(session.id, clockOut);
      }

      const history = await manager.getHistory(testLocationId);

      expect(history).toHaveLength(3);
    });

    it('should respect history limit', async () => {
      // Create 5 sessions
      for (let i = 0; i < 5; i++) {
        const clockIn = new Date(`2025-01-${10 + i}T08:00:00Z`).toISOString();
        const clockOut = new Date(`2025-01-${10 + i}T16:00:00Z`).toISOString();
        const session = await db.clockIn(testLocationId, clockIn, 'manual');
        await db.clockOut(session.id, clockOut);
      }

      const history = await manager.getHistory(testLocationId, 2);

      expect(history).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle notification failure gracefully', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Notification failed')
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const event: GeofenceEventData = {
        eventType: 'enter',
        locationId: testLocationId,
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      await manager.handleGeofenceEnter(event);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
