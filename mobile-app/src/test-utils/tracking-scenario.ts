/**
 * Shared fixture for the tracking scenario suite (`scenarios.*.test.ts`).
 *
 * One location, a fake clock, an in-memory Database wired into `getDatabase()`
 * (the keepalive and verification services resolve it that way), and small
 * readers for what the user would have seen (notifications) and what was
 * stored (sessions).
 *
 * The test file still has to `jest.mock('expo-secure-store', …)` itself with
 * a Map-backed mock (jest.mock is per test file, and a factory that required
 * this module would import the services it is mocking for).
 */
import * as Notifications from 'expo-notifications';
import { v4 as uuidv4 } from 'uuid';

import * as DatabaseModule from '@/modules/geofencing/services/Database';
import { Database } from '@/modules/geofencing/services/Database';
import type { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import { __resetKeepaliveStateForTests } from '@/modules/geofencing/services/KeepaliveHealthCheckService';
import type { TrackingSession } from '@/modules/geofencing/types';
import { TrackingManagerIOS } from '@/modules/geofencing/services/TrackingManagerIOS';
import { TrackingManagerAndroid } from '@/modules/geofencing/services/TrackingManagerAndroid';
import type { ReplayPlace } from './tracking-replay';

/**
 * Matrix mode: `TRACKING_CORE=ios|android` overrides the core a scenario file
 * uses, so the same timelines can be run against the other core (see
 * `scripts/tracking-matrix.sh`). Steps that platform does not deliver are
 * skipped by the replay helper.
 */
export function coreOverride(): ((db: Database) => TrackingManager) | null {
  const core = process.env.TRACKING_CORE;
  if (core === 'ios') return (db) => new TrackingManagerIOS(db);
  if (core === 'android') return (db) => new TrackingManagerAndroid(db);
  return null;
}

export const MIN = 60 * 1000;
export const HOUR = 60;
export const DAY = 24 * HOUR;

export interface Scenario {
  db: Database;
  manager: TrackingManager;
  place: ReplayPlace;
  base: number;
  /** ISO timestamp `minutes` after base — the same scale as replay steps. */
  at: (minutes: number) => string;
  sessions: () => Promise<TrackingSession[]>;
  /** 'Clocked Out' banners the user would have seen (auto and manual). */
  clockOutNotifications: () => unknown[][];
  /** The 24 h cap notice. */
  capNotifications: () => unknown[][];
  close: () => Promise<void>;
}

/**
 * Fence of 200 m. `outside` is ~1.1 km north; `near` is ~230 m north, i.e.
 * 30 m past the edge: a 20 m fix there is confidently outside, a 50 m fix is
 * uncertain — GPS jitter at the boundary.
 */
export async function setupScenario(
  makeManager: (db: Database) => TrackingManager,
  base: number
): Promise<Scenario> {
  jest.useFakeTimers();
  jest.setSystemTime(base);
  const db = new Database(':memory:');
  await db.initialize();
  const place: ReplayPlace = {
    locationId: uuidv4(),
    inside: { lat: 50.6, lon: 8.8 },
    outside: { lat: 50.61, lon: 8.8 },
    near: { lat: 50.6 + 230 / 111_320, lon: 8.8 },
    radiusMeters: 200,
  };
  await db.insertLocation({
    id: place.locationId,
    name: 'Workplace',
    latitude: place.inside.lat,
    longitude: place.inside.lon,
    radiusMeters: place.radiusMeters,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  jest.spyOn(DatabaseModule, 'getDatabase').mockResolvedValue(db);
  __resetKeepaliveStateForTests();
  jest.clearAllMocks();

  const notificationCalls = () => (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  return {
    db,
    manager: (coreOverride() ?? makeManager)(db),
    place,
    base,
    at: (minutes) => new Date(base + minutes * MIN).toISOString(),
    sessions: async () => {
      const rows = await db.getSessionHistory(place.locationId, 20);
      return [...rows].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    },
    clockOutNotifications: () => notificationCalls().filter(([req]) => req?.content?.title === 'Clocked Out'),
    capNotifications: () => notificationCalls().filter(([req]) => req?.content?.data?.autoClosed === true),
    close: async () => {
      await db.close();
      jest.restoreAllMocks();
      jest.useRealTimers();
    },
  };
}
