import { addDays, format, parseISO, subDays } from 'date-fns';
import type { ShiftInstance } from './types';
import { findOverlappingShift, timeToMinutes } from './calendar-utils';

/** Fixed v1 horizon: occurrences are materialized for the next ~3 months. */
export const SERIES_HORIZON_DAYS = 90;

export interface SeriesBuildResult {
  occurrences: ShiftInstance[];
  skippedOverlaps: number;
}

function defaultMakeId(): string {
  return `instance-${Date.now()}-${Math.random()}`;
}

/**
 * Materialize the future occurrences of a repeating shift as concrete
 * ShiftInstance copies of `source` — same weekday, time, duration, template —
 * every `intervalWeeks` weeks, up to SERIES_HORIZON_DAYS after the source date.
 *
 * The source itself is NOT included in the result; the caller tags it with the
 * seriesId via ADD_SERIES. Occurrences that would overlap an existing shift
 * are skipped and counted (shift-app convention: existing plans win).
 */
export function buildSeriesOccurrences(
  source: ShiftInstance,
  intervalWeeks: 1 | 2,
  seriesId: string,
  existingInstances: Record<string, ShiftInstance>,
  makeId: () => string = defaultMakeId
): SeriesBuildResult {
  const occurrences: ShiftInstance[] = [];
  let skippedOverlaps = 0;

  const sourceDate = parseISO(source.date);
  const stepDays = intervalWeeks * 7;

  for (let offset = stepDays; offset <= SERIES_HORIZON_DAYS; offset += stepDays) {
    const date = format(addDays(sourceDate, offset), 'yyyy-MM-dd');

    if (overlapsExistingShift(date, source.startTime, source.duration, existingInstances)) {
      skippedOverlaps += 1;
      continue;
    }

    occurrences.push({
      ...source,
      id: makeId(),
      date,
      seriesId,
    });
  }

  return { occurrences, skippedOverlaps };
}

/**
 * Overnight-aware overlap check. `findOverlappingShift` only compares
 * instances carrying the same date string, so a Nachtdienst ending past
 * midnight (e.g. Sun 22:00 + 8h → Mon 06:00) never blocks a Monday-morning
 * occurrence — and a candidate whose own tail crosses midnight never sees
 * next-day shifts. Both directions are common for this audience, so the
 * series builder checks the adjacent days too.
 */
function overlapsExistingShift(
  date: string,
  startTime: string,
  duration: number,
  instances: Record<string, ShiftInstance>
): boolean {
  if (findOverlappingShift(date, startTime, duration, instances)) {
    return true;
  }

  const newStart = timeToMinutes(startTime);
  const newEnd = newStart + duration;
  const parsed = parseISO(date);
  const prevDate = format(subDays(parsed, 1), 'yyyy-MM-dd');
  const nextDate = format(addDays(parsed, 1), 'yyyy-MM-dd');

  for (const instance of Object.values(instances)) {
    // Previous-day shift spilling past midnight into the candidate's morning
    if (instance.date === prevDate) {
      const spillEnd = timeToMinutes(instance.startTime) + instance.duration - 24 * 60;
      if (spillEnd > 0 && newStart < spillEnd) {
        return true;
      }
    }
    // Candidate's own tail crossing midnight into a next-day shift
    if (newEnd > 24 * 60 && instance.date === nextDate) {
      if (timeToMinutes(instance.startTime) < newEnd - 24 * 60) {
        return true;
      }
    }
  }

  return false;
}
