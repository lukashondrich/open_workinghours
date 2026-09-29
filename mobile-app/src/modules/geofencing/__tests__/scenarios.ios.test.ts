/**
 * Scenario suite — iOS profile (TrackingManagerIOS = the shipped production core).
 *
 * These tests assert what production iOS DOES, including its known limits.
 * They are a lock, not a wish list: iOS stays on the shipped core by owner decision
 * (2026-09-28), so a failure here means the iOS path changed by accident.
 *
 * iOS profile rules: no keepalive (Android-only foreground service), and the
 * exit-verification notifications do not run the app in the background on
 * iOS, so a story uses only OS callbacks, foreground passes and manual taps.
 * OS callbacks are serialized by App.tsx' task queue, so the enter/exit race
 * of the Android tester's evening cannot happen here.
 *
 * "AS SHIPPED" tests describe behaviour the Android core already fixes. They
 * are NOT accepted limits: they are frozen until iOS moves to the Android core
 * (once it is proven with the testers). Do not fix them here; when iOS moves,
 * this profile is replaced by the Android one, not edited.
 */
import { TrackingManagerIOS } from '../services/TrackingManagerIOS';
import { replay } from '@/test-utils/tracking-replay';
import { setupScenario, type Scenario, HOUR, DAY } from '@/test-utils/tracking-scenario';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

const BASE = new Date(2026, 8, 21, 8, 0, 0).getTime();

describe('iOS tracking core (as shipped): scenario suite', () => {
  let s: Scenario;

  beforeEach(async () => {
    s = await setupScenario((db) => new TrackingManagerIOS(db), BASE);
  });

  afterEach(async () => {
    await s.close();
  });

  it('a normal day: arrive, leave with a good fix — one session, clocked out at the exit', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 8 * HOUR, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(8 * HOUR));
    expect(sessions[0].durationMinutes).toBe(8 * HOUR);
    expect(s.clockOutNotifications()).toHaveLength(1);
  });

  it('a 12-minute errand records two sessions', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 300, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
      { at: 312, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 8 * HOUR, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([
      [s.at(0), s.at(300)],
      [s.at(312), s.at(8 * HOUR)],
    ]);
  });

  it('a quick GPS blip out and back within 5 minutes is cancelled', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 80 } }, // ≥ 50 m → hysteresis
      { at: 63, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('active');
  });

  it('AS SHIPPED (Android core notifies): an exit with a poor fix, nothing running in the background, is clocked out at the exit time on the next foreground by the 10-min fallback — silently', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 480, os: 'exit', fix: { where: 'outside', accuracy: 80 } },
      { at: 495, foreground: true },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(480));
    // The SQL bulk-confirm does not notify — production behaviour.
    expect(s.clockOutNotifications()).toHaveLength(0);
  });

  it('overnight: a no-fix exit is confirmed at its time by the next morning\'s arrival; the new day is tracked', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 9 * HOUR, os: 'exit', fix: 'none' },
      { at: 9 * HOUR + DAY - 10, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 9 * HOUR + DAY, foreground: true },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBe(s.at(9 * HOUR));
    expect(sessions[1].state).toBe('active');
    expect(sessions[1].clockIn).toBe(s.at(9 * HOUR + DAY - 10));
  });

  // ---------------------------------------------------------------------------
  // As shipped on iOS — the Android core fixes each of these; iOS follows later
  // ---------------------------------------------------------------------------

  it('AS SHIPPED (Android core fixes this): a no-fix exit while still inside (basement) becomes a clock-out after 10 minutes; the return is a new session', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 106, os: 'exit', fix: 'none' }, //   phone lost GPS in the basement
      { at: 120, foreground: true }, //          opened the app upstairs → the 10-min fallback has already decided
      { at: 132, os: 'enter', fix: { where: 'inside', accuracy: 14 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBe(s.at(106)); // the false clock-out
    expect(sessions[1].state).toBe('active');
    expect(sessions[1].clockIn).toBe(s.at(132));
  });

  it('AS SHIPPED (Android core fixes this): the Android tester\'s evening on iOS would have lost the last two hours', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 22, os: 'enter', fix: { where: 'inside', accuracy: 24.6 } },
      { at: 106, os: 'exit', fix: 'none' },
      { at: 120, foreground: true },
      { at: 132, os: 'enter', fix: { where: 'inside', accuracy: 13.6 } },
      { at: 240, os: 'enter', fix: { where: 'inside', accuracy: 11.5 } },
      { at: 283, os: 'exit', fix: { where: 'inside', accuracy: 100 } }, // a 100 m fix AT the workplace is still an exit for the shipped core
      { at: 383, os: 'exit', fix: 'none' },
      { at: 400, foreground: true },
      { at: 515, os: 'exit', fix: { where: 'outside', accuracy: 20 } }, // the real departure: no session left to close
    ]);
    const sessions = await s.sessions();
    expect(sessions.map((x) => [x.clockIn, x.clockOut, x.state])).toEqual([
      [s.at(22), s.at(106), 'completed'],
      [s.at(132), s.at(283), 'completed'],
    ]);
  });

  it('AS SHIPPED (Android core fixes this): a manual session is closed by an OS exit like any other', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, manual: 'in' },
      { at: 30, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].trackingMethod).toBe('manual');
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(30));
  });

  it('AS SHIPPED (Android core fixes this): a cached fix from before clock-in is taken as an exit — the shared clamp keeps the duration at 0 instead of negative', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 20, os: 'exit', fix: { where: 'outside', accuracy: 30 }, fixAt: -10 },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    // The only iOS-visible change of the 2026-09 batch: Database.clampClockOut.
    expect(sessions[0].clockOut).toBe(s.at(0));
    expect(sessions[0].durationMinutes).toBe(0);
  });

  it('AS SHIPPED (Android core fixes this): no exit signal ever → no cap; the session stays open and a later arrival is swallowed', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: DAY + 60, foreground: true },
      { at: DAY + 61, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('active');
    expect(s.capNotifications()).toHaveLength(0);
  });
});
