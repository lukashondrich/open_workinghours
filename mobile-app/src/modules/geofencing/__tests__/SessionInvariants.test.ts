/**
 * Session invariants — scenario tests derived from Android tester reports
 * (2026-09, single geofenced location "Wohnzimmer", home office = manual clock-in).
 *
 * Each scenario replays a concrete story through the REAL entry points
 * (TrackingManager handlers + keepalive replay) against an in-memory SQLite DB.
 * Timestamps are backdated relative to the real clock because several DB queries
 * compare against Date.now().
 *
 * Invariants under test:
 *  1. Manual sessions are owned by the user: no location signal ever closes them.
 *  2. Fix timestamps older than the latest session boundary are stale evidence
 *     and are ignored (never a negative duration, never a backdated overlap).
 *  3. Concurrent deliveries of the same fix produce one session, no throw.
 *  4. Any session still open after 24 h is closed at clock_in + 24 h.
 */
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { v4 as uuidv4 } from 'uuid';

import * as DatabaseModule from '../services/Database';
import { Database } from '../services/Database';
import { TrackingManagerAndroid as TrackingManager } from '../services/TrackingManagerAndroid';
import {
  handleKeepaliveTaskPayload,
  __resetKeepaliveStateForTests,
} from '../services/KeepaliveHealthCheckService';
import { GeofenceEventData } from '../types';
import { t, setLocale } from '@/lib/i18n';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const CENTER = { lat: 50.6, lon: 8.8 };
const RADIUS_M = 200;
// ~1.1 km north — confidently outside.
const OUTSIDE = { lat: 50.61, lon: 8.8 };

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function toMsIso(iso: string): number {
  return new Date(iso).getTime();
}

function ping(lat: number, lon: number, accuracy: number, timestampMs: number): Location.LocationObject {
  return {
    coords: { latitude: lat, longitude: lon, accuracy, altitude: 0, altitudeAccuracy: 0, heading: 0, speed: 0 },
    timestamp: timestampMs,
  };
}

function osEvent(
  type: 'enter' | 'exit',
  locationId: string,
  timestamp: string,
  accuracy?: number
): GeofenceEventData {
  return {
    eventType: type,
    locationId,
    timestamp,
    latitude: type === 'enter' ? CENTER.lat : OUTSIDE.lat,
    longitude: CENTER.lon,
    accuracy,
    accuracySource: accuracy !== undefined ? 'event' : null,
  };
}

describe('Session invariants (tester scenarios)', () => {
  let db: Database;
  let manager: TrackingManager;
  let locationId: string;

  // jest-expo's expo-localization mock always yields 'en'; pin it so the
  // notification assertions below are explicit rather than accidental.
  beforeAll(() => setLocale('en'));

  beforeEach(async () => {
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
    __resetKeepaliveStateForTests();
    jest.clearAllMocks();
    (Location.getCurrentPositionAsync as jest.Mock).mockReset(); // drop leaked once-values
  });

  afterEach(async () => {
    await db.close();
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Manual sessions are owned by the user
  // ---------------------------------------------------------------------------
  describe('manual session policy', () => {
    it('A1/A2: keepalive "outside" ping + foreground do NOT close a manual home-office session', async () => {
      // Clocked in manually at home 30 min ago (home is outside the café fence).
      await db.clockIn(locationId, ago(30 * MIN), 'manual');

      // Android keepalive delivers a fix 20 min ago, confidently outside.
      await handleKeepaliveTaskPayload({
        locations: [ping(OUTSIDE.lat, OUTSIDE.lon, 20, Date.now() - 20 * MIN)],
      });

      // User returns to the app → foreground processing.
      await manager.processPendingExits();

      const session = await db.getActiveSession(locationId);
      expect(session).not.toBeNull();
      expect(session?.state).toBe('active');
      expect(session?.trackingMethod).toBe('manual');

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].clockOut).toBeNull();
    });

    it('OS geofence exit with good GPS does NOT close a manual session', async () => {
      await db.clockIn(locationId, ago(30 * MIN), 'manual');

      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(10 * MIN), 15));

      const session = await db.getActiveSession(locationId);
      expect(session?.state).toBe('active');
      expect(session?.clockOut).toBeNull();

      const events = await db.getGeofenceEvents(locationId, 10);
      expect(events).toHaveLength(1);
      expect(events[0].ignored).toBe(true);
      expect(events[0].ignoreReason).toBe('manual_session');
    });

    it('geofence enter during a manual session keeps it manual (no conversion, no second session)', async () => {
      await db.clockIn(locationId, ago(30 * MIN), 'manual');

      await manager.handleGeofenceEnter(osEvent('enter', locationId, ago(5 * MIN), 15));

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].trackingMethod).toBe('manual');
      expect(history[0].state).toBe('active');
    });

    it('manual clock-in tells the user they must clock out manually', async () => {
      await manager.clockIn(locationId);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: t('tracking.notifications.title'),
            body: t('tracking.notifications.manualClockIn', { location: 'Wohnzimmer' }),
          }),
        })
      );
    });

    it('legacy manual row stuck in pending_exit for >10 min is restored, never confirmed (rule 1)', async () => {
      const s = await db.clockIn(locationId, ago(60 * MIN), 'manual');
      await db.markPendingExit(s.id, ago(30 * MIN), null);

      await manager.processPendingExits();

      const row = await db.getSession(s.id);
      expect(row?.state).toBe('active');
      expect(row?.clockOut).toBeNull();
      expect(row?.pendingExitAt ?? null).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Stale fixes are not evidence
  // ---------------------------------------------------------------------------
  describe('stale timestamp rejection', () => {
    it('A5: an exit fix stamped BEFORE clock-in never produces a negative duration', async () => {
      // Auto session started 10 min ago.
      await db.clockIn(locationId, ago(10 * MIN), 'geofence_auto', 20);

      // Cached fix from 25 min ago (Accuracy.Low / late delivery) arrives as an exit.
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(25 * MIN), 15));
      await manager.processPendingExits();

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe('active');
      expect(history[0].clockOut).toBeNull();
      expect(history[0].durationMinutes ?? 0).toBeGreaterThanOrEqual(0);

      const events = await db.getGeofenceEvents(locationId, 10);
      expect(events[0].ignored).toBe(true);
      expect(events[0].ignoreReason).toBe('stale_timestamp');
    });

    it('A5 (hysteresis path): a pending exit can never be confirmed to a time before clock-in', async () => {
      await db.clockIn(locationId, ago(10 * MIN), 'geofence_auto', 20);

      // Exit without accuracy (keepalive omits it) stamped before clock-in.
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(25 * MIN)));
      await manager.processPendingExits();

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].durationMinutes ?? 0).toBeGreaterThanOrEqual(0);
      if (history[0].clockOut) {
        expect(new Date(history[0].clockOut).getTime()).toBeGreaterThanOrEqual(
          new Date(history[0].clockIn).getTime()
        );
      }
    });

    it('B1: replayed inside-fix older than the last clock-out does not open a backdated overlapping session', async () => {
      // Completed session 16:48–17:01 (relative: 60 → 47 min ago).
      const s = await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      await db.clockOut(s.id, ago(47 * MIN));

      // Late batch replays an "inside" fix from 16:48 (60 min ago).
      await handleKeepaliveTaskPayload({
        locations: [ping(CENTER.lat, CENTER.lon, 20, Date.now() - 60 * MIN)],
      });

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);

      const events = await db.getGeofenceEvents(locationId, 10);
      expect(events).toHaveLength(1);
      expect(events[0].ignored).toBe(true);
      expect(events[0].ignoreReason).toBe('stale_timestamp');
    });

    it('an enter within the 30 s tolerance of the last clock-out is NOT stale (clock skew)', async () => {
      const s = await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const clockOut = ago(20 * MIN);
      await db.clockOut(s.id, clockOut);

      // OS geofence enter stamped 10 s BEFORE the (device-time) clock-out
      await manager.handleGeofenceEnter(osEvent('enter', locationId, new Date(toMsIso(clockOut) - 10 * 1000).toISOString(), 15));

      const open = await db.getActiveSession(locationId);
      expect(open).not.toBeNull();
    });

    it('B2: a late batch with a 1-minute GPS blip (outside, then inside) keeps ONE session', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);

      // Delivered 20 min late as one batch: outside at −20, back inside at −19.
      await handleKeepaliveTaskPayload({
        locations: [
          ping(OUTSIDE.lat, OUTSIDE.lon, 20, Date.now() - 20 * MIN),
          ping(CENTER.lat, CENTER.lon, 20, Date.now() - 19 * MIN),
        ],
      });

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe('active');
      expect(history[0].pendingExitAt ?? null).toBeNull();
      const clockOuts = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([req]) => req?.content?.title === 'Clocked Out'
      );
      expect(clockOuts).toHaveLength(0);
    });

    it('rule 5: an exit with NO fix is cancelled when the expiry pass finds the user inside', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(20 * MIN))); // N/A accuracy
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(ping(CENTER.lat, CENTER.lon, 15, Date.now()));
      await manager.processPendingExits();
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('active');
      expect(row.pendingExitAt ?? null).toBeNull();
    });

    it('rule 5: an exit with NO fix and no fetch result at all stays pending (nothing is decided blind)', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(20 * MIN)));
      await manager.processPendingExits(); // GPS mock returns undefined → uncertain
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('pending_exit');
    });

    it('rule 5: an OS exit whose fetched fix is confidently inside the fence is a phantom', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const phantom: GeofenceEventData = {
        ...osEvent('exit', locationId, ago(20 * 1000), 13.6), // fresh fix (20 s old)…
        latitude: CENTER.lat, // …AT the workplace
        longitude: CENTER.lon,
      };
      await manager.handleGeofenceExit(phantom);
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('active');
      const events = await db.getGeofenceEvents(locationId, 10);
      expect(events[0].ignoreReason).toBe('phantom_exit');
    });

    it('rule 5: a coarse fix far away IS evidence (geometry, not accuracy) — confirmed after hysteresis', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      // 1.1 km away at 150 m accuracy: the whole error circle is outside the 200 m fence
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(20 * MIN), 150));
      await manager.processPendingExits();
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('completed');
      expect(row.durationMinutes).toBe(40);
    });

    it('rule 5: an OS exit whose fix straddles the edge is an UNPROVEN claim, never immediate', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      // 178 m from the centre at 30 m accuracy: not wholly inside the 200 m fence,
      // not wholly beyond fence + 50 m margin → uncertain
      const edge: GeofenceEventData = {
        ...osEvent('exit', locationId, ago(30 * 1000), 30),
        latitude: CENTER.lat + 0.0016, // ≈ 178 m north
        longitude: CENTER.lon,
      };
      await manager.handleGeofenceExit(edge);
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('pending_exit');
      expect(row.exitEvidence).toBe('uncertain');
    });

    it('rule 5: an OS exit with an outside fix wider than 50 m goes through the pending state, not immediate', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(30 * 1000), 80)); // 1.1 km away, ±80 m
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('pending_exit');
      expect(row.exitEvidence).toBe('outside');
    });

    it('rule 5: a later outside ping upgrades an unproven pending exit; the departure time stays the original exit', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const left = ago(20 * MIN);
      await manager.handleGeofenceExit(osEvent('exit', locationId, left)); // N/A → uncertain
      await handleKeepaliveTaskPayload({
        locations: [ping(OUTSIDE.lat, OUTSIDE.lon, 10, Date.now() - 18 * MIN)], // 2 min later, 10 m, far away
      });
      let [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('pending_exit'); // proven, but judged as of the ping: 2 min < hysteresis
      expect(row.exitEvidence).toBe('outside');
      await manager.processPendingExits(); // any later pass confirms it
      [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('completed');
      expect(row.clockOut).toBe(left);
    });

    it('rule 5: re-entry within the window after an UNPROVEN pending exit keeps the session (a basement, not a departure)', async () => {
      await db.clockIn(locationId, ago(120 * MIN), 'geofence_auto', 20);
      await manager.handleGeofenceExit(osEvent('exit', locationId, ago(60 * MIN))); // N/A
      await manager.handleGeofenceEnter(osEvent('enter', locationId, ago(2 * MIN), 15)); // 58 min "later"
      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe('active');
    });

    it('rule 5 (iOS overnight): re-entry LONG after an unproven exit confirms it at the exit time and starts a new session', async () => {
      await db.clockIn(locationId, ago(23 * HOUR), 'geofence_auto', 20); // 08:00 yesterday
      const left = ago(14 * HOUR); //                                       17:00 yesterday, exit with no fix
      await manager.handleGeofenceExit(osEvent('exit', locationId, left));
      await manager.handleGeofenceEnter(osEvent('enter', locationId, ago(5 * MIN), 15)); // 07:55 today
      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(2);
      const yesterday = history.find((h) => h.state === 'completed')!;
      expect(yesterday.clockOut).toBe(left);
      expect(history.some((h) => h.state === 'active')).toBe(true);
    });

    it('rule 5: an UNCERTAIN foreground fetch resolves nothing — the pending exit survives for the next pass', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const left = ago(20 * MIN);
      await manager.handleGeofenceExit(osEvent('exit', locationId, left)); // N/A → uncertain
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(ping(CENTER.lat, CENTER.lon, 10_000, Date.now()));
      await manager.processPendingExits();
      let [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('pending_exit');
      // …and a later pass with an outside fix confirms at the ORIGINAL exit time
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(ping(OUTSIDE.lat, OUTSIDE.lon, 15, Date.now()));
      await manager.processPendingExits();
      [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('completed');
      expect(row.clockOut).toBe(left);
    });

    it('rule 5: an unproven exit older than the gap (dead stream) is confirmed by the foreground pass even with an uncertain fetch', async () => {
      await db.clockIn(locationId, ago(7 * HOUR), 'geofence_auto', 20);
      const left = ago(5 * HOUR);
      await manager.handleGeofenceExit(osEvent('exit', locationId, left)); // N/A
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(ping(CENTER.lat, CENTER.lon, 10_000, Date.now()));
      await manager.processPendingExits();
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('completed');
      expect(row.clockOut).toBe(left);
    });

    it('rule 5: the expiry pass fetches a fix before deciding — outside confirms at the exit time', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const left = ago(20 * MIN);
      await manager.handleGeofenceExit(osEvent('exit', locationId, left)); // N/A → uncertain
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce(ping(OUTSIDE.lat, OUTSIDE.lon, 15, Date.now()));
      await manager.processPendingExits();
      const [row] = await db.getSessionHistory(locationId, 10);
      expect(row.state).toBe('completed');
      expect(row.clockOut).toBe(left);
    });

    it('B1 control: an inside-fix AFTER the last clock-out opens a new session (user came back)', async () => {
      const s = await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      await db.clockOut(s.id, ago(47 * MIN));

      await handleKeepaliveTaskPayload({
        locations: [ping(CENTER.lat, CENTER.lon, 20, Date.now() - 40 * MIN)],
      });

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(2);
      const open = await db.getActiveSession(locationId);
      expect(open).not.toBeNull();
      expect(new Date(open!.clockIn).getTime()).toBeGreaterThan(new Date(s.clockIn).getTime());
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Concurrency
  // ---------------------------------------------------------------------------
  describe('serialized event handling', () => {
    it('B1: the same enter fix delivered concurrently by two paths yields exactly one session and no error', async () => {
      const ts = ago(2 * MIN);
      await expect(
        Promise.all([
          manager.handleGeofenceEnter(osEvent('enter', locationId, ts, 20)),
          manager.handleGeofenceEnter(osEvent('enter', locationId, ts, 20)),
        ])
      ).resolves.toBeDefined();

      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
    });

    it('concurrent exit + expiry pass: exactly one clock-out, stamped at the exit fix', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const ts = ago(2 * MIN); // live event (not a replay) → the expiry pass runs
      await expect(
        Promise.all([
          manager.handleGeofenceExit(osEvent('exit', locationId, ts, 15)), // good GPS → immediate
          manager.processPendingExits(),
          manager.handleGeofenceExit(osEvent('exit', locationId, ts, 15)),
        ])
      ).resolves.toBeDefined();
      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe('completed');
      expect(history[0].clockOut).toBe(ts);
      const clockOuts = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([req]) => req?.content?.title === 'Clocked Out'
      );
      expect(clockOuts).toHaveLength(1);
    });

    it('an enter racing an exit resolves to one consistent session state', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const exitTs = ago(2 * MIN);
      const enterTs = ago(1 * MIN);
      await Promise.all([
        manager.handleGeofenceExit(osEvent('exit', locationId, exitTs)), // hysteresis path
        manager.handleGeofenceEnter(osEvent('enter', locationId, enterTs, 15)), // re-entry within 5 min
      ]);
      const history = await db.getSessionHistory(locationId, 10);
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe('active'); // re-entry cancelled the pending exit
      expect(history[0].pendingExitAt ?? null).toBeNull();
    });

    it('the queue keeps running after a rejected job', async () => {
      await manager.clockIn(locationId);
      await expect(manager.clockIn(locationId)).rejects.toThrow('Already clocked in');
      await expect(manager.clockOut(locationId)).resolves.toBeUndefined();
      expect((await db.getActiveSession(locationId))).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. 24 h cap
  // ---------------------------------------------------------------------------
  describe('24 h auto-close', () => {
    it('closes a forgotten manual session at clock_in + 24 h and notifies', async () => {
      const s = await db.clockIn(locationId, ago(26 * HOUR), 'manual');

      await manager.processPendingExits();

      const session = await db.getSession(s.id);
      expect(session?.state).toBe('completed');
      expect(session?.durationMinutes).toBe(24 * 60);
      expect(new Date(session!.clockOut!).getTime()).toBe(new Date(s.clockIn).getTime() + 24 * HOUR);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({ body: expect.stringMatching(/24/) }),
        })
      );
    });

    it('a pending exit older than the cap is closed at the pending-exit time, not at the cap', async () => {
      const s = await db.clockIn(locationId, ago(30 * HOUR), 'geofence_auto', 20);
      const left = ago(22 * HOUR); // verification never ran, app closed for a day
      await db.markPendingExit(s.id, left, 20, 'outside'); // a real fix proved the exit

      await manager.processPendingExits();

      const row = await db.getSession(s.id);
      expect(row?.state).toBe('completed');
      expect(row?.clockOut).toBe(left);
      expect(row?.durationMinutes).toBe(8 * 60);
      const capNotices = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        ([req]) => /24/.test(req?.content?.body ?? '')
      );
      expect(capNotices).toHaveLength(0);
    });

    it('closes a stuck auto session the same way (missed exit safety net)', async () => {
      const s = await db.clockIn(locationId, ago(30 * HOUR), 'geofence_auto', 20);
      await manager.processPendingExits();
      const session = await db.getSession(s.id);
      expect(session?.state).toBe('completed');
      expect(session?.durationMinutes).toBe(24 * 60);
    });

    it('leaves a 20 h session alone', async () => {
      await db.clockIn(locationId, ago(20 * HOUR), 'manual');
      await manager.processPendingExits();
      expect((await db.getActiveSession(locationId))?.state).toBe('active');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Documented behaviour (passes today) — clock-out time is the exit moment
  // ---------------------------------------------------------------------------
  describe('A4 documentation: auto clock-out is stamped at the exit fix, not at confirmation', () => {
    it('records clock_out = exit timestamp after hysteresis (exit with a real but coarse fix)', async () => {
      await db.clockIn(locationId, ago(60 * MIN), 'geofence_auto', 20);
      const exitAt = ago(7 * MIN);
      await manager.handleGeofenceExit(osEvent('exit', locationId, exitAt, 60)); // ≥ 50 m → hysteresis path
      await manager.processPendingExits();

      const history = await db.getSessionHistory(locationId, 10);
      expect(history[0].state).toBe('completed');
      expect(history[0].clockOut).toBe(exitAt);
      expect(history[0].durationMinutes).toBe(53);
    });
  });
});
