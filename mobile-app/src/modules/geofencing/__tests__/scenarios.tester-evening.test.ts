/**
 * Realistic scenario transcribed from a tester's bug report (Android, old
 * build), dates shifted, location anonymised. The tester was in the building
 * the whole evening, partly in a basement; the old build clocked him out
 * twice and once recorded the same fix as an enter AND an exit in one second.
 *
 * Expected with the session rules: ONE continuous session, ended by the first
 * real outside fix after he actually left. The clock is faked and follows the
 * timeline (see test-utils/tracking-replay.ts).
 */
import * as Notifications from 'expo-notifications';
import { v4 as uuidv4 } from 'uuid';

import * as DatabaseModule from '../services/Database';
import { Database } from '../services/Database';
import { TrackingManagerAndroid as TrackingManager } from '../services/TrackingManagerAndroid';
import { __resetKeepaliveStateForTests } from '../services/KeepaliveHealthCheckService';
import { replay, type ReplayPlace } from '@/test-utils/tracking-replay';
import { coreOverride } from '@/test-utils/tracking-scenario';

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

const MIN = 60 * 1000;
// Any fixed evening; the replay sets the fake clock to base + step minutes.
const BASE = new Date(2026, 8, 21, 16, 0, 0).getTime(); // "16:00"
const at = (minutes: number) => new Date(BASE + minutes * MIN).toISOString();

describe('tester evening replay (basement, no-fix exits, same-second enter/exit)', () => {
  let db: Database;
  let manager: TrackingManager;
  let place: ReplayPlace;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(BASE);
    mockSecureStore.clear();
    db = new Database(':memory:');
    await db.initialize();
    manager = (coreOverride() ?? ((d: Database) => new TrackingManager(d)))(db) as TrackingManager;
    place = {
      locationId: uuidv4(),
      inside: { lat: 50.6, lon: 8.8 },
      outside: { lat: 50.61, lon: 8.8 }, // ~1.1 km north
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
  });

  afterEach(async () => {
    await db.close();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const clockOutNotifications = () =>
    (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
      ([req]) => req?.content?.title === 'Clocked Out'
    );

  // The evening as the report shows it. The 22:23 no-fix exit is followed by
  // NO inside evidence before the real departure at 00:35, so the exit stands
  // (rule 5 confirms an unproven exit once nothing contradicts it for the
  // window): ~2 h are lost, recoverable in the calendar — the same as the old
  // build recorded, and far better than a stuck session. The next test shows
  // what one inside fix in that gap would have done.
  it('keeps one session through the first no-fix exit, the phantom and the raced fix; the late no-fix exit stands', async () => {
    await replay(db, manager, place, BASE, [
      { at: 22, os: 'enter', fix: { where: 'inside', accuracy: 24.6 } }, // 16:22 arrived
      { at: 106, os: 'exit', fix: 'none' }, //                             17:46 EXIT N/A — basement
      { at: 107, verify: 0, gps: 'uncertain' }, //                          no GPS indoors
      { at: 109, verify: 1, gps: 'uncertain' },
      { at: 111, verify: 2, gps: 'uncertain' }, //                          final check uncertain
      { at: 120, foreground: true, gps: 'uncertain' }, //                   18:00 opened the app → no evidence → cancelled
      { at: 132, raceEnterExit: { where: 'inside', accuracy: 13.6 } }, //   18:12 one fix, ENTER and EXIT at once
      { at: 240, os: 'enter', fix: { where: 'inside', accuracy: 11.5 } }, // 20:00 OS enter, already there
      { at: 283, os: 'exit', fix: { where: 'inside', accuracy: 100 } }, //  20:43 EXIT with a 100 m fix at the workplace → phantom
      { at: 383, os: 'exit', fix: 'none' }, //                             22:23 EXIT N/A
      { at: 384, verify: 0, gps: 'uncertain' },
      { at: 386, verify: 1, gps: 'uncertain' },
      { at: 388, verify: 2, gps: 'uncertain' },
      { at: 400, foreground: true, gps: 'uncertain' },
      { at: 515, keepalive: 'outside', accuracy: 20 }, //                   00:35 walked home — first real outside fix
      { at: 521, foreground: true, gps: 'outside' }, //                     hysteresis expired → confirm
    ]);

    const history = await db.getSessionHistory(place.locationId, 10);
    expect(history).toHaveLength(1);
    const [session] = history;
    expect(session.state).toBe('completed');
    expect(session.clockIn).toBe(at(22));
    expect(session.clockOut).toBe(at(383)); // 22:23 — the unproven exit stood
    expect(clockOutNotifications()).toHaveLength(1);
  });

  it('…and one inside fix during that gap (opening the app in the building) rescues the whole evening', async () => {
    await replay(db, manager, place, BASE, [
      { at: 22, os: 'enter', fix: { where: 'inside', accuracy: 24.6 } },
      { at: 106, os: 'exit', fix: 'none' },
      { at: 107, verify: 0, gps: 'uncertain' },
      { at: 109, verify: 1, gps: 'uncertain' },
      { at: 111, verify: 2, gps: 'uncertain' },
      { at: 120, foreground: true, gps: 'inside' }, //  opened the app upstairs: inside → cancelled
      { at: 132, raceEnterExit: { where: 'inside', accuracy: 13.6 } },
      { at: 240, os: 'enter', fix: { where: 'inside', accuracy: 11.5 } },
      { at: 283, os: 'exit', fix: { where: 'inside', accuracy: 100 } },
      { at: 383, os: 'exit', fix: 'none' },
      { at: 384, verify: 0, gps: 'uncertain' },
      { at: 386, verify: 1, gps: 'uncertain' },
      { at: 388, verify: 2, gps: 'uncertain' },
      { at: 400, foreground: true, gps: 'inside' }, //  again upstairs → cancelled
      { at: 515, keepalive: 'outside', accuracy: 20 }, // 00:35 walked home — first outside ping
      { at: 520, keepalive: 'outside', accuracy: 20 }, // second consecutive ping → exit at 00:35
      { at: 526, foreground: true, gps: 'outside' },
    ]);
    const history = await db.getSessionHistory(place.locationId, 10);
    expect(history).toHaveLength(1);
    expect(history[0].clockIn).toBe(at(22));
    expect(history[0].clockOut).toBe(at(515));
    expect(history[0].durationMinutes).toBe(515 - 22);
    expect(clockOutNotifications()).toHaveLength(1);
  });

  it('iOS overnight: a no-fix exit with no foreground until the next morning is confirmed at its time; the new day is tracked', async () => {
    await replay(db, manager, place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } }, //          08:00 (base = "08:00" here)
      { at: 540, os: 'exit', fix: 'none' }, //                                   17:00 left via the garage, no fix
      { at: 540 + 23 * 60 + 50, os: 'enter', fix: { where: 'inside', accuracy: 20 } }, // 07:50 next day
      { at: 540 + 24 * 60, foreground: true, gps: 'inside' }, //                 08:00 next day at work
    ]);
    const history = await db.getSessionHistory(place.locationId, 10);
    expect(history).toHaveLength(2);
    const yesterday = history.find((h) => h.state === 'completed')!;
    expect(yesterday.clockIn).toBe(at(0));
    expect(yesterday.clockOut).toBe(at(540));
    expect(history.some((h) => h.state === 'active')).toBe(true);
  });

  it('an exit WITH a real outside fix is still confirmed after the hysteresis, at the exit time', async () => {
    await replay(db, manager, place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 60 } }, // real fix, but ≥ 50 m → hysteresis
      { at: 61, verify: 0, gps: 'uncertain' },
      { at: 63, verify: 1, gps: 'uncertain' },
      { at: 65, verify: 2, gps: 'uncertain' },
      { at: 80, foreground: true, gps: 'uncertain' },
    ]);
    const [session] = await db.getSessionHistory(place.locationId, 10);
    expect(session.state).toBe('completed');
    expect(session.clockOut).toBe(at(60));
  });

  it('a no-fix exit IS confirmed once a verification check is confidently outside', async () => {
    await replay(db, manager, place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: 'none' },
      { at: 61, verify: 0, gps: 'uncertain' },
      { at: 63, verify: 1, gps: 'outside' }, // early evidence: recorded on the pending exit
      { at: 65, verify: 2, gps: 'outside' }, // final + outside → confirmed at the exit time
    ]);
    const [session] = await db.getSessionHistory(place.locationId, 10);
    expect(session.state).toBe('completed');
    expect(session.clockOut).toBe(at(60));
    expect(clockOutNotifications()).toHaveLength(1);
  });

  it('a no-fix exit whose early check said outside is confirmed by the expiry pass even if the final check never runs', async () => {
    await replay(db, manager, place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: 'none' },
      { at: 63, verify: 1, gps: 'outside' }, // phone slept through check 0; check 2 never fires
      { at: 90, foreground: true, gps: 'uncertain' },
    ]);
    const [session] = await db.getSessionHistory(place.locationId, 10);
    expect(session.state).toBe('completed');
    expect(session.clockOut).toBe(at(60));
  });
});
