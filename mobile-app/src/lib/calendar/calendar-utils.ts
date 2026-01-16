import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import type { ShiftColor, ShiftInstance, TrackingRecord, AbsenceInstance } from './types';

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getMonthDays(month: Date): Date[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return eachDayOfInterval({ start, end });
}

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
}

const COLOR_MAP = {
  // Primary brand color (hospital teal/green)
  teal: {
    bg: '#E6F5F1',
    border: '#96D6C8',
    text: '#134532',
    dot: '#2E8B6B',
  },
  blue: {
    bg: '#E3F2FD',
    border: '#90CAF9',
    text: '#0D47A1',
    dot: '#1E88E5',
  },
  indigo: {
    bg: '#E8EAF6',
    border: '#9FA8DA',
    text: '#1A237E',
    dot: '#3949AB',
  },
  amber: {
    bg: '#FFF8E1',
    border: '#FFE082',
    text: '#E65100',
    dot: '#FF8F00',
  },
  rose: {
    bg: '#FCE4EC',
    border: '#F48FB1',
    text: '#880E4F',
    dot: '#D81B60',
  },
  purple: {
    bg: '#F3E5F5',
    border: '#CE93D8',
    text: '#4A148C',
    dot: '#8E24AA',
  },
  // Keep cyan for backwards compatibility, but prefer teal
  cyan: {
    bg: '#E0F7FA',
    border: '#80DEEA',
    text: '#006064',
    dot: '#00ACC1',
  },
} as const;

const CLASS_MAP = {
  // Primary brand color (hospital teal/green)
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-950',
    border: 'border-teal-400 dark:border-teal-600',
    text: 'text-teal-900 dark:text-teal-100',
    dot: 'bg-teal-500',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    border: 'border-blue-400 dark:border-blue-600',
    text: 'text-blue-900 dark:text-blue-100',
    dot: 'bg-blue-500',
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-950',
    border: 'border-indigo-400 dark:border-indigo-600',
    text: 'text-indigo-900 dark:text-indigo-100',
    dot: 'bg-indigo-500',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    border: 'border-amber-400 dark:border-amber-600',
    text: 'text-amber-900 dark:text-amber-100',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-950',
    border: 'border-rose-400 dark:border-rose-600',
    text: 'text-rose-900 dark:text-rose-100',
    dot: 'bg-rose-500',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-950',
    border: 'border-purple-400 dark:border-purple-600',
    text: 'text-purple-900 dark:text-purple-100',
    dot: 'bg-purple-500',
  },
  cyan: {
    bg: 'bg-cyan-100 dark:bg-cyan-950',
    border: 'border-cyan-400 dark:border-cyan-600',
    text: 'text-cyan-900 dark:text-cyan-100',
    dot: 'bg-cyan-500',
  },
} as const;

export function getColorClasses(color: ShiftColor) {
  return CLASS_MAP[color];
}

export function getColorPalette(color: ShiftColor) {
  return COLOR_MAP[color] || COLOR_MAP.teal; // Fallback to teal for unknown colors
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) {
    return `${mins}min`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

/**
 * Check if a new shift would overlap with existing shifts on the same date.
 * Returns the overlapping instance if found, null if no overlap.
 *
 * @param date - The date to check (YYYY-MM-DD)
 * @param startTime - Start time of the new shift (HH:mm)
 * @param duration - Duration in minutes
 * @param instances - All existing instances
 * @param excludeId - Optional instance ID to exclude (for editing existing shifts)
 */
export function findOverlappingShift(
  date: string,
  startTime: string,
  duration: number,
  instances: Record<string, ShiftInstance>,
  excludeId?: string
): ShiftInstance | null {
  const newStart = timeToMinutes(startTime);
  const newEnd = newStart + duration;

  for (const instance of Object.values(instances)) {
    // Skip if different date
    if (instance.date !== date) continue;
    // Skip if this is the instance being edited
    if (excludeId && instance.id === excludeId) continue;

    const existingStart = timeToMinutes(instance.startTime);
    const existingEnd = existingStart + instance.duration;

    // Check for any overlap: new shift starts before existing ends AND new shift ends after existing starts
    if (newStart < existingEnd && newEnd > existingStart) {
      return instance;
    }
  }

  return null;
}

/**
 * Load real tracking records from geofencing sessions in workinghours.db
 *
 * @param startDate - Start date of range (YYYY-MM-DD)
 * @param endDate - End date of range (YYYY-MM-DD)
 * @returns Promise of tracking records by ID
 */
export async function loadRealTrackingRecords(startDate: string, endDate: string): Promise<Record<string, TrackingRecord>> {
  const { getDatabase } = await import('@/modules/geofencing/services/Database');
  const db = await getDatabase();

  // Convert date strings to ISO timestamps for query
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const startIso = new Date(startYear, startMonth - 1, startDay, 0, 0, 0).toISOString();
  const endIso = new Date(endYear, endMonth - 1, endDay, 23, 59, 59).toISOString();

  const sessions = await db.getSessionsBetween(startIso, endIso);

  const trackingRecords: Record<string, TrackingRecord> = {};

  sessions.forEach((session) => {
    const clockInDate = new Date(session.clockIn);

    // For active sessions (no clock-out), use current time as end time
    const isActive = !session.clockOut;
    const clockOutDate = session.clockOut ? new Date(session.clockOut) : new Date();

    // Extract date (YYYY-MM-DD) from clock-in time
    const date = format(clockInDate, 'yyyy-MM-dd');

    // Extract start time (HH:mm)
    const startTime = format(clockInDate, 'HH:mm');

    // Calculate duration in minutes
    const durationMs = clockOutDate.getTime() - clockInDate.getTime();
    const duration = Math.round(durationMs / 60000); // Convert ms to minutes

    // Create tracking record
    const trackingId = `tracking-session-${session.id}`;
    trackingRecords[trackingId] = {
      id: trackingId,
      date,
      startTime,
      duration,
      isActive,
    };
  });

  return trackingRecords;
}

export function generateSimulatedTracking(instances: Record<string, ShiftInstance>): Record<string, TrackingRecord> {
  const trackingRecords: Record<string, TrackingRecord> = {};
  const instancesByDate: Record<string, ShiftInstance[]> = {};
  Object.values(instances).forEach((instance) => {
    if (!instancesByDate[instance.date]) {
      instancesByDate[instance.date] = [];
    }
    instancesByDate[instance.date].push(instance);
  });

  Object.entries(instancesByDate).forEach(([date, dateInstances]) => {
    dateInstances.forEach((instance) => {
      const variance = Math.random();
      let startTime = instance.startTime;
      let duration = instance.duration;
      if (variance < 0.3) {
        const lateMinutes = Math.floor(Math.random() * 4) * 5 + 5;
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + lateMinutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMinutes = totalMinutes % 60;
        startTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
        duration = Math.max(5, duration - lateMinutes);
      } else if (variance < 0.5) {
        const earlyMinutes = Math.floor(Math.random() * 3) * 5 + 5;
        duration = Math.max(5, duration - earlyMinutes);
      } else if (variance < 0.65) {
        const extraMinutes = Math.floor(Math.random() * 5) * 5 + 10;
        duration = duration + extraMinutes;
      }
      const trackingId = `tracking-${date}-${instance.id}`;
      trackingRecords[trackingId] = {
        id: trackingId,
        date,
        startTime,
        duration,
      };
    });
  });

  if (Math.random() < 0.1 && Object.keys(instancesByDate).length > 0) {
    const dates = Object.keys(instancesByDate);
    const randomDate = dates[Math.floor(Math.random() * dates.length)];
    const unexpectedId = `tracking-unexpected-${randomDate}`;
    trackingRecords[unexpectedId] = {
      id: unexpectedId,
      date: randomDate,
      startTime: '14:00',
      duration: 120,
    };
  }

  return trackingRecords;
}

export function generateHourMarkers(): string[] {
  const hours: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    hours.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return hours;
}

export function calculateShiftDisplay(
  startTime: string,
  duration: number,
  slotHeight: number = 40,
): {
  topOffset: number;
  height: number;
  spansNextDay: boolean;
  nextDayHeight: number;
} {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  const minutesInDay = 24 * 60;
  const topOffset = (startMinutes / 60) * slotHeight;
  if (endMinutes <= minutesInDay) {
    return {
      topOffset,
      height: (duration / 60) * slotHeight,
      spansNextDay: false,
      nextDayHeight: 0,
    };
  }
  const remainingMinutesToday = minutesInDay - startMinutes;
  const minutesNextDay = endMinutes - minutesInDay;
  return {
    topOffset,
    height: (remainingMinutesToday / 60) * slotHeight,
    spansNextDay: true,
    nextDayHeight: (minutesNextDay / 60) * slotHeight,
  };
}

export function getInstancesForDate(
  instances: Record<string, ShiftInstance>,
  date: string,
  previousDate: string | null,
): { current: ShiftInstance[]; fromPrevious: ShiftInstance[] } {
  const current = Object.values(instances).filter((instance) => instance.date === date);
  const fromPrevious = previousDate
    ? Object.values(instances).filter((instance) => {
        if (instance.date !== previousDate) return false;
        const startMinutes = timeToMinutes(instance.startTime);
        const endMinutes = startMinutes + instance.duration;
        return endMinutes > 24 * 60;
      })
    : [];
  return { current, fromPrevious };
}

// ========================================
// Absence Helper Functions
// ========================================

/**
 * Get absences for a specific date
 */
export function getAbsencesForDate(
  absences: Record<string, AbsenceInstance>,
  date: string,
): AbsenceInstance[] {
  return Object.values(absences).filter((absence) => absence.date === date);
}

/**
 * Calculate time overlap in minutes between two time ranges on the same day.
 * Handles full-day absences (00:00-23:59 or null times).
 *
 * @param start1 - Start time of first range (HH:mm)
 * @param end1 - End time of first range (HH:mm)
 * @param start2 - Start time of second range (HH:mm)
 * @param end2 - End time of second range (HH:mm)
 * @returns Overlap duration in minutes (0 if no overlap)
 */
export function calculateTimeOverlapMinutes(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): number {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);

  if (overlapStart >= overlapEnd) {
    return 0;
  }

  return overlapEnd - overlapStart;
}

/**
 * Calculate overlap between a shift and an absence on the same day.
 *
 * @param shift - The shift instance
 * @param absence - The absence instance
 * @returns Object with overlap minutes and whether shift is fully covered
 */
export function getShiftAbsenceOverlap(
  shift: ShiftInstance,
  absence: AbsenceInstance,
): { overlapMinutes: number; isFullyOverlapped: boolean } {
  // Different dates = no overlap
  if (shift.date !== absence.date) {
    return { overlapMinutes: 0, isFullyOverlapped: false };
  }

  // Calculate shift end time
  const shiftStartMinutes = timeToMinutes(shift.startTime);
  const shiftEndMinutes = shiftStartMinutes + shift.duration;
  const shiftEnd = `${String(Math.floor(shiftEndMinutes / 60) % 24).padStart(2, '0')}:${String(shiftEndMinutes % 60).padStart(2, '0')}`;

  // For full-day absences, use 00:00-23:59
  const absenceStart = absence.isFullDay ? '00:00' : absence.startTime;
  const absenceEnd = absence.isFullDay ? '23:59' : absence.endTime;

  const overlapMinutes = calculateTimeOverlapMinutes(
    shift.startTime,
    shiftEnd,
    absenceStart,
    absenceEnd,
  );

  const isFullyOverlapped = overlapMinutes >= shift.duration;

  return { overlapMinutes, isFullyOverlapped };
}

/**
 * Calculate effective planned minutes for a day, accounting for absence overlaps.
 *
 * Formula: effectivePlanned = sum(shift durations) - sum(overlap with absences)
 *
 * @param shifts - Shift instances for the day
 * @param absences - Absence instances for the day
 * @returns Effective planned minutes after subtracting absence overlaps
 */
export function calculateEffectivePlannedMinutes(
  shifts: ShiftInstance[],
  absences: AbsenceInstance[],
): number {
  if (shifts.length === 0) return 0;
  if (absences.length === 0) {
    return shifts.reduce((total, shift) => total + shift.duration, 0);
  }

  let totalPlanned = 0;

  for (const shift of shifts) {
    let shiftMinutes = shift.duration;

    // Subtract overlap with each absence
    for (const absence of absences) {
      const { overlapMinutes } = getShiftAbsenceOverlap(shift, absence);
      shiftMinutes -= overlapMinutes;
    }

    // Don't go below 0
    totalPlanned += Math.max(0, shiftMinutes);
  }

  return totalPlanned;
}

/**
 * Check if a shift has any overlap with absences on the same day.
 * Used for visual dimming of shifts.
 *
 * @param shift - The shift to check
 * @param absences - All absence instances
 * @returns true if shift overlaps with any absence
 */
export function shiftHasAbsenceOverlap(
  shift: ShiftInstance,
  absences: Record<string, AbsenceInstance>,
): boolean {
  const dayAbsences = getAbsencesForDate(absences, shift.date);
  return dayAbsences.some((absence) => {
    const { overlapMinutes } = getShiftAbsenceOverlap(shift, absence);
    return overlapMinutes > 0;
  });
}

// ========================================
// Time Range Overlap Helpers
// ========================================

/**
 * Get the start and end timestamps for a given date.
 * Uses exclusive end boundary (next day 00:00:00) for cleaner overlap math.
 *
 * @param dateKey - Date string in YYYY-MM-DD format
 * @returns Object with start (00:00:00) and end (next day 00:00:00)
 */
export function getDayBounds(dateKey: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

/**
 * Compute overlap in minutes between a time range and a day range.
 * Handles overnight sessions correctly.
 *
 * @param start - Start of the time range
 * @param end - End of the time range
 * @param rangeStart - Start of the day range
 * @param rangeEnd - End of the day range
 * @returns Overlap in minutes (0 if no overlap)
 */
export function computeOverlapMinutes(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const effectiveStart = start > rangeStart ? start : rangeStart;
  const effectiveEnd = end < rangeEnd ? end : rangeEnd;
  const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / 60000);
}

/**
 * Get tracked minutes for a specific date, handling multi-day sessions.
 * A session that spans multiple days will have its time split across those days.
 *
 * @param dateKey - The date to calculate for (YYYY-MM-DD)
 * @param trackingRecords - All tracking records
 * @returns Object with trackedMinutes and hasTracking boolean
 */
export function getTrackedMinutesForDate(
  dateKey: string,
  trackingRecords: Record<string, TrackingRecord>
): { trackedMinutes: number; hasTracking: boolean } {
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);
  let trackedMinutes = 0;
  let hasTracking = false;

  for (const record of Object.values(trackingRecords)) {
    // Parse record start time
    const [year, month, day] = record.date.split('-').map(Number);
    const [startHour, startMinute] = record.startTime.split(':').map(Number);
    const recordStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const recordEnd = new Date(recordStart.getTime() + record.duration * 60000);

    // Calculate overlap with this day
    const overlap = computeOverlapMinutes(recordStart, recordEnd, dayStart, dayEnd);

    if (overlap > 0) {
      // Proportionally subtract breaks based on overlap ratio
      const breakMinutes = record.breakMinutes || 0;
      const breakRatio = record.duration > 0 ? overlap / record.duration : 0;
      const proportionalBreak = Math.round(breakMinutes * breakRatio);

      trackedMinutes += overlap - proportionalBreak;
      hasTracking = true;
    }
  }

  return { trackedMinutes: Math.max(0, trackedMinutes), hasTracking };
}

// ========================================
// Month Summary Helper Functions
// ========================================

export interface MonthSummary {
  trackedMinutes: number;
  plannedMinutes: number;
  vacationDays: number;
  sickDays: number;
  confirmedOvertimeMinutes: number;
}

/**
 * Calculate summary statistics for a month.
 *
 * @param month - Any date within the target month
 * @param instances - All shift instances
 * @param trackingRecords - All tracking records
 * @param absenceInstances - All absence instances
 * @param confirmedDates - Set of confirmed date keys
 * @returns Summary with tracked/planned minutes, absence counts, and confirmed overtime
 */
export function getMonthSummary(
  month: Date,
  instances: Record<string, ShiftInstance>,
  trackingRecords: Record<string, TrackingRecord>,
  absenceInstances: Record<string, AbsenceInstance>,
  confirmedDates: Set<string>,
): MonthSummary {
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  let trackedMinutes = 0;
  let plannedMinutes = 0;
  let vacationDays = 0;
  let sickDays = 0;
  let confirmedOvertimeMinutes = 0;

  // Iterate through each day of the month
  let current = start;
  while (current <= end) {
    const dateKey = formatDateKey(current);

    // Calculate day's tracked (handling multi-day sessions)
    const { trackedMinutes: dayTracked } = getTrackedMinutesForDate(dateKey, trackingRecords);

    // Sum planned minutes (from shift instances)
    let dayPlanned = 0;
    Object.values(instances)
      .filter((i) => i.date === dateKey)
      .forEach((i) => {
        dayPlanned += i.duration;
      });

    trackedMinutes += dayTracked;
    plannedMinutes += dayPlanned;

    // Track confirmed overtime
    if (confirmedDates.has(dateKey)) {
      confirmedOvertimeMinutes += dayTracked - dayPlanned;
    }

    // Count absence days (count each day only once per type)
    const absences = getAbsencesForDate(absenceInstances, dateKey);
    if (absences.some((a) => a.type === 'vacation')) vacationDays++;
    if (absences.some((a) => a.type === 'sick')) sickDays++;

    current = addDays(current, 1);
  }

  return { trackedMinutes, plannedMinutes, vacationDays, sickDays, confirmedOvertimeMinutes };
}

/**
 * Format overtime minutes as a human-readable string.
 * Uses "Xh Ym" for >= 1 hour, "Xm" for < 1 hour.
 *
 * @param minutes - Overtime in minutes (can be negative)
 * @returns Formatted string like "+1h 30m", "-45m", "0m"
 */
export function formatOvertimeDisplay(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(minutes);

  if (absMinutes === 0) {
    return '0m';
  }

  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;

  if (hours === 0) {
    return `${sign}${mins}m`;
  }

  if (mins === 0) {
    return `${sign}${hours}h`;
  }

  return `${sign}${hours}h ${mins}m`;
}
