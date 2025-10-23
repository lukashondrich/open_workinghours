export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BreakTemplate {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
}

export interface ShiftType {
  id: string;
  name: string;
  durationMinutes: number;
  defaultBreaks: BreakTemplate[];
  color: string;
}

export interface ShiftBreakInstance {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
}

export interface ShiftInstance {
  id: string;
  shiftTypeId: string;
  startDay: DayIndex;
  startMinute: number;
  durationMinutes: number;
  originalDurationMinutes: number;
  breaks: ShiftBreakInstance[];
  edited: boolean;
  startDateISO: string;
}

export interface ShiftPlacementRequest {
  shiftTypeId: string;
  startDay: DayIndex;
  startMinute: number;
}

export interface ShiftConflict {
  conflictingShiftId: string;
  conflictingStartMinutes: number;
  conflictingEndMinutes: number;
}

export interface ShiftSegment {
  day: DayIndex;
  startMinute: number;
  endMinute: number;
  isContinuation: boolean;
  absoluteDayIndex: number;
  absoluteStart: number;
  absoluteEnd: number;
}

export interface TimelineSelection {
  day: DayIndex;
  minute: number;
}
