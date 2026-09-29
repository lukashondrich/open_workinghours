import * as Location from 'expo-location';

import * as DatabaseModule from '../services/Database';
import { Database } from '../services/Database';
import {
  handleKeepaliveTaskPayload,
  __resetKeepaliveStateForTests,
} from '../services/KeepaliveHealthCheckService';
import { v4 as uuidv4 } from 'uuid';

jest.mock('expo-notifications');

// Geofence center + radius for the test workplace.
const CENTER = { lat: 37.7625, lon: -122.4577 };
const RADIUS_M = 200;
// ~1.1 km north — confidently outside the 200 m geofence.
const OUTSIDE = { lat: 37.7725, lon: -122.4577 };

function ping(
  lat: number,
  lon: number,
  accuracy: number,
  timestampMs: number
): Location.LocationObject {
  return {
    coords: {
      latitude: lat,
      longitude: lon,
      accuracy,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      speed: 0,
    },
    timestamp: timestampMs,
  };
}

// Timestamps are anchored a few hours before the real clock: several DB queries
// compare against Date.now() (hysteresis expiry, the 24 h session cap), so
// absolute dates far in the past would be closed immediately.
const BASE = Date.now() - 6 * 60 * 60 * 1000;
function at(hour: number, minute: number): number {
  return BASE + (hour * 60 + minute) * 60 * 1000;
}

describe('KeepaliveHealthCheckService — batch timestamp reconstruction', () => {
  let db: Database;
  let locationId: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initialize();

    locationId = uuidv4();
    await db.insertLocation({
      id: locationId,
      name: 'Test Hospital',
      latitude: CENTER.lat,
      longitude: CENTER.lon,
      radiusMeters: RADIUS_M,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    jest.spyOn(DatabaseModule, 'getDatabase').mockResolvedValue(db);
    __resetKeepaliveStateForTests();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await db.close();
    jest.restoreAllMocks();
  });

  it('clocks in at the FIRST inside ping in a batch, not the latest/delivery time', async () => {
    const tOutside = at(1, 0); // 08:00 outside
    const tEnter = at(1, 5); // 08:05 first inside (true entry)
    const tLatest = at(1, 25); // 08:25 still inside (delivery)

    // A delayed/batched delivery: user was outside, returned at 08:05, and the whole
    // batch is only flushed at 08:25 when the app wakes.
    await handleKeepaliveTaskPayload({
      locations: [
        ping(OUTSIDE.lat, OUTSIDE.lon, 20, tOutside),
        ping(CENTER.lat, CENTER.lon, 20, tEnter),
        ping(CENTER.lat, CENTER.lon, 20, tLatest),
      ],
    });

    const session = await db.getActiveSession(locationId);
    expect(session).not.toBeNull();
    // The clock-in must be the true entry time (08:05), NOT the latest ping (08:25)
    // nor wall-clock "now".
    expect(session?.clockIn).toBe(new Date(tEnter).toISOString());
  });

  it('processes the batch out of order safely (sorts by timestamp)', async () => {
    const tOutside = at(2, 0);
    const tEnter = at(2, 10);
    const tLatest = at(2, 20);

    // Same data, shuffled — reconstruction must still pick the earliest inside ping.
    await handleKeepaliveTaskPayload({
      locations: [
        ping(CENTER.lat, CENTER.lon, 20, tLatest),
        ping(OUTSIDE.lat, OUTSIDE.lon, 20, tOutside),
        ping(CENTER.lat, CENTER.lon, 20, tEnter),
      ],
    });

    const session = await db.getActiveSession(locationId);
    expect(session?.clockIn).toBe(new Date(tEnter).toISOString());
  });

  it('reconstructs the EXIT at the first outside ping in a delayed batch', async () => {
    // Establish an active session via an enter ping.
    const tEnter = at(0, 0);
    await handleKeepaliveTaskPayload({
      locations: [ping(CENTER.lat, CENTER.lon, 20, tEnter)],
    });
    expect((await db.getActiveSession(locationId))?.state).toBe('active');

    const markSpy = jest.spyOn(db, 'markPendingExit');

    // Delayed batch: still inside at 08:00, leaves at 08:30 (true exit),
    // batch only flushed at 08:55 when the app wakes.
    const tInside = at(1, 0);
    const tLeave = at(1, 30);
    const tLatest = at(1, 55);

    await handleKeepaliveTaskPayload({
      locations: [
        ping(CENTER.lat, CENTER.lon, 20, tInside),
        ping(OUTSIDE.lat, OUTSIDE.lon, 20, tLeave),
        ping(OUTSIDE.lat, OUTSIDE.lon, 20, tLatest),
      ],
    });

    // The pending exit must be dated at the first OUTSIDE ping (08:30), not the
    // latest ping (08:55) nor wall-clock "now". A single ping from the stream is
    // a weak claim ('uncertain'); the second outside ping proves it and, judged
    // as of that second fix, the hysteresis has long passed → confirmed.
    expect(markSpy).toHaveBeenCalledWith(
      expect.any(String),
      new Date(tLeave).toISOString(),
      20,
      'uncertain'
    );
    const [row] = await db.getSessionHistory(locationId, 10);
    expect(row.state).toBe('completed');
    expect(row.clockOut).toBe(new Date(tLeave).toISOString());
  });
});
