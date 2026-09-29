import {
  computeActualMinutesFromRecords,
  computeActualMinutesFromSessions,
  breakShareForDay,
  getDayBounds,
} from '../time-calculations';

const iso = (y: number, m: number, d: number, h: number, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).toISOString();

describe('break arithmetic agrees between records and sessions', () => {
  it('an overnight session with an odd break deducts exactly the break over both days', () => {
    // 22:00 → 02:00, 45-min break: 23 + 22 (telescoping), never 23 + 23
    const sessions = [{ id: 'n', clockIn: iso(2026, 9, 24, 22), clockOut: iso(2026, 9, 25, 2) }];
    const breaks = { 'tracking-session-n': 45 };
    const records = [{ id: 'tracking-session-n', date: '2026-09-24', startTime: '22:00', duration: 240, breakMinutes: 45 }];

    const s1 = computeActualMinutesFromSessions('2026-09-24', sessions, breaks);
    const s2 = computeActualMinutesFromSessions('2026-09-25', sessions, breaks);
    const r1 = computeActualMinutesFromRecords('2026-09-24', records);
    const r2 = computeActualMinutesFromRecords('2026-09-25', records);

    expect(s1 + s2).toBe(240 - 45);
    expect(r1 + r2).toBe(240 - 45);
    expect([s1, s2]).toEqual([r1, r2]);
  });

  it('a clock-in with seconds still agrees to the minute with the HH:mm record', () => {
    const sessions = [{ id: 'a', clockIn: iso(2026, 9, 21, 9, 5, 20), clockOut: iso(2026, 9, 21, 12, 40, 20) }];
    const records = [{ id: 'tracking-session-a', date: '2026-09-21', startTime: '09:05', duration: 215, breakMinutes: 15 }];
    expect(computeActualMinutesFromSessions('2026-09-21', sessions, { 'tracking-session-a': 15 })).toBe(
      computeActualMinutesFromRecords('2026-09-21', records)
    );
  });

  it('breakShareForDay telescopes to the whole break across any split', () => {
    const start = new Date(2026, 9, 24, 21, 30);
    const end = new Date(2026, 9, 26, 1, 0); // spans three calendar days
    const days = ['2026-10-24', '2026-10-25', '2026-10-26'].map(getDayBounds);
    const total = days.reduce((sum, d) => sum + breakShareForDay(75, start, end, d.start, d.end), 0);
    expect(total).toBe(75);
  });
});
