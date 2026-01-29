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
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 0, 0);
    return { start, end };
  }
  const [startHour, startMinute] = absence.startTime.split(':').map(Number);
  const [endHour, endMinute] = absence.endTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  const end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  return { start, end };
}

/**
 * Effective planned minutes for a date, subtracting absence overlaps.
 * Works in absolute time so overnight shifts are handled correctly.
 * For each shift that overlaps the day, computes:
 *   clipped_shift ∩ day_bounds - Σ(clipped_shift ∩ absence ∩ day_bounds)
 */
export function computeEffectivePlannedMinutesForDate(
  instances: Record<string, ShiftInstance>,
  absences: AbsenceInstance[],
  dateKey: string,
): number {
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

  return Object.values(instances).reduce((total, instance) => {
    const { start: shiftStart, end: shiftEnd } = getInstanceWindow(instance);

    // Clip shift to day bounds
    const clippedStart = shiftStart > dayStart ? shiftStart : dayStart;
    const clippedEnd = shiftEnd < dayEnd ? shiftEnd : dayEnd;
    if (clippedStart >= clippedEnd) return total;

    let shiftMinutes = Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 60000);

    // Subtract overlap with each absence (also clipped to day bounds)
    for (const absence of absences) {
      const { start: absStart, end: absEnd } = getAbsenceWindow(absence);
      // Triple intersection: shift ∩ absence ∩ day
      const overlapStart = new Date(Math.max(clippedStart.getTime(), absStart.getTime()));
      const overlapEnd = new Date(Math.min(clippedEnd.getTime(), absEnd.getTime()));
      const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
      if (overlapMs > 0) {
        shiftMinutes -= Math.round(overlapMs / 60000);
      }
    }

    return total + Math.max(0, shiftMinutes);
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
