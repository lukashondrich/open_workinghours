import {
  createCalendarExportWindow,
  formatDateKey,
  isWithinCalendarExportWindow,
  startOfLocalDay,
} from '../CalendarExportDateWindow';

describe('CalendarExportDateWindow', () => {
  it('builds a today-forward window and widens the query start by one day', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 15, 45), 365);

    expect(formatDateKey(window.todayStart)).toBe('2026-04-27');
    expect(window.queryStartDate).toBe('2026-04-26');
    expect(window.queryEndDate).toBe('2027-04-27');
    expect(formatDateKey(window.horizonEndExclusive)).toBe('2027-04-28');
  });

  it('includes an overnight event that started yesterday but ends today', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 9, 0), 365);
    const startDate = new Date(2026, 3, 26, 22, 0, 0, 0);
    const endDate = new Date(2026, 3, 27, 6, 0, 0, 0);

    expect(isWithinCalendarExportWindow(startDate, endDate, window)).toBe(true);
  });

  it('excludes fully historical events', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 9, 0), 365);
    const startDate = new Date(2026, 3, 26, 8, 0, 0, 0);
    const endDate = new Date(2026, 3, 26, 16, 0, 0, 0);

    expect(isWithinCalendarExportWindow(startDate, endDate, window)).toBe(false);
  });

  it('normalizes an arbitrary timestamp to local midnight', () => {
    const midnight = startOfLocalDay(new Date(2026, 3, 27, 23, 59, 59, 999));

    expect(midnight.getHours()).toBe(0);
    expect(midnight.getMinutes()).toBe(0);
    expect(midnight.getSeconds()).toBe(0);
  });
});
