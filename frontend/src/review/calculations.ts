import { ShiftInstance, ShiftSegment, ShiftBreakInstance, ShiftType, ShiftPlacementRequest, DayIndex, ShiftConflict } from "./types";

const MINUTES_PER_DAY = 24 * 60;

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

export function computeSegments(shift: ShiftInstance): ShiftSegment[] {
  const { start, end } = computeShiftRange(shift);
  const firstDay = Math.floor(start / MINUTES_PER_DAY);
  const lastDay = Math.floor((end - 1) / MINUTES_PER_DAY);
  const segments: ShiftSegment[] = [];

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
  const candidateStartMs = candidate.startDateISO
    ? isoDateToTimestamp(candidate.startDateISO, candidate.startMinute)
    : null;
  const candidateEndMs = candidateStartMs !== null ? candidateStartMs + candidate.durationMinutes * 60000 : null;
  const candidateStartMinutes = computeAbsoluteMinutes(candidate.startDay, candidate.startMinute);
  const candidateEndMinutes = candidateStartMinutes + candidate.durationMinutes;

  for (const shift of shifts) {
    if (candidate.id && shift.id === candidate.id) {
      continue;
    }

    const shiftHasDate = Boolean(shift.startDateISO);
    const { start, end } = computeShiftRange(shift);

    if (candidateStartMs !== null && shiftHasDate) {
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
