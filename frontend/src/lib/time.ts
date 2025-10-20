const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface TimeRange {
  start: Date;
  end: Date;
}

export function parseDateTime(value: string): Date {
  // Safari needs the "T" separator, fixtures always set local time.
  return new Date(value);
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE);
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function ensureAscendingRange(range: TimeRange): TimeRange {
  if (range.end.getTime() >= range.start.getTime()) {
    return range;
  }
  return {
    start: range.start,
    end: addMinutes(range.end, 24 * 60)
  };
}

export function splitRangeByMidnight(range: TimeRange): TimeRange[] {
  const normalized = ensureAscendingRange(range);
  const segments: TimeRange[] = [];
  let cursor = normalized.start;
  while (cursor.getTime() < normalized.end.getTime()) {
    const nextMidnight = startOfNextDay(cursor);
    const segmentEnd = normalized.end.getTime() < nextMidnight.getTime() ? normalized.end : nextMidnight;
    segments.push({ start: cursor, end: segmentEnd });
    cursor = segmentEnd;
  }
  return segments;
}

export function startOfDay(date: Date): Date {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

export function startOfWeek(date: Date): Date {
  const clone = startOfDay(date);
  const day = clone.getDay(); // 0 = Sunday
  const mondayOffset = (day + 6) % 7;
  clone.setDate(clone.getDate() - mondayOffset);
  return clone;
}

export function startOfNextDay(date: Date): Date {
  const clone = startOfDay(date);
  clone.setDate(clone.getDate() + 1);
  return clone;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function formatHourLabel(hours: number): string {
  const whole = Math.floor(hours);
  const fraction = Math.round((hours - whole) * 60);
  if (fraction === 0) {
    return `${whole}h`;
  }
  return `${whole}h ${fraction.toString().padStart(2, "0")}m`;
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
