import type { CalendarExportWindow } from './CalendarExportTypes';

export const DEFAULT_EXPORT_HORIZON_DAYS = 365;

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return formatDateKey(next);
}

export function createCalendarExportWindow(
  now: Date = new Date(),
  horizonDays: number = DEFAULT_EXPORT_HORIZON_DAYS,
): CalendarExportWindow {
  const todayStart = startOfLocalDay(now);
  const lastIncludedDay = addLocalDays(todayStart, horizonDays);

  return {
    todayStart,
    horizonEndExclusive: addLocalDays(lastIncludedDay, 1),
    queryStartDate: formatDateKey(addLocalDays(todayStart, -1)),
    queryEndDate: formatDateKey(lastIncludedDay),
    horizonDays,
  };
}

export function isWithinCalendarExportWindow(
  startDate: Date,
  endDate: Date,
  window: CalendarExportWindow,
): boolean {
  return endDate > window.todayStart && startDate < window.horizonEndExclusive;
}
