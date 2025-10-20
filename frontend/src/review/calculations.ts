import {
  addMinutes,
  minutesBetween,
  parseDateTime,
  roundHours,
  splitRangeByMidnight,
  startOfDay,
  startOfWeek,
  toDateKey,
  formatLocalDateTime
} from "../lib/time";

import { BreakSegment, DayReviewRecord, ReviewDataset, ShiftSegment, ShiftCategory } from "./fixtures";

export interface DayTotals {
  date: string;
  scheduledMinutes: number;
  actualMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  onCallCreditMinutes: number;
}

export interface WeekTotals extends DayTotals {
  weekStart: string;
}

export interface TimelineSegment {
  id: string;
  dayKey: string;
  category: ShiftCategory;
  start: Date;
  end: Date;
  original: ShiftSegment;
  breaks: Array<{ start: Date; end: Date }>;
  connectsToNextDay: boolean;
  connectsFromPreviousDay: boolean;
}

export function computeScheduledMinutes(segment: { start: string; end: string }): number {
  const start = parseDateTime(segment.start);
  const end = parseDateTime(segment.end);
  return Math.max(0, minutesBetween(start, end));
}

export function computeBreakMinutes(segment: ShiftSegment): number {
  if (!segment.breaks.length) {
    return 0;
  }
  return segment.breaks.reduce((total, current) => {
    const start = parseDateTime(current.start);
    const end = parseDateTime(current.end);
    return total + Math.max(0, minutesBetween(start, end));
  }, 0);
}

export function computeActualMinutes(segment: ShiftSegment): number {
  const start = parseDateTime(segment.start);
  const end = parseDateTime(segment.end);
  const total = Math.max(0, minutesBetween(start, end));
  return Math.max(0, total - computeBreakMinutes(segment));
}

export function computeShiftTotals(
  segment: ShiftSegment,
  onCallCreditPct: number
): {
  workMinutes: number;
  creditMinutes: number;
  breakMinutes: number;
} {
  const workMinutes = computeActualMinutes(segment);
  const breakMinutes = computeBreakMinutes(segment);
  const appliedPct = segment.category === "oncall" ? onCallCreditPct : 0;
  const creditMinutes = segment.category === "oncall" ? Math.round((workMinutes * appliedPct) / 100) : 0;
  return { workMinutes, creditMinutes, breakMinutes };
}

export function computeDayTotals(day: DayReviewRecord, onCallCreditPct: number): DayTotals {
  const scheduledMinutes = day.scheduled.reduce((total, segment) => total + computeScheduledMinutes(segment), 0);
  let actualMinutes = 0;
  let breakMinutes = 0;
  let creditMinutes = 0;
  day.actual.forEach((segment) => {
    const totals = computeShiftTotals(segment, onCallCreditPct);
    actualMinutes += totals.workMinutes;
    breakMinutes += totals.breakMinutes;
    creditMinutes += totals.creditMinutes;
  });
  const overtimeMinutes = Math.max(actualMinutes - scheduledMinutes, 0);
  return {
    date: day.date,
    scheduledMinutes,
    actualMinutes,
    breakMinutes,
    overtimeMinutes,
    onCallCreditMinutes: creditMinutes
  };
}

export function computeWeekTotals(
  weekDays: DayReviewRecord[],
  onCallCreditPct: number
): WeekTotals {
  if (weekDays.length === 0) {
    throw new Error("Cannot compute totals for empty week");
  }
  const totals = weekDays.map((day) => computeDayTotals(day, onCallCreditPct));
  const aggregate = totals.reduce(
    (acc, current) => {
      acc.scheduledMinutes += current.scheduledMinutes;
      acc.actualMinutes += current.actualMinutes;
      acc.breakMinutes += current.breakMinutes;
      acc.overtimeMinutes += current.overtimeMinutes;
      acc.onCallCreditMinutes += current.onCallCreditMinutes;
      return acc;
    },
    {
      scheduledMinutes: 0,
      actualMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      onCallCreditMinutes: 0
    }
  );
  const firstDate = parseDateTime(`${weekDays[0].date}T00:00`);
  const weekStart = toDateKey(startOfWeek(firstDate));
  return {
    date: weekDays[0].date,
    weekStart,
    scheduledMinutes: aggregate.scheduledMinutes,
    actualMinutes: aggregate.actualMinutes,
    breakMinutes: aggregate.breakMinutes,
    overtimeMinutes: aggregate.overtimeMinutes,
    onCallCreditMinutes: aggregate.onCallCreditMinutes
  };
}

export function buildTimelineSegments(day: DayReviewRecord): TimelineSegment[] {
  return day.actual.flatMap((segment) => {
    const start = parseDateTime(segment.start);
    const end = parseDateTime(segment.end);
    const slices = splitRangeByMidnight({ start, end });
    return slices.map((slice, index) => {
      const dayKey = toDateKey(slice.start);
      const breaks = segment.breaks
        .map((b) => {
          const bStart = parseDateTime(b.start);
          const bEnd = parseDateTime(b.end);
          if (bEnd <= slice.start || bStart >= slice.end) {
            return null;
          }
          const clippedStart = bStart < slice.start ? slice.start : bStart;
          const clippedEnd = bEnd > slice.end ? slice.end : bEnd;
          return { start: clippedStart, end: clippedEnd };
        })
        .filter(Boolean) as Array<{ start: Date; end: Date }>;
      return {
        id: `${segment.id}-slice-${index}`,
        dayKey,
        category: segment.category,
        start: slice.start,
        end: slice.end,
        breaks,
        original: segment,
        connectsFromPreviousDay: index === 0 ? false : true,
        connectsToNextDay: index === slices.length - 1 ? false : true
      };
    });
  });
}

export function hasOverlap(day: DayReviewRecord): boolean {
  const segments = day.actual
    .map((segment) => ({
      start: parseDateTime(segment.start).getTime(),
      end: parseDateTime(segment.end).getTime()
    }))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i].start < segments[i - 1].end) {
      return true;
    }
  }
  return false;
}

export function isEmptyDay(day: DayReviewRecord): boolean {
  return day.actual.length === 0 && day.scheduled.length === 0;
}

export function cloneDataset(dataset: ReviewDataset): ReviewDataset {
  return {
    ...dataset,
    days: dataset.days.map((day) => ({
      ...day,
      scheduled: day.scheduled.map((segment) => ({ ...segment })),
      actual: day.actual.map((segment) => ({
        ...segment,
        breaks: segment.breaks.map((b) => ({ ...b }))
      }))
    }))
  };
}

export function describeTotals(totals: DayTotals): {
  scheduled: string;
  actual: string;
  break: string;
  overtime: string;
  onCall: string;
} {
  return {
    scheduled: formatMinutes(totals.scheduledMinutes),
    actual: formatMinutes(totals.actualMinutes),
    break: formatMinutes(totals.breakMinutes),
    overtime: formatMinutes(totals.overtimeMinutes),
    onCall: formatMinutes(totals.onCallCreditMinutes)
  };
}

export function formatMinutes(minutes: number): string {
  const hours = minutes / 60;
  return `${roundHours(hours).toFixed(1)}h`;
}

export function weekForDate(dataset: ReviewDataset, date: Date): DayReviewRecord[] {
  const weekStart = startOfWeek(date);
  const days = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const currentDate = addMinutes(weekStart, offset * 24 * 60);
    const key = toDateKey(currentDate);
    const match = dataset.days.find((day) => day.date === key);
    if (match) {
      days.push(match);
    } else {
      days.push({
        date: key,
        scheduled: [],
        actual: [],
        reviewed: false
      });
    }
  }
  return days;
}

export function findDay(dataset: ReviewDataset, date: Date): DayReviewRecord | undefined {
  const key = toDateKey(date);
  return dataset.days.find((day) => day.date === key);
}

export function ensureDay(dataset: ReviewDataset, date: Date): DayReviewRecord {
  const existing = findDay(dataset, date);
  if (existing) {
    return existing;
  }
  const newDay: DayReviewRecord = {
    date: toDateKey(date),
    scheduled: [],
    actual: [],
    reviewed: false
  };
  dataset.days.push(newDay);
  dataset.days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return newDay;
}

export function updateBreaks(
  dataset: ReviewDataset,
  segmentId: string,
  replacer: (breaks: BreakSegment[]) => BreakSegment[]
) {
  dataset.days.forEach((day) => {
    day.actual = day.actual.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }
      return {
        ...segment,
        breaks: replacer(segment.breaks.map((br) => ({ ...br })))
      };
    });
  });
}

export function toggleBreakForSegment(
  segment: ShiftSegment,
  timestamp: Date,
  defaultBreakMinutes: number
): BreakSegment[] {
  const segmentStart = parseDateTime(segment.start);
  const segmentEnd = parseDateTime(segment.end);
  if (timestamp < segmentStart || timestamp > segmentEnd) {
    return segment.breaks.map((br) => ({ ...br }));
  }
  const available = Math.max(minutesBetween(segmentStart, segmentEnd), 0);
  if (available < 5) {
    return segment.breaks.map((br) => ({ ...br }));
  }
  const tolerance = Math.max(5, Math.round(defaultBreakMinutes / 2));
  const existingIndex = segment.breaks.findIndex((candidate) => {
    const breakStart = parseDateTime(candidate.start);
    const breakEnd = parseDateTime(candidate.end);
    return timestamp >= addMinutes(breakStart, -tolerance) && timestamp <= addMinutes(breakEnd, tolerance);
  });
  if (existingIndex >= 0) {
    const remaining = segment.breaks.slice();
    remaining.splice(existingIndex, 1);
    return remaining;
  }
  const length = Math.max(defaultBreakMinutes, 5);
  const half = Math.round(length / 2);
  let breakStart = addMinutes(timestamp, -half);
  let breakEnd = addMinutes(timestamp, half);
  if (breakStart < segmentStart) {
    breakStart = segmentStart;
    breakEnd = addMinutes(breakStart, length);
  }
  if (breakEnd > segmentEnd) {
    breakEnd = segmentEnd;
    breakStart = addMinutes(breakEnd, -length);
  }
  if (breakStart < segmentStart) {
    breakStart = segmentStart;
  }
  if (breakEnd > segmentEnd) {
    breakEnd = segmentEnd;
  }
  if (breakEnd <= breakStart) {
    breakEnd = addMinutes(breakStart, Math.min(length, available));
  }
  const duration = Math.max(minutesBetween(breakStart, breakEnd), 0);
  if (duration < 5) {
    breakEnd = addMinutes(breakStart, Math.min(5, available));
  }
  const overlaps = segment.breaks.some((candidate) => {
    const existingStart = parseDateTime(candidate.start);
    const existingEnd = parseDateTime(candidate.end);
    return breakStart < existingEnd && breakEnd > existingStart;
  });
  if (overlaps) {
    return segment.breaks.map((br) => ({ ...br }));
  }
  const newBreak: BreakSegment = {
    id: `${segment.id}-break-${Date.now()}`,
    start: formatLocalDateTime(breakStart),
    end: formatLocalDateTime(breakEnd)
  };
  return [...segment.breaks.map((br) => ({ ...br })), newBreak].sort((a, b) => (a.start < b.start ? -1 : 1));
}
