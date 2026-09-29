/**
 * Exit verification runs from a notification handler, OUTSIDE the geofence /
 * keepalive call paths. Its session writes must still respect the session
 * rules: they go through the shared queue and re-read the row first.
 */
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { v4 as uuidv4 } from 'uuid';

import * as DatabaseModule from '../services/Database';
import { Database } from '../services/Database';
import { TrackingManagerAndroid as TrackingManager } from '../services/TrackingManagerAndroid';
import * as ExitVerificationService from '../services/ExitVerificationService';

// In-memory SecureStore so scheduleVerificationChecks/handleVerificationCheck share state.
const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStore.delete(key);
    return Promise.resolve();
  }),
}));

const CENTER = { lat: 50.6, lon: 8.8 };
const RADIUS_M = 200;
const OUTSIDE = { lat: 50.61, lon: 8.8 }; // ~1.1 km north
const MIN = 60 * 1000;
const FINAL_CHECK = 2; // index of the 5-minute check

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function fix(lat: number, lon: number, accuracy = 15) {
  return {
    coords: { latitude: lat, longitude: lon, accuracy, altitude: 0, altitudeAccuracy: 0, heading: 0, speed: 0 },
    timestamp: Date.now(),
  };
}

describe('ExitVerificationService — session writes obey the session rules', () => {
  let db: Database;
  let manager: TrackingManager;
  let locationId: string;

  beforeEach(async () => {
    mockSecureStore.clear();
    db = new Database(':memory:');
    await db.initialize();
    manager = new TrackingManager(db);

    locationId = uuidv4();
    await db.insertLocation({
      id: locationId,
      name: 'Wohnzimmer',
      latitude: CENTER.lat,
      longitude: CENTER.lon,
      radiusMeters: RADIUS_M,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    jest.spyOn(DatabaseModule, 'getDatabase').mockResolvedValue(db);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await db.close();
    jest.restoreAllMocks();
  });

  async function startPendingExit(): Promise<string> {
    const session = await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
    // Exit without accuracy → hysteresis path → schedules verification checks.
    // Dated 6 min ago: the final (5-min) check runs after the hysteresis.
    await manager.handleGeofenceExit({
      eventType: 'exit',
      locationId,
      timestamp: ago(6 * MIN),
      latitude: OUTSIDE.lat,
      longitude: OUTSIDE.lon,
    });
    expect((await db.getSession(session.id))?.state).toBe('pending_exit');
    return session.id;
  }

  it('final check confidently outside → confirms the clock-out at the exit time', async () => {
    const sessionId = await startPendingExit();
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(fix(OUTSIDE.lat, OUTSIDE.lon));

    await ExitVerificationService.handleVerificationCheck(FINAL_CHECK);

    const session = await db.getSession(sessionId);
    expect(session?.state).toBe('completed');
    expect(session?.clockOut).toBe(session?.pendingExitAt);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ title: 'Clocked Out' }) })
    );
  });

  it('check confidently inside → restores the session to active', async () => {
    const sessionId = await startPendingExit();
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(fix(CENTER.lat, CENTER.lon));

    await ExitVerificationService.handleVerificationCheck(0);

    const session = await db.getSession(sessionId);
    expect(session?.state).toBe('active');
    expect(session?.clockOut).toBeNull();
    expect(await ExitVerificationService.hasActiveVerification()).toBe(false);
  });

  it('does not clock out a session that a queued job already resolved (re-read inside the queue)', async () => {
    const sessionId = await startPendingExit();
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(fix(OUTSIDE.lat, OUTSIDE.lon));

    // The row gets resolved by another write WITHOUT the verification state being
    // cleared (e.g. a calendar edit) — the check must notice on its queued re-read.
    const editedClockOut = ago(1 * MIN);
    await db.clockOut(sessionId, editedClockOut);
    expect(await ExitVerificationService.hasActiveVerification()).toBe(true);

    await ExitVerificationService.handleVerificationCheck(FINAL_CHECK);

    const session = await db.getSession(sessionId);
    expect(session?.state).toBe('completed');
    // The edited clock-out time stands; verification did not overwrite it with the exit time.
    expect(session?.clockOut).toBe(editedClockOut);
    expect(await ExitVerificationService.hasActiveVerification()).toBe(false);
  });

  it('cancelling verification for session A leaves session B\'s verification alone', async () => {
    const sessionId = await startPendingExit(); // B owns the verification slot

    await ExitVerificationService.cancelVerification('some-other-session', 'capped');

    expect(await ExitVerificationService.getActiveVerificationSessionId()).toBe(sessionId);
  });

  it('a non-final check does not resurrect a verification that a queued job cleared', async () => {
    const sessionId = await startPendingExit();
    (Location.getCurrentPositionAsync as jest.Mock).mockImplementation(async () => {
      // While the GPS fetch is in flight, the user clocks out manually.
      await manager.clockOut(locationId);
      return fix(OUTSIDE.lat, OUTSIDE.lon, 200); // uncertain → non-final path would bump checkIndex
    });

    await ExitVerificationService.handleVerificationCheck(0);

    expect(await ExitVerificationService.hasActiveVerification()).toBe(false);
    expect((await db.getSession(sessionId))?.state).toBe('completed');
  });

  it('never closes a manual session even with a stale pending_exit row (rule 1)', async () => {
    const session = await db.clockIn(locationId, ago(60 * MIN), 'manual');
    // Legacy row: a manual session left in pending_exit by an older build.
    const left = ago(6 * MIN);
    await db.markPendingExit(session.id, left, null);
    await ExitVerificationService.scheduleVerificationChecks({
      sessionId: session.id,
      locationId,
      geofenceCenter: { latitude: CENTER.lat, longitude: CENTER.lon },
      geofenceRadius: RADIUS_M,
      pendingExitTime: left,
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(fix(OUTSIDE.lat, OUTSIDE.lon));

    await ExitVerificationService.handleVerificationCheck(FINAL_CHECK);

    const restored = await db.getSession(session.id);
    expect(restored?.state).toBe('active');
    expect(restored?.clockOut).toBeNull();
  });

  it('verification confirm and a concurrent re-entry event serialize to one consistent outcome', async () => {
    const sessionId = await startPendingExit();
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(fix(OUTSIDE.lat, OUTSIDE.lon));

    await Promise.all([
      ExitVerificationService.handleVerificationCheck(FINAL_CHECK),
      manager.handleGeofenceEnter({
        eventType: 'enter',
        locationId,
        timestamp: new Date().toISOString(),
        latitude: CENTER.lat,
        longitude: CENTER.lon,
        accuracy: 15,
        accuracySource: 'event',
      }),
    ]);

    // Deterministic: the enter is queued first (the verification path awaits
    // SecureStore + GPS before it queues), so the re-entry cancels the pending
    // exit and the verification then finds nothing pending.
    const history = await db.getSessionHistory(locationId, 10);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(sessionId);
    expect(history[0].state).toBe('active');
    expect(history[0].pendingExitAt ?? null).toBeNull();
    expect(await ExitVerificationService.hasActiveVerification()).toBe(false);
  });
});
