import {
  ShiftInstance,
  ShiftSegment as PlannerShiftSegment,
  ShiftBreakInstance,
  ShiftType,
  ShiftPlacementRequest,
  DayIndex,
  ShiftConflict,
} from "./types";
import {
  DayReviewRecord,
  ReviewDataset,
  ShiftSegment,
  BreakSegment,
  ShiftCategory,
} from "./fixtures";
import {
  addMinutes as addMinutesToDate,
  minutesBetween,
  minutesToHours,
  parseDateTime,
  roundHours,
  splitRangeByMidnight,
  startOfDay,
  startOfWeek,
  toDateKey,
  formatLocalDateTime,
} from "../lib/time";

const MINUTES_PER_DAY = 24 * 60;

/* -------------------------------------------------------------------------- */
/* Planner helpers (shared with /planner)                                     */
/* -------------------------------------------------------------------------- */

export function cloneDataset<T>(dataset: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(dataset);
  }
  return JSON.parse(JSON.stringify(dataset));
}

export function minutesToHm(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function snapToGrid(minutes: number): number {
  const inDay = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hourRemainder = inDay % 60;

  if (hourRemainder <= 4) {
    return minutes - hourRemainder;
  }

  if (hourRemainder >= 56) {
    return minutes + (60 - hourRemainder);
  }

  const fiveRemainder = hourRemainder % 5;
  if (fiveRemainder <= 2) {
    return minutes - fiveRemainder;
  }

  return minutes + (5 - fiveRemainder);
}

export function computeAbsoluteMinutes(day: DayIndex, minute: number): number {
  return day * MINUTES_PER_DAY + minute;
}

export function computeShiftRange(shift: ShiftInstance): { start: number; end: number } {
  const start = computeAbsoluteMinutes(shift.startDay, shift.startMinute);
  return { start, end: start + shift.durationMinutes };
}

export function computeSegments(shift: ShiftInstance): PlannerShiftSegment[] {
  const { start, end } = computeShiftRange(shift);
  const firstDay = Math.floor(start / MINUTES_PER_DAY);
  const lastDay = Math.floor((end - 1) / MINUTES_PER_DAY);
  const segments: PlannerShiftSegment[] = [];

  for (let absoluteDay = firstDay; absoluteDay <= lastDay; absoluteDay += 1) {
    const dayStart = absoluteDay * MINUTES_PER_DAY;
    const segmentStart = Math.max(dayStart, start);
    const segmentEnd = Math.min(dayStart + MINUTES_PER_DAY, end);
    const day: DayIndex = ((absoluteDay % 7) + 7) % 7 as DayIndex;

    segments.push({
      day,
      startMinute: segmentStart - dayStart,
      endMinute: segmentEnd - dayStart,
      isContinuation: absoluteDay !== firstDay,
      absoluteDayIndex: absoluteDay,
      absoluteStart: segmentStart,
      absoluteEnd: segmentEnd,
    });
  }

  return segments;
}

export function instantiateBreaks(type: ShiftType): ShiftBreakInstance[] {
  return type.defaultBreaks
    .map((definition) => ({
      id: `${definition.id}-${Math.random().toString(36).slice(2, 8)}`,
      offsetMinutes: definition.offsetMinutes,
      durationMinutes: definition.durationMinutes,
    }))
    .filter((brk) => brk.offsetMinutes >= 0 && brk.offsetMinutes + brk.durationMinutes <= type.durationMinutes);
}

export function sanitizeBreaks(shift: ShiftInstance): ShiftBreakInstance[] {
  return shift.breaks.filter(
    (brk) => brk.offsetMinutes >= 0 && brk.offsetMinutes + brk.durationMinutes <= shift.durationMinutes,
  );
}

function generateBreakId(templateId: string) {
  return `${templateId}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureDefaultBreaks(shift: ShiftInstance, type: ShiftType): ShiftInstance {
  const sanitizedBreaks = sanitizeBreaks(shift);
  const requiredTemplates = type.defaultBreaks.filter(
    (tpl) => tpl.offsetMinutes >= 0 && tpl.offsetMinutes + tpl.durationMinutes <= shift.durationMinutes,
  );
  const additions = requiredTemplates
    .filter(
      (tpl) =>
        !sanitizedBreaks.some(
          (brk) => brk.offsetMinutes === tpl.offsetMinutes && brk.durationMinutes === tpl.durationMinutes,
        ),
    )
    .map((tpl) => ({
      id: generateBreakId(tpl.id),
      offsetMinutes: tpl.offsetMinutes,
      durationMinutes: tpl.durationMinutes,
    }));

  if (additions.length === 0 && sanitizedBreaks.length === shift.breaks.length) {
    return shift;
  }

  return {
    ...shift,
    breaks: sanitizeBreaks({
      ...shift,
      breaks: [...sanitizedBreaks, ...additions],
    }),
  };
}

export function projectBreaksToAbsolute(shift: ShiftInstance, breakInstance: ShiftBreakInstance) {
  const { start } = computeShiftRange(shift);
  const breakStart = start + breakInstance.offsetMinutes;
  const breakEnd = breakStart + breakInstance.durationMinutes;
  const breakDayStart = Math.floor(breakStart / MINUTES_PER_DAY);
  return {
    startDay: ((breakDayStart % 7) + 7) % 7 as DayIndex,
    startMinute: breakStart - breakDayStart * MINUTES_PER_DAY,
    endMinute: breakEnd - breakDayStart * MINUTES_PER_DAY,
  };
}

export function createShiftInstance(
  type: ShiftType,
  placement: ShiftPlacementRequest,
  id: string,
): ShiftInstance | Error {
  const snappedStart = snapToGrid(placement.startMinute);
  const normalizedStart = ((snappedStart % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const startDayDelta = Math.floor(snappedStart / MINUTES_PER_DAY);
  const startDayIndex = (placement.startDay + startDayDelta + 7) % 7 as DayIndex;

  return {
    id,
    shiftTypeId: type.id,
    startDay: startDayIndex,
    startMinute: normalizedStart,
    durationMinutes: type.durationMinutes,
    originalDurationMinutes: type.durationMinutes,
    breaks: instantiateBreaks(type),
    edited: false,
    startDateISO: "",
  };
}

export function updateShiftDuration(shift: ShiftInstance, durationMinutes: number): ShiftInstance {
  const updatedDuration = Math.max(5, durationMinutes);
  const edited = updatedDuration !== shift.originalDurationMinutes;

  return {
    ...shift,
    durationMinutes: updatedDuration,
    breaks: sanitizeBreaks({
      ...shift,
      durationMinutes: updatedDuration,
    }),
    edited,
  };
}

export function moveShiftStart(
  shift: ShiftInstance,
  newDay: DayIndex,
  newStartMinute: number,
): ShiftInstance {
  const snapped = snapToGrid(newStartMinute);
  const normalizedStart = ((snapped % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const dayDelta = Math.floor(snapped / MINUTES_PER_DAY);
  const startDayIndex = ((newDay + dayDelta) % 7 + 7) % 7 as DayIndex;

  return {
    ...shift,
    startDay: startDayIndex,
    startMinute: normalizedStart,
  };
}

function isoDateToTimestamp(iso: string, minute: number): number {
  const [year, month, day] = iso.split("-").map(Number);
  const base = new Date(year, month - 1, day).getTime();
  return base + minute * 60000;
}

export function findOverlap(
  shifts: ShiftInstance[],
  candidate: {
    id?: string;
    startDay: DayIndex;
    startMinute: number;
    durationMinutes: number;
    startDateISO?: string;
  },
): ShiftConflict | null {
  const candidateStartMinutes = computeAbsoluteMinutes(candidate.startDay, snapToGrid(candidate.startMinute));
  const candidateEndMinutes = candidateStartMinutes + candidate.durationMinutes;
  const candidateStartMs =
    candidate.startDateISO != null
      ? isoDateToTimestamp(candidate.startDateISO, snapToGrid(candidate.startMinute))
      : null;
  const candidateEndMs = candidateStartMs != null ? candidateStartMs + candidate.durationMinutes * 60000 : null;

  for (const shift of shifts) {
    if (candidate.id && shift.id === candidate.id) {
      continue;
    }

    const { start, end } = computeShiftRange(shift);

    if (candidateStartMs != null && shift.startDateISO) {
      const shiftStartMs = isoDateToTimestamp(shift.startDateISO, shift.startMinute);
      const shiftEndMs = shiftStartMs + shift.durationMinutes * 60000;
      const overlapMs = Math.min(candidateEndMs!, shiftEndMs) - Math.max(candidateStartMs, shiftStartMs);
      if (overlapMs >= 60000) {
        return {
          conflictingShiftId: shift.id,
          conflictingStartMinutes: start,
          conflictingEndMinutes: end,
        };
      }
      continue;
    }

    const overlapStart = Math.max(start, candidateStartMinutes);
    const overlapEnd = Math.min(end, candidateEndMinutes);

    if (overlapEnd - overlapStart >= 1) {
      return {
        conflictingShiftId: shift.id,
        conflictingStartMinutes: start,
        conflictingEndMinutes: end,
      };
    }
  }

  return null;
}

export function formatConflict(conflict: ShiftConflict): string {
  const startHm = minutesToHm(conflict.conflictingStartMinutes);
  const endHm = minutesToHm(conflict.conflictingEndMinutes);
  return `Kollidiert mit bestehender Schicht (${startHm}–${endHm}). Bitte Zeit anpassen.`;
}

export function addMinutes(day: DayIndex, minute: number, delta: number): { day: DayIndex; minute: number } {
  const absolute = computeAbsoluteMinutes(day, minute) + delta;
  const newDay = Math.floor(absolute / MINUTES_PER_DAY);
  const normalizedDay = ((newDay % 7) + 7) % 7 as DayIndex;
  const newMinute = absolute - newDay * MINUTES_PER_DAY;
  return {
    day: normalizedDay,
    minute: newMinute,
  };
}

export function minuteStep(minute: number, delta: number): number {
  return ((minute + delta) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function defaultShiftColors(): string[] {
  return ["#3f51b5", "#009688", "#ff7043", "#8e24aa", "#00796b", "#795548"];
}

/* -------------------------------------------------------------------------- */
/* Review prototype helpers                                                   */
/* -------------------------------------------------------------------------- */

export interface DayTotals {
  scheduledMinutes: number;
  actualMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  onCallCreditMinutes: number;
}

export interface WeekTotals extends DayTotals {
  weekStart: string;
}

function durationMinutes(rangeStart: Date, rangeEnd: Date): number {
  return Math.max(minutesBetween(rangeStart, rangeEnd), 0);
}

function sumShiftMinutes(segments: ShiftSegment[]): number {
  return segments.reduce((acc, segment) => {
    const start = parseDateTime(segment.start);
    const end = parseDateTime(segment.end);
    return acc + durationMinutes(start, end);
  }, 0);
}

function sumBreakMinutes(segments: ShiftSegment[]): number {
  return segments.reduce((acc, segment) => {
    const start = parseDateTime(segment.start);
    const end = parseDateTime(segment.end);
    const shiftDuration = durationMinutes(start, end);
    const breakTotal = segment.breaks.reduce((inner, brk) => {
      const bStart = parseDateTime(brk.start);
      const bEnd = parseDateTime(brk.end);
      return inner + durationMinutes(bStart, bEnd);
    }, 0);
    return acc + Math.min(breakTotal, shiftDuration);
  }, 0);
}

export function computeDayTotals(day: DayReviewRecord, defaultOnCallCreditPct: number): DayTotals {
  const scheduledMinutes = sumShiftMinutes(day.scheduled as unknown as ShiftSegment[]);
  const actualMinutes = sumShiftMinutes(day.actual);
  const breakMinutes = sumBreakMinutes(day.actual);
  const onCallCreditMinutes = day.actual.reduce((acc, segment) => {
    if (segment.category !== "oncall") {
      return acc;
    }
    const duration = durationMinutes(parseDateTime(segment.start), parseDateTime(segment.end));
    const creditPct = segment.creditPct ?? defaultOnCallCreditPct;
    return acc + Math.round((duration * creditPct) / 100);
  }, 0);
  const overtimeMinutes = Math.max(actualMinutes + onCallCreditMinutes - scheduledMinutes, 0);

  return {
    scheduledMinutes,
    actualMinutes,
    breakMinutes,
    overtimeMinutes,
    onCallCreditMinutes,
  };
}

export function computeWeekTotals(weekDays: DayReviewRecord[], defaultOnCallCreditPct: number): WeekTotals {
  const totals = weekDays.reduce(
    (acc, day) => {
      const dayTotals = computeDayTotals(day, defaultOnCallCreditPct);
      return {
        scheduledMinutes: acc.scheduledMinutes + dayTotals.scheduledMinutes,
        actualMinutes: acc.actualMinutes + dayTotals.actualMinutes,
        breakMinutes: acc.breakMinutes + dayTotals.breakMinutes,
        overtimeMinutes: acc.overtimeMinutes + dayTotals.overtimeMinutes,
        onCallCreditMinutes: acc.onCallCreditMinutes + dayTotals.onCallCreditMinutes,
      };
    },
    { scheduledMinutes: 0, actualMinutes: 0, breakMinutes: 0, overtimeMinutes: 0, onCallCreditMinutes: 0 },
  );

  const weekStartDate =
    weekDays.length > 0 ? startOfWeek(parseDateTime(`${weekDays[0].date}T00:00`)) : startOfWeek(new Date());

  return {
    ...totals,
    weekStart: toDateKey(weekStartDate),
  };
}

function formatMinutes(minutes: number): string {
  const hours = roundHours(minutesToHours(minutes));
  return `${hours.toFixed(1)} h`;
}

export function describeTotals(totals: DayTotals | WeekTotals) {
  return {
    scheduled: formatMinutes(totals.scheduledMinutes),
    actual: formatMinutes(totals.actualMinutes),
    overtime: formatMinutes(totals.overtimeMinutes),
    break: formatMinutes(totals.breakMinutes),
    onCall: formatMinutes(totals.onCallCreditMinutes),
  };
}

export function findDay(dataset: ReviewDataset, cursorDate: Date): DayReviewRecord | undefined {
  const key = toDateKey(startOfDay(cursorDate));
  return dataset.days.find((day) => day.date === key);
}

export function weekForDate(dataset: ReviewDataset, cursorDate: Date): DayReviewRecord[] {
  const start = startOfWeek(cursorDate);
  const result: DayReviewRecord[] = [];

  for (let index = 0; index < 7; index += 1) {
    const date = addMinutesToDate(start, index * MINUTES_PER_DAY);
    const key = toDateKey(date);
    const existing = dataset.days.find((day) => day.date === key);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        date: key,
        scheduled: [],
        actual: [],
        reviewed: false,
      });
    }
  }

  return result;
}

export function buildTimelineSegments(day: DayReviewRecord): TimelineSegment[] {
  const segments: TimelineSegment[] = [];

  day.actual.forEach((segment) => {
    const start = parseDateTime(segment.start);
    const end = parseDateTime(segment.end);
    const ranges = splitRangeByMidnight({ start, end });

    ranges.forEach((range, index) => {
      const dayKey = toDateKey(range.start);
      const durationMinutesValue = durationMinutes(range.start, range.end);

      const relevantBreaks = segment.breaks
        .map((brk) => {
          const brkStart = parseDateTime(brk.start);
          const brkEnd = parseDateTime(brk.end);
          const clippedStart = brkStart < range.start ? range.start : brkStart;
          const clippedEnd = brkEnd > range.end ? range.end : brkEnd;
          if (clippedEnd <= clippedStart) {
            return null;
          }
          return {
            id: brk.id,
            start: clippedStart.toISOString(),
            end: clippedEnd.toISOString(),
          };
        })
        .filter((value): value is BreakSegment => value !== null);

      segments.push({
        id: `${segment.id}::${index}`,
        dayKey,
        category: segment.category,
        start: range.start,
        end: range.end,
        durationMinutes: durationMinutesValue,
        breaks: relevantBreaks,
        original: segment,
      });
    });
  });

  return segments;
}

export function hasOverlap(day: DayReviewRecord): boolean {
  const segments = buildTimelineSegments(day);
  const grouped = new Map<string, TimelineSegment[]>();

  segments.forEach((segment) => {
    const list = grouped.get(segment.dayKey) ?? [];
    list.push(segment);
    grouped.set(segment.dayKey, list);
  });

  for (const list of grouped.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const current = list[i];
      if (current.start.getTime() < prev.end.getTime() - 60000) {
        return true;
      }
    }
  }

  return false;
}

function ensureDayRecord(dataset: ReviewDataset, key: string): DayReviewRecord {
  let record = dataset.days.find((day) => day.date === key);
  if (!record) {
    record = {
      date: key,
      scheduled: [],
      actual: [],
      reviewed: false,
    };
    dataset.days.push(record);
    dataset.days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return record;
}

export function addShiftAtTimestamp(
  dataset: ReviewDataset,
  timestamp: Date,
  durationMinutes: number,
): ShiftSegment | null {
  const dayKey = toDateKey(startOfDay(timestamp));
  const day = ensureDayRecord(dataset, dayKey);
  const id = `shift-${Math.random().toString(36).slice(2, 9)}`;
  const startIso = formatLocalDateTime(timestamp);
  const endIso = formatLocalDateTime(addMinutesToDate(timestamp, durationMinutes));
  const shift: ShiftSegment = {
    id,
    category: "work",
    start: startIso,
    end: endIso,
    breaks: [],
  };
  day.actual = [...day.actual, shift].sort(
    (a, b) => parseDateTime(a.start).getTime() - parseDateTime(b.start).getTime(),
  );
  return shift;
}

export function updateShiftTimes(
  dataset: ReviewDataset,
  segmentId: string,
  options: { start?: Date; end?: Date },
): boolean {
  for (const day of dataset.days) {
    const segment = day.actual.find((item) => item.id === segmentId);
    if (!segment) {
      continue;
    }
    if (options.start) {
      segment.start = formatLocalDateTime(options.start);
    }
    if (options.end) {
      segment.end = formatLocalDateTime(options.end);
    }
    return true;
  }
  return false;
}

export function removeShift(dataset: ReviewDataset, segmentId: string): boolean {
  let removed = false;
  dataset.days = dataset.days.map((day) => {
    if (removed) {
      return day;
    }
    const filtered = day.actual.filter((segment) => segment.id !== segmentId);
    if (filtered.length !== day.actual.length) {
      removed = true;
    }
    return {
      ...day,
      actual: filtered,
    };
  });
  return removed;
}

export function toggleBreakForSegment(
  segment: ShiftSegment,
  timestamp: Date,
  defaultBreakMinutes: number,
): BreakSegment[] {
  const shiftStart = parseDateTime(segment.start);
  const shiftEnd = parseDateTime(segment.end);
  const existing = segment.breaks.find((brk) => {
    const start = parseDateTime(brk.start);
    const end = parseDateTime(brk.end);
    return timestamp >= start && timestamp <= end;
  });
  if (existing) {
    return segment.breaks.filter((brk) => brk.id !== existing.id);
  }

  const breakStart = timestamp < shiftStart ? shiftStart : timestamp;
  const desiredEnd = addMinutesToDate(timestamp, defaultBreakMinutes);
  const breakEnd = desiredEnd > shiftEnd ? shiftEnd : desiredEnd;
  if (breakEnd <= breakStart) {
    return segment.breaks;
  }

  const newBreak: BreakSegment = {
    id: `break-${Math.random().toString(36).slice(2, 8)}`,
    start: formatLocalDateTime(breakStart),
    end: formatLocalDateTime(breakEnd),
  };

  return [...segment.breaks, newBreak].sort(
    (a, b) => parseDateTime(a.start).getTime() - parseDateTime(b.start).getTime(),
  );
}

export function weekForDateGrouped(dataset: ReviewDataset, cursorDate: Date): DayReviewRecord[] {
  return weekForDate(dataset, cursorDate);
}

