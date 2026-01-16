import { Database } from '../services/Database';
import { v4 as uuidv4 } from 'uuid';
import { UserLocation } from '../types';

// Helper function to create test locations
async function createTestLocation(
  db: Database,
  overrides: Partial<UserLocation> = {}
): Promise<UserLocation> {
  const location: UserLocation = {
    id: uuidv4(),
    name: 'Test Hospital',
    latitude: 37.7625,
    longitude: -122.4577,
    radiusMeters: 200,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await db.insertLocation(location);
  return location;
}

describe('Database', () => {
  let db: Database;

  beforeEach(async () => {
    // Use in-memory database for testing
    db = new Database(':memory:');
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Schema', () => {
    it('should create all tables', async () => {
      const tables = await db.getTables();
      expect(tables).toContain('user_locations');
      expect(tables).toContain('tracking_sessions');
      expect(tables).toContain('geofence_events');
      expect(tables).toContain('schema_version');
    });

    it('should have schema version 1', async () => {
      const version = await db.getSchemaVersion();
      expect(version).toBe(1);
    });
  });

  describe('UserLocations', () => {
    it('should insert a location', async () => {
      const location = {
        id: uuidv4(),
        name: 'Test Hospital',
        latitude: 37.7625,
        longitude: -122.4577,
        radiusMeters: 200,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insertLocation(location);
      const result = await db.getLocation(location.id);

      expect(result).toMatchObject({
        id: location.id,
        name: 'Test Hospital',
        latitude: 37.7625,
        longitude: -122.4577,
        radiusMeters: 200,
      });
    });

    it('should update a location', async () => {
      const location = await createTestLocation(db);

      // Wait 1ms to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 1));

      await db.updateLocation(location.id, { radiusMeters: 300 });
      const updated = await db.getLocation(location.id);

      expect(updated?.radiusMeters).toBe(300);
      expect(updated?.updatedAt).not.toBe(location.updatedAt);
    });

    it('should delete a location', async () => {
      const location = await createTestLocation(db);

      await db.deleteLocation(location.id);
      const result = await db.getLocation(location.id);

      expect(result).toBeNull();
    });

    it('should list all active locations', async () => {
      await createTestLocation(db, { name: 'Hospital 1', isActive: true });
      await createTestLocation(db, { name: 'Hospital 2', isActive: true });
      await createTestLocation(db, { name: 'Hospital 3', isActive: false });

      const active = await db.getActiveLocations();

      expect(active).toHaveLength(2);
      expect(active.map(l => l.name)).toEqual(['Hospital 1', 'Hospital 2']);
    });
  });

  describe('TrackingSessions', () => {
    it('should create a session on clock-in', async () => {
      const location = await createTestLocation(db);
      const clockIn = new Date().toISOString();

      const session = await db.clockIn(location.id, clockIn, 'geofence_auto');

      expect(session).toMatchObject({
        locationId: location.id,
        clockIn,
        clockOut: null,
        trackingMethod: 'geofence_auto',
      });
    });

    it('should update session on clock-out', async () => {
      const location = await createTestLocation(db);
      const clockIn = new Date('2025-01-15T08:00:00Z').toISOString();
      const session = await db.clockIn(location.id, clockIn, 'geofence_auto');

      // Wait 1ms to ensure operations complete
      await new Promise(resolve => setTimeout(resolve, 1));

      const clockOut = new Date('2025-01-15T16:30:00Z').toISOString();
      await db.clockOut(session.id, clockOut);

      const updated = await db.getSession(session.id);
      expect(updated?.clockOut).toBe(clockOut);
      expect(updated?.durationMinutes).toBe(510); // 8.5 hours = 510 min
    });

    it('should return active session for location', async () => {
      const location = await createTestLocation(db);
      const session = await db.clockIn(location.id, new Date().toISOString(), 'manual');

      const active = await db.getActiveSession(location.id);

      expect(active?.id).toBe(session.id);
      expect(active?.clockOut).toBeNull();
    });

    it('should return null if no active session', async () => {
      const location = await createTestLocation(db);

      const active = await db.getActiveSession(location.id);

      expect(active).toBeNull();
    });

    it('should get session history', async () => {
      const location = await createTestLocation(db);

      // Create 3 completed sessions
      for (let i = 0; i < 3; i++) {
        const clockIn = new Date(`2025-01-${10 + i}T08:00:00Z`).toISOString();
        const clockOut = new Date(`2025-01-${10 + i}T16:00:00Z`).toISOString();
        const session = await db.clockIn(location.id, clockIn, 'geofence_auto');
        await db.clockOut(session.id, clockOut);
      }

      const history = await db.getSessionHistory(location.id, 10);

      expect(history).toHaveLength(3);
      // Most recent first
      expect(history[0].clockIn).toContain('2025-01-12');
    });
  });

  describe('GeofenceEvents', () => {
    it('should log enter event', async () => {
      const location = await createTestLocation(db);
      const timestamp = new Date().toISOString();

      const event = await db.logGeofenceEvent({
        locationId: location.id,
        eventType: 'enter',
        timestamp,
        latitude: 37.7625,
        longitude: -122.4577,
        accuracy: 15,
        ignored: false,
        ignoreReason: null,
      });

      expect(event.eventType).toBe('enter');
      expect(event.latitude).toBe(37.7625);
    });

    it('should retrieve events for location', async () => {
      const location = await createTestLocation(db);

      await db.logGeofenceEvent({
        locationId: location.id,
        eventType: 'enter',
        timestamp: new Date().toISOString(),
        ignored: false,
        ignoreReason: null,
      });
      await db.logGeofenceEvent({
        locationId: location.id,
        eventType: 'exit',
        timestamp: new Date().toISOString(),
        ignored: false,
        ignoreReason: null,
      });

      const events = await db.getGeofenceEvents(location.id, 10);

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('exit'); // Most recent first
      expect(events[1].eventType).toBe('enter');
    });
  });

  describe('Error Handling', () => {
    it('should throw on duplicate location ID', async () => {
      const location = await createTestLocation(db);

      await expect(
        db.insertLocation({ ...location, name: 'Different Name' })
      ).rejects.toThrow();
    });

    it('should throw on invalid foreign key', async () => {
      await expect(
        db.clockIn('invalid-location-id', new Date().toISOString(), 'manual')
      ).rejects.toThrow();
    });
  });
});
