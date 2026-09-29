import { getWeekSummary, getMonthSummary } from '../calendar-utils';
import { makeShift, makeRecord, makeAbsence, toMap } from '@/test-utils/calendar-fixtures';

// Monday 2025-03-10 … Sunday 2025-03-16
const WEEK_START = new Date(2025, 2, 10);

describe('getWeekSummary', () => {
  it('sums elapsed days of the calendar week only and keeps the overtime identity', () => {
    const instances = toMap([
      makeShift({ id: 's1', date: '2025-03-10', startTime: '08:00', duration: 480 }),
      makeShift({ id: 's2', date: '2025-03-12', startTime: '08:00', duration: 480 }),
      makeShift({ id: 's3', date: '2025-03-17', startTime: '08:00', duration: 480 }), // next week
    ]);
    const records = toMap([
      makeRecord({ id: 'r1', date: '2025-03-10', startTime: '08:00', duration: 540 }),
      makeRecord({ id: 'r2', date: '2025-03-09', startTime: '08:00', duration: 480 }), // previous week
    ]);

    const summary = getWeekSummary(WEEK_START, instances, records, {}, new Set(['2025-03-10']), '2025-03-12');

    expect(summary.trackedMinutes).toBe(540);
    expect(summary.plannedMinutes).toBe(480); // Mon only — Wed is today, not elapsed
    expect(summary.monthPlannedMinutes).toBe(2 * 480); // whole week's plan, next week excluded
    expect(summary.overtimeMinutes).toBe(summary.trackedMinutes - summary.plannedMinutes);
    expect(summary.eligibleDayCount).toBe(2); // Mon, Tue
    expect(summary.confirmedDayCount).toBe(1);
    expect(summary.hasElapsedDays).toBe(true);
  });

  it('accepts any date inside the week (state.currentWeekStart is not the Monday)', () => {
    const records = toMap([makeRecord({ id: 'r1', date: '2025-03-10', startTime: '08:00', duration: 60 })]);
    const fromSunday = getWeekSummary(new Date(2025, 2, 16, 13, 7), {}, records, {}, new Set(), '2025-03-17');
    expect(fromSunday.trackedMinutes).toBe(60);
    expect(fromSunday.hasElapsedDays).toBe(true);
  });

  it('is in plan mode for a future week', () => {
    const instances = toMap([makeShift({ id: 's1', date: '2025-03-11', startTime: '08:00', duration: 480 })]);
    const summary = getWeekSummary(WEEK_START, instances, {}, {}, new Set(), '2025-03-03');
    expect(summary.hasElapsedDays).toBe(false);
    expect(summary.monthPlannedMinutes).toBe(480);
    expect(summary.plannedMinutes).toBe(0);
  });

  it('agrees with the month summary when the week holds all the data', () => {
    const instances = toMap([makeShift({ id: 's1', date: '2025-03-11', startTime: '08:00', duration: 480 })]);
    const records = toMap([makeRecord({ id: 'r1', date: '2025-03-11', startTime: '08:00', duration: 500 })]);
    const week = getWeekSummary(WEEK_START, instances, records, {}, new Set(), '2025-03-13');
    const month = getMonthSummary(new Date(2025, 2, 15), instances, records, {}, new Set(), '2025-03-13');
    expect(week.trackedMinutes).toBe(month.trackedMinutes);
    expect(week.plannedMinutes).toBe(month.plannedMinutes);
    expect(week.overtimeMinutes).toBe(month.overtimeMinutes);
  });

  it('splits an overnight record on the week boundary: only the Monday tail counts', () => {
    // Sunday 2025-03-09 22:00 → Monday 02:00, 4 h; the week starts Monday 03-10
    const records = toMap([makeRecord({ id: 'r1', date: '2025-03-09', startTime: '22:00', duration: 240 })]);
    const summary = getWeekSummary(WEEK_START, {}, records, {}, new Set(), '2025-03-12');
    expect(summary.trackedMinutes).toBe(120);
  });

  it('an absence covering a planned shift removes it from planned', () => {
    const instances = toMap([makeShift({ id: 's1', date: '2025-03-10', startTime: '08:00', duration: 480 })]);
    const absences = toMap([makeAbsence({ id: 'a1', date: '2025-03-10', type: 'vacation' })]);
    const summary = getWeekSummary(WEEK_START, instances, {}, absences, new Set(), '2025-03-12');
    expect(summary.plannedMinutes).toBe(0);
    expect(summary.vacationDays).toBe(1);
  });

  it('days before the account start are not eligible for confirmation', () => {
    const summary = getWeekSummary(WEEK_START, {}, {}, {}, new Set(), '2025-03-14', '2025-03-12');
    expect(summary.eligibleDayCount).toBe(2); // Wed 12, Thu 13
  });
});
