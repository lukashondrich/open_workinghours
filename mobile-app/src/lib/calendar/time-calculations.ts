/**
 * Consolidated time calculation functions.
 * Single source of truth for day bounds, overlap, planned/actual minutes.
 */
import type { ShiftInstance, TrackingRecord, AbsenceInstance } from './types';

/** Returns midnight-to-midnight bounds for a YYYY-MM-DD date key. */
export function getDayBounds(dateKey: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

/** Minutes of overlap between [start,end) and [rangeStart,rangeEnd). */
export function computeOverlapMinutes(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const effectiveStart = start > rangeStart ? start : rangeStart;
  const effectiveEnd = end < rangeEnd ? end : rangeEnd;
  const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / 60000);
}

/** Absolute start/end Date objects for a shift instance. */
export function getInstanceWindow(instance: ShiftInstance): { start: Date; end: Date } {
  const [year, month, day] = instance.date.split('-').map(Number);
  const [startHour, startMinute] = instance.startTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  const end = new Date(start.getTime() + instance.duration * 60000);
  return { start, end };
}

/**
 * Planned minutes for a given date from ALL shift instances.
 * Handles overnight shifts: checks every instance for overlap with the day,
 * regardless of instance.date, so a 22:00-06:00 shift correctly contributes
 * 120 min to day 1 and 360 min to day 2.
 */
export function computePlannedMinutesForDate(
  instances: Record<string, ShiftInstance>,
  dateKey: string,
): number {
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

  return Object.values(instances).reduce((total, instance) => {
    const { start, end } = getInstanceWindow(instance);
    return total + computeOverlapMinutes(start, end, dayStart, dayEnd);
  }, 0);
}

/** Absolute start/end Date objects for an absence instance. */
function getAbsenceWindow(absence: AbsenceInstance): { start: Date; end: Date } {
  const [year, month, day] = absence.date.split('-').map(Number);
  if (absence.isFullDay) {
    // Full midnight-to-midnight — matching getDayBounds. Ending at 23:59
    // left a phantom planned minute on shifts touching midnight.
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    return { start, end };
  }
  const [startHour, startMinute] = absence.startTime.split(':').map(Number);
  const [endHour, endMinute] = absence.endTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  const end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  return { start, end };
}

/** Sum of merged interval lengths in ms — overlapping intervals count once. */
function mergedIntervalMs(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return total;
}

/**
 * Effective planned minutes for a date, subtracting absence overlaps.
 * Works in absolute time so overnight shifts are handled correctly.
 *
 * Takes the FULL absence map (not one day's) so that the coverage rules can
 * see absences on neighboring days — passing a pre-filtered day slice would
 * silently break the night-shift rule below.
 *
 * Coverage rules per shift (clipped to the day bounds):
 * - A full-day absence dated the same day as the SHIFT covers the entire
 *   shift, including any post-midnight spill onto the next day — taking
 *   vacation for a night shift cancels the whole shift, not just the
 *   portion before midnight.
 * - Any other absence covers its time-window intersection with the shift.
 * - Covering intervals are UNIONed before subtracting, so overlapping
 *   absences never double-subtract.
 */
export function computeEffectivePlannedMinutesForDate(
  instances: Record<string, ShiftInstance>,
  absenceInstances: Record<string, AbsenceInstance>,
  dateKey: string,
): number {
  const absences = Object.values(absenceInstances);
  if (absences.length === 0) {
    return computePlannedMinutesForDate(instances, dateKey);
  }

  // Windows are shift-independent — derive them once, not per shift
  const absenceMeta = absences.map((a) => {
    const { start, end } = getAbsenceWindow(a);
    return { isFullDay: a.isFullDay, date: a.date, startMs: start.getTime(), endMs: end.getTime() };
  });

  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

  return Object.values(instances).reduce((total, instance) => {
    const { start: shiftStart, end: shiftEnd } = getInstanceWindow(instance);

    // Clip shift to day bounds
    const clippedStart = shiftStart > dayStart ? shiftStart : dayStart;
    const clippedEnd = shiftEnd < dayEnd ? shiftEnd : dayEnd;
    if (clippedStart >= clippedEnd) return total;

    const shiftMinutes = Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 60000);

    const coverIntervals: Array<[number, number]> = [];
    for (const absence of absenceMeta) {
      if (absence.isFullDay && absence.date === instance.date) {
        // Vacation/sick on the shift's own day cancels the whole shift
        coverIntervals.push([clippedStart.getTime(), clippedEnd.getTime()]);
        continue;
      }
      const overlapStart = Math.max(clippedStart.getTime(), absence.startMs);
      const overlapEnd = Math.min(clippedEnd.getTime(), absence.endMs);
      if (overlapEnd > overlapStart) {
        coverIntervals.push([overlapStart, overlapEnd]);
      }
    }

    const coveredMinutes = Math.round(mergedIntervalMs(coverIntervals) / 60000);
    return total + Math.max(0, shiftMinutes - coveredMinutes);
  }, 0);
}

/**
 * Actual (tracked) minutes from manual TrackingRecords for a date.
 * Clips each record to the day bounds and proportionally splits breaks.
 */
export function computeActualMinutesFromRecords(
  dateKey: string,
  records: TrackingRecord[],
): number {
  if (records.length === 0) return 0;

  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

  return records.reduce((sum, record) => {
    const [year, month, day] = record.date.split('-').map(Number);
    const [startHour, startMinute] = record.startTime.split(':').map(Number);
    const recordStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const recordEnd = new Date(recordStart.getTime() + record.duration * 60000);

    const overlap = computeOverlapMinutes(recordStart, recordEnd, dayStart, dayEnd);
    if (overlap <= 0) return sum;

    const breakMinutes = record.breakMinutes || 0;
    const breakRatio = record.duration > 0 ? overlap / record.duration : 0;
    const proportionalBreak = Math.round(breakMinutes * breakRatio);
    return sum + Math.max(0, overlap - proportionalBreak);
  }, 0);
}

/**
 * Get tracked minutes for a date (same as getTrackedMinutesForDate in calendar-utils).
 * Checks ALL records for overlap with the day — handles overnight records.
 */
export function getTrackedMinutesForDate(
  dateKey: string,
  trackingRecords: Record<string, TrackingRecord>,
): { trackedMinutes: number; hasTracking: boolean } {
  const records = Object.values(trackingRecords);
  const minutes = computeActualMinutesFromRecords(dateKey, records);
  return { trackedMinutes: minutes, hasTracking: minutes > 0 };
}

/**
 * Get tracking records that overlap with a given date.
 * Unlike filtering by record.date === dateKey, this catches overnight records.
 */
export function getTrackingRecordsForDate(
  dateKey: string,
  trackingRecords: Record<string, TrackingRecord>,
): TrackingRecord[] {
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

  return Object.values(trackingRecords).filter((record) => {
    const [year, month, day] = record.date.split('-').map(Number);
    const [startHour, startMinute] = record.startTime.split(':').map(Number);
    const recordStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const recordEnd = new Date(recordStart.getTime() + record.duration * 60000);
    return computeOverlapMinutes(recordStart, recordEnd, dayStart, dayEnd) > 0;
  });
}
