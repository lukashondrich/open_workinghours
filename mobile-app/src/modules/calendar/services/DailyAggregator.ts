import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { AbsenceInstance, ShiftInstance, TrackingRecord } from '@/lib/calendar/types';
import type { DailyActual } from '@/modules/geofencing/types';
import {
  getDayBounds,
  computeOverlapMinutes,
  computeEffectivePlannedMinutesForDate,
  computeActualMinutesFromRecords,
  computeActualMinutesFromSessions,
} from '@/lib/calendar/time-calculations';

/** Breaks entered in the calendar (record id → minutes); empty if storage is unavailable. */
async function loadBreaksById(): Promise<Record<string, number>> {
  try {
    const storage = await getCalendarStorage();
    return await storage.loadTrackingBreaks();
  } catch (error) {
    console.warn('[DailyAggregator] Could not load calendar breaks, submitting gross minutes:', error);
    return {};
  }
}

async function computeActualMinutes(
  dateKey: string,
  calendarRecords?: TrackingRecord[],
): Promise<{ minutes: number; source: DailyActual['source'] }> {
  const db = await getDatabase();
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);
  const sessions = await db.getSessionsBetween(dayStart.toISOString(), dayEnd.toISOString());

  // How the day's minutes were captured — from the sessions that overlap the
  // day, regardless of which source supplies the minutes below.
  const methodSet = new Set<'geofence' | 'manual'>();
  sessions.forEach((session) => {
    if (!session.clockOut) return;
    const minutes = computeOverlapMinutes(new Date(session.clockIn), new Date(session.clockOut), dayStart, dayEnd);
    if (minutes > 0) {
      methodSet.add(session.trackingMethod === 'geofence_auto' ? 'geofence' : 'manual');
    }
  });
  let source: DailyActual['source'];
  if (methodSet.size === 0) source = 'manual';
  else if (methodSet.size === 1) source = methodSet.has('geofence') ? 'geofence' : 'manual';
  else source = 'mixed';

  // Minutes: the calendar's records are the source of truth when the caller has
  // them (they carry the user's edits and breaks); they must be the OVERLAP-based
  // set for the day so a night shift's after-midnight tail is counted here.
  if (calendarRecords && calendarRecords.length > 0) {
    return { minutes: computeActualMinutesFromRecords(dateKey, calendarRecords), source };
  }

  // Fallback (no calendar records): sessions net of the stored breaks — the
  // same arithmetic as the calendar and the Status widget.
  const breaksById = await loadBreaksById();
  return { minutes: computeActualMinutesFromSessions(dateKey, sessions, breaksById), source };
}

export async function persistDailyActualForDate(
  dateKey: string,
  instances: Record<string, ShiftInstance>,
  absenceInstances: Record<string, AbsenceInstance>,
  calendarRecords?: TrackingRecord[],
): Promise<DailyActual> {
  const db = await getDatabase();
  // Absence-adjusted, matching what every display surface shows — a vacation
  // day covering a planned shift is submitted as 0 planned, not the raw shift
  const plannedMinutes = computeEffectivePlannedMinutesForDate(instances, absenceInstances, dateKey);
  const { minutes: actualMinutes, source } = await computeActualMinutes(dateKey, calendarRecords);
  const confirmedAt = new Date().toISOString();
  const existing = await db.getDailyActual(dateKey);
  const record: DailyActual = {
    id: existing?.id ?? Crypto.randomUUID(),
    date: dateKey,
    plannedMinutes,
    actualMinutes,
    source,
    confirmedAt,
    updatedAt: confirmedAt,
  };
  await db.upsertDailyActual(record);
  return record;
}
