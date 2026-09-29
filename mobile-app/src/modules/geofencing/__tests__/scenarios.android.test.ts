/**
 * Scenario suite — ANDROID profile (TrackingManagerAndroid, session rules 1–5).
 *
 * Every story we know is transcribed here as a replay through the real entry
 * points (OS callbacks, keepalive pings/batches, verification checks,
 * foreground passes, manual taps) on a fake clock. The suite is the spec: any
 * simpler model must pass it before it replaces the Android core.
 *
 * Sources: the Android tester's four emails and his bug report (2026-09,
 * local-only ticket `project-mgmt/ticket-user-feedback-2026-09-android-tracking.md`),
 * the Fable holistic review (`project-mgmt/HANDOFF-tracking-2026-09-28.md`).
 * Dates are shifted, the location is anonymous.
 *
 * `it.failing` = a known open finding: the test states the INTENDED behaviour
 * and currently fails. Fixing the finding flips it to `it`. The tester's
 * evening (basement, no-fix exits) lives in `scenarios.tester-evening.test.ts`.
 */
import { TrackingManagerAndroid } from '../services/TrackingManagerAndroid';
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

// "08:00" on an ordinary weekday; steps are minutes after this.
const BASE = new Date(2026, 8, 21, 8, 0, 0).getTime();

describe('Android tracking core: scenario suite', () => {
  let s: Scenario;

  beforeEach(async () => {
    s = await setupScenario((db) => new TrackingManagerAndroid(db), BASE);
  });

  afterEach(async () => {
    await s.close();
  });

  // ---------------------------------------------------------------------------
  // Happy paths (regression guards)
  // ---------------------------------------------------------------------------

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

  it('a 12-minute errand with good fixes both ways records two sessions (product behaviour, both platforms)', async () => {
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

  // ---------------------------------------------------------------------------
  // Rule 1 — manual sessions belong to the user (tester A1–A4)
  // ---------------------------------------------------------------------------

  it('home office: a manual session outlives every outside signal and ends only by the manual tap', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, manual: 'in' }, //                       clocked in at home, a few hundred metres from the fence
      { at: 5, keepalive: 'outside', accuracy: 30 },
      { at: 10, keepalive: 'outside', accuracy: 30 },
      { at: 15, keepalive: 'outside', accuracy: 30 }, // the old build clocked him out here (10–15 min)
      { at: 20, keepalive: 'outside', accuracy: 30 },
      { at: 25, foreground: true, gps: 'outside' }, //   opening the app used to be the moment the clock-out landed (A2)
      { at: 45, manual: 'out' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].trackingMethod).toBe('manual');
    expect(sessions[0].clockIn).toBe(s.at(0));
    expect(sessions[0].clockOut).toBe(s.at(45));
    expect(sessions[0].durationMinutes).toBe(45);
    expect(s.clockOutNotifications()).toHaveLength(1); // the manual one
  });

  it('a manual session started inside the fence is not closed by an OS exit either', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, manual: 'in' },
      { at: 30, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
      { at: 60, manual: 'out' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockOut).toBe(s.at(60));
    expect(sessions[0].durationMinutes).toBe(60);
  });

  // ---------------------------------------------------------------------------
  // Rule 2 — stale fixes are not evidence (tester A5, B1)
  // ---------------------------------------------------------------------------

  it('stale fixes: a cached fix from before clock-in is not an exit; one from before the last clock-out is not a new session', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 20, os: 'exit', fix: { where: 'outside', accuracy: 30 }, fixAt: -10 }, // cached fix from the walk in → ignored (was: negative duration, A5)
      { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 20 } }, //           real departure
      { at: 70, os: 'enter', fix: { where: 'inside', accuracy: 15 }, fixAt: 55 }, // late fix from before the clock-out → ignored (was: backdated overlap, B1)
      { at: 80, os: 'enter', fix: { where: 'inside', accuracy: 15 } }, //          real return
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockIn).toBe(s.at(0));
    expect(sessions[0].clockOut).toBe(s.at(60));
    expect(sessions[0].durationMinutes).toBe(60);
    expect(sessions[1].state).toBe('active');
    expect(sessions[1].clockIn).toBe(s.at(80));
    for (const x of sessions) expect(x.durationMinutes ?? 0).toBeGreaterThanOrEqual(0);
  });

  // ---------------------------------------------------------------------------
  // Rule 5 — no fix, no exit (tester B2, B4, 16/18 Sep storms)
  // ---------------------------------------------------------------------------

  it('leaving with no fix on the exit: a keepalive ping proves the departure, clock-out at the exit time (B4)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 480, os: 'exit', fix: 'none' }, //                 walked out through the garage
      { at: 481, verify: 0, gps: 'uncertain' },
      { at: 483, verify: 1, gps: 'uncertain' },
      { at: 484, keepalive: 'outside', accuracy: 25 }, //      first real outside fix
      { at: 485, verify: 2, gps: 'outside' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(480));
    expect(s.clockOutNotifications()).toHaveLength(1);
  });

  it('…and with the verification notifications never firing (doze), two outside pings are enough', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 480, os: 'exit', fix: 'none' },
      { at: 484, keepalive: 'outside', accuracy: 25 },
      { at: 489, keepalive: 'outside', accuracy: 25 },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(480));
    expect(s.clockOutNotifications()).toHaveLength(1);
  });

  it('late batch: a one-minute outside blip delivered 20 minutes late does not split the session (B2, first root cause)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      {
        at: 40,
        batch: [
          { where: 'outside', accuracy: 25, fixAt: 20 },
          { where: 'inside', accuracy: 15, fixAt: 21 },
        ],
      },
      { at: 45, foreground: true, gps: 'inside' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('active');
    expect(s.clockOutNotifications()).toHaveLength(0);
  });

  it('exit storm without fixes while inside (nine exits in eight minutes, six enters in 26 s) changes nothing', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      ...[60, 61, 62, 63, 64, 65, 66, 67, 68].map((at) => ({ at, os: 'exit' as const, fix: 'none' as const })),
      { at: 75, foreground: true, gps: 'inside' },
      ...[90, 90.1, 90.2, 90.3, 90.35, 90.4].map((at) => ({
        at,
        os: 'enter' as const,
        fix: { where: 'inside' as const, accuracy: 10 },
      })),
      { at: 8 * HOUR, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockIn).toBe(s.at(0));
    expect(sessions[0].clockOut).toBe(s.at(8 * HOUR));
    expect(s.clockOutNotifications()).toHaveLength(1);
  });

  it('two quick exits on one session: the second departure is the one verified and recorded (finding 7, intended behaviour)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 60 } }, // ≥ 50 m → hysteresis
      { at: 62, os: 'enter', fix: { where: 'inside', accuracy: 15 } }, // back in
      { at: 64, os: 'exit', fix: { where: 'outside', accuracy: 60 } }, // out again
      { at: 65, verify: 0, gps: 'outside' },
      { at: 67, verify: 1, gps: 'outside' },
      { at: 69, verify: 2, gps: 'outside' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(64));
  });

  // ---------------------------------------------------------------------------
  // The no-signal case (tester B5) and the 24 h cap
  // ---------------------------------------------------------------------------

  it('no signal after an unproven exit, app opened the next morning: confirmed at the exit time', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 361, os: 'exit', fix: 'none' }, //                went home; app dozed right after
      { at: 362, verify: 0, gps: 'uncertain' },
      { at: 364, verify: 1, gps: 'uncertain' },
      { at: 366, verify: 2, gps: 'uncertain' },
      { at: 361 + 9 * HOUR, foreground: true, gps: 'uncertain' }, // next morning at home, GPS still says nothing
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(361));
    expect(s.capNotifications()).toHaveLength(0);
  });

  // Finding 12 (new, this suite): closeOverlongSessions runs BEFORE the
  // pending-exit loop and ignores an unproven pending exit, so a known exit
  // time 19 h old is overwritten by the cap.
  it('no signal at all until after the cap: the unproven exit is still the better end than the cap', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 361, os: 'exit', fix: 'none' },
      { at: 362, verify: 0, gps: 'uncertain' },
      { at: 364, verify: 1, gps: 'uncertain' },
      { at: 366, verify: 2, gps: 'uncertain' },
      { at: DAY + 60, foreground: true, gps: 'outside' }, // first sign of life: 25 h after clock-in
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockOut).toBe(s.at(361));
    expect(s.capNotifications()).toHaveLength(0);
  });

  it('no exit signal ever: the session is closed at clock-in + 24 h and the user is told (known limit)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: DAY + 60, foreground: true, gps: 'outside' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockOut).toBe(s.at(DAY));
    expect(sessions[0].durationMinutes).toBe(DAY);
    expect(s.capNotifications()).toHaveLength(1);
  });

  // Finding 4: the OS enter on a stuck session is swallowed ("already clocked
  // in") and only then does the pass cap it — today's arrival is lost.
  it('arrival on a stuck session: the cap closes yesterday AND today is clocked in (finding 4)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: DAY + 60, os: 'enter', fix: { where: 'inside', accuracy: 20 } }, // next day, 09:00
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBe(s.at(DAY));
    expect(sessions[1].state).toBe('active');
    expect(sessions[1].clockIn).toBe(s.at(DAY + 60));
    expect(s.capNotifications()).toHaveLength(1);
  });

  // Finding 3: direct clock-out paths bypass rule 4 (owner decision: the cap
  // stays; a longer shift is extended post hoc in the calendar).
  it('direct clock-out on a session past the cap records 24 h, not 30 (finding 3)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, manual: 'in' },
      { at: DAY + 6 * HOUR, manual: 'out' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clockOut).toBe(s.at(DAY));
    expect(sessions[0].durationMinutes).toBe(DAY);
    expect(s.capNotifications()).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Keepalive as the primary Android signal
  // ---------------------------------------------------------------------------

  // Finding 5: keepalive interval (5 min) == hysteresis (5 min); one ping
  // 30 m past the edge with a tight fix is "proven outside", and the next
  // inside ping arrives just after the hysteresis → confirm + new session.
  it('keepalive jitter: one outside ping between inside pings does not split the session (finding 5)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 15 } },
      { at: 5, keepalive: 'inside', accuracy: 20 },
      { at: 10, keepalive: 'inside', accuracy: 20 },
      { at: 15, keepalive: 'inside', accuracy: 20 },
      { at: 20, keepalive: 'near', accuracy: 20 }, //    GPS jump: 230 m from the centre, ±20 m → "outside"
      { at: 25.5, keepalive: 'inside', accuracy: 20 }, // next ping, 30 s of jitter late
      { at: 30.5, keepalive: 'inside', accuracy: 20 },
      { at: 40, foreground: true, gps: 'inside' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('active');
    expect(s.clockOutNotifications()).toHaveLength(0);
  });

  it('keepalive jitter with a LOOSE fix past the edge is uncertain and changes nothing', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 15 } },
      { at: 5, keepalive: 'inside', accuracy: 20 },
      { at: 10, keepalive: 'near', accuracy: 50 }, // 230 m ± 50 m straddles the 200 m edge
      { at: 15, keepalive: 'inside', accuracy: 20 },
      { at: 25, foreground: true, gps: 'inside' },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('active');
  });

  it('a real departure seen only by keepalive pings: clock-out at the first outside ping', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 15 } },
      { at: 475, keepalive: 'inside', accuracy: 20 },
      { at: 480, keepalive: 'outside', accuracy: 25 }, // the OS exit callback never came
      { at: 485, keepalive: 'outside', accuracy: 25 },
      { at: 490, keepalive: 'outside', accuracy: 25 },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('completed');
    expect(sessions[0].clockOut).toBe(s.at(480));
    expect(s.clockOutNotifications()).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Evidence arriving in the "wrong" envelope
  // ---------------------------------------------------------------------------

  // Finding 6: the phantom-exit branch only cancels within the hysteresis; a
  // fresh inside fix later than that is dropped, and the pass then confirms
  // the proven exit without starting the return session. Delivered as ENTER
  // the same fix would confirm AND clock in.
  it('a fresh inside fix arriving as EXIT after a proven exit: the departure stands and the return is a new session (finding 6)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 60 } }, // proven, hysteresis; phone asleep after
      { at: 67, os: 'exit', fix: { where: 'inside', accuracy: 15 } }, //  laggy OS "exit" carrying the return fix
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBe(s.at(60));
    expect(sessions[1].state).toBe('active');
    expect(sessions[1].clockIn).toBe(s.at(67));
  });

  it('the same fix delivered as ENTER after a proven exit confirms it and clocks in again (the envelope finding 6 wants)', async () => {
    await replay(s.db, s.manager, s.place, BASE, [
      { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 60 } },
      { at: 67, os: 'enter', fix: { where: 'inside', accuracy: 15 } },
    ]);
    const sessions = await s.sessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].clockOut).toBe(s.at(60));
    expect(sessions[1].clockIn).toBe(s.at(67));
  });

  // ---------------------------------------------------------------------------
  // Adversarial review, round 1 (2026-09-28): twelve wrong records the
  // previous core wrote, each confirmed by running. Kept as regression tests.
  // The heartbeat (a ping every 5 min, moving or not) is part of the model now,
  // so the timelines carry the pings the platform actually delivers; the
  // "stream dies" variants show what happens when it does not.
  // ---------------------------------------------------------------------------

  describe('review round 1', () => {
    it('R1: a departure seen by the heartbeat only, then standing still at home, ends at the first outside ping', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 475, keepalive: 'inside', accuracy: 20 },
        { at: 480, keepalive: 'outside', accuracy: 25 }, // walked home ~350 m
        { at: 485, keepalive: 'outside', accuracy: 25 }, // still at home, still pinging
        { at: 490, keepalive: 'outside', accuracy: 25 },
        { at: 540, foreground: true, gps: 'outside' },
        { at: DAY - 10, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: DAY + 60, foreground: true, gps: 'inside' },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([
        [s.at(0), s.at(480)],
        [s.at(DAY - 10), null],
      ]);
    });

    it('R1b: …and if the process dies right after that single outside ping, the next arrival still closes yesterday at the ping', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 475, keepalive: 'inside', accuracy: 20 },
        { at: 480, keepalive: 'outside', accuracy: 25 }, // then the app is killed: no more pings
        { at: DAY - 10, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([
        [s.at(0), s.at(480)],
        [s.at(DAY - 10), null],
      ]);
    });

    it('R2a: an inside foreground fetch the next morning does not merge two days over an unproven overnight exit', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 540, os: 'exit', fix: 'none' }, //                    garage, no fix; stream dies
        { at: 541, verify: 0, gps: 'uncertain' },
        { at: 543, verify: 1, gps: 'uncertain' },
        { at: 545, verify: 2, gps: 'uncertain' },
        { at: 1410, foreground: true, gps: 'inside' }, //          next morning, opens the app at work before the OS enter
        { at: 1412, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: DAY + 30, foreground: true, gps: 'inside' },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([
        [s.at(0), s.at(540)],
        [s.at(1410), null],
      ]);
      expect(s.capNotifications()).toHaveLength(0);
    });

    it('R2b: a verification check delayed by doze until the next morning confirms the overnight exit instead of cancelling it', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 540, os: 'exit', fix: 'none' },
        { at: 1410, verify: 0, gps: 'inside' },
      ]);
      const sessions = await s.sessions();
      expect(sessions[0].clockOut).toBe(s.at(540));
      expect(sessions[1]?.clockIn).toBe(s.at(1410));
    });

    it('R3: a lone GPS jump hours earlier does not backdate the real departure', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 55, keepalive: 'inside', accuracy: 20 },
        { at: 60, keepalive: 'outside', accuracy: 20 }, //  a jump far out
        { at: 62, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 65, keepalive: 'inside', accuracy: 20 },
        { at: 475, keepalive: 'inside', accuracy: 20 },
        { at: 480, keepalive: 'outside', accuracy: 25 },
        { at: 485, keepalive: 'outside', accuracy: 25 },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].clockOut).toBe(s.at(480));
    });

    it('R4: after a manual clock-out the heartbeat does not start a new session while the user lingers', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 480, manual: 'out' }, //                     done for the day, stays for dinner
        { at: 485, keepalive: 'inside', accuracy: 20 },
        { at: 490, keepalive: 'inside', accuracy: 20 },
        { at: 600, keepalive: 'outside', accuracy: 25 }, // went home: clears the suppression
        { at: 605, keepalive: 'outside', accuracy: 25 },
        { at: DAY, os: 'enter', fix: { where: 'inside', accuracy: 20 } }, // next day: tracked again
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([
        [s.at(0), s.at(480)],
        [s.at(DAY), null],
      ]);
    });

    it('R5: a batch and a live stream of the same fixes produce the same record', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        {
          at: 40,
          batch: [
            { where: 'outside', accuracy: 25, fixAt: 20 },
            { where: 'outside', accuracy: 25, fixAt: 22 },
            { where: 'inside', accuracy: 20, fixAt: 24 },
          ],
        },
        { at: 45, foreground: true, gps: 'inside' },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].state).toBe('active');
    });

    it('R6: an inside ping three seconds after a no-fix exit is not debounced away', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 60, os: 'exit', fix: 'none' },
        { at: 60.05, keepalive: 'inside', accuracy: 20 }, // cancels the exit (and its verification checks)
        { at: 160, foreground: true, gps: 'uncertain' },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].state).toBe('active');
    });

    it('R7: two keepalive payloads arriving together are both processed', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 60, os: 'exit', fix: 'none' },
        {
          at: 62,
          concurrentBatches: [
            [{ where: 'uncertain', accuracy: 20, fixAt: 61 }],
            [{ where: 'inside', accuracy: 20, fixAt: 62 }],
          ],
        },
        { at: 160, foreground: true, gps: 'uncertain' },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].state).toBe('active');
    });

    it('R8: an arrival delivered late, after the cap has closed the stuck session, still starts the new day', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: DAY + 5, os: 'enter', fix: { where: 'inside', accuracy: 20 }, fixAt: DAY - 10 },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[1].state).toBe('active');
    });

    it('R9: a tight fix 30 m past the edge on an OS exit is not a departure (exit margin)', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 120, os: 'exit', fix: { where: 'near', accuracy: 20 } },
        { at: 127, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 8 * HOUR, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].clockOut).toBe(s.at(8 * HOUR));
    });

    it('R10: an OS exit carrying an old inside fix never becomes an exit dated at that fix', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 60, os: 'exit', fix: { where: 'inside', accuracy: 20 }, fixAt: 56 },
        { at: 160, foreground: true, gps: 'uncertain' },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].state).toBe('active');
    });

    it('R11: a two-hour basement stay with a live heartbeat stays one session; a five-hour one splits (gap rule, documented)', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 60, os: 'exit', fix: 'none' }, //              down to the basement
        { at: 65, keepalive: 'uncertain', accuracy: 20 }, //  no usable fixes down there, but the stream is alive
        { at: 90, keepalive: 'uncertain', accuracy: 20 },
        { at: 180, os: 'enter', fix: { where: 'inside', accuracy: 20 } }, // back upstairs after 2 h
        { at: 8 * HOUR, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].clockOut).toBe(s.at(8 * HOUR));

      const t = await setupScenario((db) => new TrackingManagerAndroid(db), BASE + 2 * DAY * 60 * 1000);
      try {
        await replay(t.db, t.manager, t.place, t.base, [
          { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
          { at: 60, os: 'exit', fix: 'none' },
          { at: 65, keepalive: 'uncertain', accuracy: 20 },
          { at: 90, keepalive: 'uncertain', accuracy: 20 },
          { at: 360, os: 'enter', fix: { where: 'inside', accuracy: 20 } }, // 5 h later
        ]);
        const later = await t.sessions();
        expect(later.map((x) => [x.clockIn, x.clockOut])).toEqual([
          [t.at(0), t.at(60)],
          [t.at(360), null],
        ]);
      } finally {
        await t.db.close();
      }
    });

    it('R12: a verification check that finds the user inside cannot cancel a NEWER pending exit', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 60, os: 'exit', fix: { where: 'outside', accuracy: 60 } },
        { at: 62, os: 'enter', fix: { where: 'inside', accuracy: 15 } },
        { at: 64, os: 'exit', fix: { where: 'outside', accuracy: 60 } },
        { at: 65, verify: 0, gps: 'outside' },
        { at: 67, verify: 1, gps: 'outside' },
        { at: 69, verify: 2, gps: 'outside' },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].clockOut).toBe(s.at(64));
    });
  });

  // ---------------------------------------------------------------------------
  // Adversarial review, round 2 (2026-09-28): six wrong records the first
  // rebuild wrote, confirmed by running. Platform fact behind several of them:
  // the app re-registers its fences on every foreground and Android then fires
  // an initial-trigger enter/exit — so every app open is an OS callback
  // (`appOpen` step). "lastSeen" notices carry data.lastSeen.
  // ---------------------------------------------------------------------------

  describe('review round 2', () => {
    const lastSeenNotices = () =>
      s.capNotifications().filter(([req]: any) => req?.content?.data?.lastSeen === true);

    it('S1: hours of uncertain pings in the basement with a live heartbeat, then the app opened upstairs: one session', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 60, os: 'exit', fix: 'none' },
        ...[65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295].map(
          (at) => ({ at, keepalive: 'uncertain' as const, accuracy: 20 })
        ),
        { at: 300, appOpen: { where: 'inside', accuracy: 15 } },
        ...[305, 310, 315, 320].map((at) => ({ at, keepalive: 'inside' as const, accuracy: 20 })),
        { at: 485, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(485)]]);
    });

    it('S1b: no exit at all, only uncertain pings for five hours, app opened: still one session', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...Array.from({ length: 59 }, (_, i) => ({ at: 5 + i * 5, keepalive: 'uncertain' as const, accuracy: 20 })),
        { at: 300, appOpen: { where: 'inside', accuracy: 15 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].state).toBe('active');
    });

    it('S2: opening the app after a manual clock-out, still at work, does not start a phantom session', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...[5, 10, 15].map((at) => ({ at, keepalive: 'inside' as const, accuracy: 20 })),
        { at: 480, manual: 'out' },
        { at: 485, keepalive: 'inside', accuracy: 20 },
        { at: 500, appOpen: { where: 'inside', accuracy: 15 } }, // checks the hours
        ...[505, 510].map((at) => ({ at, keepalive: 'inside' as const, accuracy: 20 })),
        { at: 600, os: 'exit', fix: { where: 'outside', accuracy: 20 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(480)]]);
    });

    it('S3a: heartbeat dies mid-shift, the departure is missed, the app is opened outside hours later: closed where last seen', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...Array.from({ length: 60 }, (_, i) => ({ at: 5 + i * 5, keepalive: 'inside' as const, accuracy: 20 })), // to 300, then dead
        { at: 900, appOpen: { where: 'outside', accuracy: 15 } },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(300)]]);
      expect(lastSeenNotices()).toHaveLength(1);
    });

    it('S3b: …and if nothing is heard until after the cap, the cap closes at the last inside evidence, not at +24 h', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...Array.from({ length: 60 }, (_, i) => ({ at: 5 + i * 5, keepalive: 'inside' as const, accuracy: 20 })),
        { at: DAY + 120, foreground: true, gps: 'outside' },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(300)]]);
    });

    it('S3c: a headless OS exit at the real departure time after the heartbeat died is trusted', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...Array.from({ length: 60 }, (_, i) => ({ at: 5 + i * 5, keepalive: 'inside' as const, accuracy: 20 })),
        { at: 480, os: 'exit', fix: { where: 'outside', accuracy: 20 } }, // not an app open: a real transition
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(480)]]);
    });

    it('S3d: living 30 m past the edge (tight fixes) is outside the plain fence: no inside evidence, the exit stands', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...Array.from({ length: 95 }, (_, i) => ({ at: 5 + i * 5, keepalive: 'inside' as const, accuracy: 20 })), // to 475
        { at: 480, os: 'exit', fix: { where: 'near', accuracy: 15 } },
        ...Array.from({ length: 12 }, (_, i) => ({ at: 485 + i * 5, keepalive: 'near' as const, accuracy: 15 })), // at home, 230 m out
        { at: 560, keepalive: 'outside', accuracy: 15 }, // a walk further away
        { at: 565, keepalive: 'outside', accuracy: 15 },
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].state).toBe('completed');
      // 'near' fixes are uncertain for exits (within the margin) but NOT inside: they
      // never cancel the exit; the first clearly-outside fix proves it, dated where
      // the user was last clearly outside the fence... i.e. at the exit or later.
      expect(sessions[0].clockOut! <= s.at(560)).toBe(true);
      expect(sessions[0].clockOut! >= s.at(480)).toBe(true);
    });

    it('S4a: a heartbeat that died and restarted later does not count as alive during the exit window', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        ...Array.from({ length: 60 }, (_, i) => ({ at: 5 + i * 5, keepalive: 'inside' as const, accuracy: 20 })), // to 300, then dead
        { at: 600, os: 'exit', fix: 'none' }, //                      real, headless
        { at: 700, keepalive: 'uncertain', accuracy: 20 }, //        process restarted: coarse first fix
        { at: 705, keepalive: 'outside', accuracy: 25 },
        { at: 710, keepalive: 'outside', accuracy: 25 },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(600)]]);
    });

    it('S5: one jitter ping past the edge does not lift the manual-clock-out suppression', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 480, manual: 'out' },
        { at: 485, keepalive: 'inside', accuracy: 20 },
        { at: 490, keepalive: 'near', accuracy: 20 },
        { at: 495, keepalive: 'inside', accuracy: 20 },
        { at: 500, keepalive: 'inside', accuracy: 20 },
      ]);
      const sessions = await s.sessions();
      expect(sessions.map((x) => [x.clockIn, x.clockOut])).toEqual([[s.at(0), s.at(480)]]);
    });

    it('S6: the suppression expires on its own, so the next working day is tracked even without an outside fix or OS enter', async () => {
      await replay(s.db, s.manager, s.place, BASE, [
        { at: 0, os: 'enter', fix: { where: 'inside', accuracy: 20 } },
        { at: 480, manual: 'out' }, // stream dies right after; no outside fix ever seen
        ...Array.from({ length: 16 }, (_, i) => ({ at: DAY + i * 30, keepalive: 'inside' as const, accuracy: 20 })),
      ]);
      const sessions = await s.sessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[1].clockIn).toBe(s.at(DAY));
      expect(sessions[1].state).toBe('active');
    });
  });
});
