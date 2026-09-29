import { computeActualMinutesFromSessions } from '../time-calculations';

// Local-time sessions (the helper works in local time like the calendar)
const iso = (y: number, m: number, d: number, h: number, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

describe('computeActualMinutesFromSessions', () => {
  it('sums completed sessions and subtracts the calendar break by record id', () => {
    const sessions = [
      { id: 'a', clockIn: iso(2026, 9, 21, 9, 5), clockOut: iso(2026, 9, 21, 12, 40) }, // 215 min
      { id: 'b', clockIn: iso(2026, 9, 21, 16, 22), clockOut: iso(2026, 9, 21, 17, 45) }, // 83 min
    ];
    expect(computeActualMinutesFromSessions('2026-09-21', sessions)).toBe(298);
    expect(computeActualMinutesFromSessions('2026-09-21', sessions, { 'tracking-session-a': 15 })).toBe(283);
  });

  it('splits an overnight session per day and spreads its break proportionally', () => {
    const sessions = [{ id: 'n', clockIn: iso(2026, 9, 24, 22, 0), clockOut: iso(2026, 9, 25, 2, 0) }]; // 240 min
    const breaks = { 'tracking-session-n': 60 };
    expect(computeActualMinutesFromSessions('2026-09-24', sessions, breaks)).toBe(120 - 30);
    expect(computeActualMinutesFromSessions('2026-09-25', sessions, breaks)).toBe(120 - 30);
  });

  it('skips open sessions unless includeActive, then counts up to now', () => {
    const sessions = [{ id: 'o', clockIn: iso(2026, 9, 21, 8, 0), clockOut: null }];
    expect(computeActualMinutesFromSessions('2026-09-21', sessions)).toBe(0);
    expect(
      computeActualMinutesFromSessions('2026-09-21', sessions, {}, { includeActive: true, now: new Date(2026, 8, 21, 9, 30) })
    ).toBe(90);
  });

  it('never goes negative when the break exceeds the overlap', () => {
    const sessions = [{ id: 'x', clockIn: iso(2026, 9, 21, 9, 0), clockOut: iso(2026, 9, 21, 9, 10) }];
    expect(computeActualMinutesFromSessions('2026-09-21', sessions, { 'tracking-session-x': 60 })).toBe(0);
  });
});
