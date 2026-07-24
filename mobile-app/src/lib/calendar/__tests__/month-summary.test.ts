import { getMonthSummary } from '../calendar-utils';
import { makeShift, makeRecord, makeAbsence, toMap } from '@/test-utils/calendar-fixtures';

const MONTH = new Date(2025, 2, 15); // March 2025

/** The displayed arithmetic must always hold: overtime === tracked − planned. */
function expectIdentity(summary: ReturnType<typeof getMonthSummary>) {
  expect(summary.overtimeMinutes).toBe(summary.trackedMinutes - summary.plannedMinutes);
}

describe('getMonthSummary', () => {
  it('excludes future planned shifts from all balance values', () => {
    // Today = March 2: one worked day behind us, a big future plan ahead
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-01', startTime: '08:00', duration: 480 }),
      makeShift({ id: 's2', date: '2025-03-10', startTime: '08:00', duration: 480 }),
      makeShift({ id: 's3', date: '2025-03-11', startTime: '08:00', duration: 480 }),
    ]);
    const records = toMap([
      makeRecord({ id: 'r1', date: '2025-03-01', startTime: '08:00', duration: 480 }),
    ]);

    const summary = getMonthSummary(MONTH, instances, records, {}, new Set(), '2025-03-02');

    expect(summary.plannedMinutes).toBe(480); // only March 1; future shifts excluded
    expect(summary.monthPlannedMinutes).toBe(3 * 480); // whole month, for plan-mode display
    expect(summary.trackedMinutes).toBe(480);
    expect(summary.overtimeMinutes).toBe(0);
    expectIdentity(summary);
  });

  it('counts a genuinely missed past shift as negative overtime', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-03', startTime: '08:00', duration: 480 }),
    ]);

    const summary = getMonthSummary(MONTH, instances, {}, {}, new Set(), '2025-03-05');

    expect(summary.overtimeMinutes).toBe(-480);
    expectIdentity(summary);
  });

  it('excludes today entirely, even with a planned shift in progress', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-05', startTime: '08:00', duration: 480 }),
    ]);
    const records = toMap([
      makeRecord({ id: 'r1', date: '2025-03-05', startTime: '08:00', duration: 240 }),
    ]);

    const summary = getMonthSummary(MONTH, instances, records, {}, new Set(), '2025-03-05');

    expect(summary.plannedMinutes).toBe(0);
    expect(summary.trackedMinutes).toBe(0);
    expect(summary.overtimeMinutes).toBe(0);
    expectIdentity(summary);
  });

  it('subtracts absence overlap from planned (vacation day with planned shift is not missed work)', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-03', startTime: '08:00', duration: 480 }),
    ]);
    const absences = toMap([
      makeAbsence({ id: 'a1', date: '2025-03-03', type: 'vacation' }),
    ]);

    const summary = getMonthSummary(MONTH, instances, {}, absences, new Set(), '2025-03-10');

    expect(summary.plannedMinutes).toBe(0);
    expect(summary.overtimeMinutes).toBe(0);
    expect(summary.vacationDays).toBe(1);
    expectIdentity(summary);
  });

  it('splits an overnight shift at the elapsed-day cutoff consistently for planned and tracked', () => {
    // 22:00-06:00 shift starting the day before "today": only the 120 min
    // before midnight count, on both sides of the ledger.
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-04', startTime: '22:00', duration: 480 }),
    ]);
    const records = toMap([
      makeRecord({ id: 'r1', date: '2025-03-04', startTime: '22:00', duration: 480 }),
    ]);

    const summary = getMonthSummary(MONTH, instances, records, {}, new Set(), '2025-03-05');

    expect(summary.plannedMinutes).toBe(120); // 22:00-24:00 on March 4 only
    expect(summary.trackedMinutes).toBe(120);
    expect(summary.overtimeMinutes).toBe(0);
    expectIdentity(summary);
  });

  it('counts eligible and confirmed days over elapsed days with activity only', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-01', startTime: '08:00', duration: 480 }),
      makeShift({ id: 's2', date: '2025-03-02', startTime: '08:00', duration: 480 }),
      makeShift({ id: 's3', date: '2025-03-20', startTime: '08:00', duration: 480 }), // future
    ]);
    const absences = toMap([
      makeAbsence({ id: 'a1', date: '2025-03-03', type: 'sick' }),
    ]);
    // March 4-9 elapsed but empty -> not eligible
    const summary = getMonthSummary(
      MONTH,
      instances,
      {},
      absences,
      new Set(['2025-03-01', '2025-03-03']),
      '2025-03-10',
    );

    expect(summary.eligibleDayCount).toBe(3); // Mar 1, 2 (shifts) + Mar 3 (sick)
    expect(summary.confirmedDayCount).toBe(2);
  });

  it('returns all zeros for a fully future month while still counting month absences', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-10', startTime: '08:00', duration: 480 }),
    ]);
    const absences = toMap([
      makeAbsence({ id: 'a1', date: '2025-03-12', type: 'vacation' }),
    ]);

    const summary = getMonthSummary(MONTH, instances, {}, absences, new Set(), '2025-02-20');

    expect(summary.plannedMinutes).toBe(0);
    expect(summary.monthPlannedMinutes).toBe(480); // plan-mode footer shows this
    expect(summary.trackedMinutes).toBe(0);
    expect(summary.overtimeMinutes).toBe(0);
    expect(summary.eligibleDayCount).toBe(0);
    expect(summary.confirmedDayCount).toBe(0);
    expect(summary.vacationDays).toBe(1); // absence chips stay month-scoped
    expectIdentity(summary);
  });

  it('full-day absence covers a shift ending exactly at midnight (no phantom minute)', () => {
    // 16:00-24:00 shift; the old 23:59 absence window left 1 planned minute
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-03', startTime: '16:00', duration: 480 }),
    ]);
    const absences = toMap([
      makeAbsence({ id: 'a1', date: '2025-03-03', type: 'vacation' }),
    ]);

    const summary = getMonthSummary(MONTH, instances, {}, absences, new Set(), '2025-03-10');

    expect(summary.plannedMinutes).toBe(0);
    expect(summary.overtimeMinutes).toBe(0);
    expectIdentity(summary);
  });

  it('full-day absence on a night shift start date also covers the post-midnight spill', () => {
    // 22:00-06:00 shift dated March 4, vacation dated March 4 only:
    // neither March 4 (120 min) nor March 5 (360 min spill) counts as missed work
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-04', startTime: '22:00', duration: 480 }),
    ]);
    const absences = toMap([
      makeAbsence({ id: 'a1', date: '2025-03-04', type: 'vacation' }),
    ]);

    const summary = getMonthSummary(MONTH, instances, {}, absences, new Set(), '2025-03-10');

    expect(summary.plannedMinutes).toBe(0);
    expect(summary.overtimeMinutes).toBe(0);
    expectIdentity(summary);
  });

  it('overlapping partial absences do not double-subtract from planned', () => {
    // Shift 08:00-16:00; vacation 08:00-12:00 + sick 10:00-14:00 union to
    // 08:00-14:00 -> 120 planned minutes remain (14:00-16:00), not 0
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-03', startTime: '08:00', duration: 480 }),
    ]);
    const absences = toMap([
      makeAbsence({ id: 'a1', date: '2025-03-03', type: 'vacation', isFullDay: false, startTime: '08:00', endTime: '12:00' }),
      makeAbsence({ id: 'a2', date: '2025-03-03', type: 'sick', isFullDay: false, startTime: '10:00', endTime: '14:00' }),
    ]);

    const summary = getMonthSummary(MONTH, instances, {}, absences, new Set(), '2025-03-10');

    expect(summary.plannedMinutes).toBe(120);
    expect(summary.overtimeMinutes).toBe(-120); // not worked -> genuinely missed
    expectIdentity(summary);
  });

  it('attributes only the in-month portion of a boundary-crossing overnight shift to monthPlannedMinutes', () => {
    // March 31 22:00-06:00: 120 min belong to March, 360 min to April
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-31', startTime: '22:00', duration: 480 }),
    ]);

    const march = getMonthSummary(MONTH, instances, {}, {}, new Set(), '2025-03-01');
    const april = getMonthSummary(new Date(2025, 3, 15), instances, {}, {}, new Set(), '2025-03-01');

    expect(march.monthPlannedMinutes).toBe(120);
    expect(april.monthPlannedMinutes).toBe(360);
  });

  it('behaves like a plain full-month sum when the month is entirely in the past', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-03', startTime: '08:00', duration: 480 }),
    ]);
    const records = toMap([
      makeRecord({ id: 'r1', date: '2025-03-03', startTime: '08:00', duration: 540 }),
    ]);

    const summary = getMonthSummary(MONTH, instances, records, {}, new Set(), '2025-04-15');

    expect(summary.overtimeMinutes).toBe(60);
    expect(summary.trackedMinutes).toBe(540);
    expect(summary.plannedMinutes).toBe(480);
    expectIdentity(summary);
  });
});
