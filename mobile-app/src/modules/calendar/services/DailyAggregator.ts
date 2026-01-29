import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import type { ShiftInstance, TrackingRecord } from '@/lib/calendar/types';
import type { DailyActual } from '@/modules/geofencing/types';
import {
  getDayBounds,
  computeOverlapMinutes,
  computePlannedMinutesForDate,
  computeActualMinutesFromRecords,
} from '@/lib/calendar/time-calculations';

async function computeActualMinutes(
  dateKey: string,
  manualRecords?: TrackingRecord[],
): Promise<{ minutes: number; source: DailyActual['source'] }> {
  if (manualRecords && manualRecords.length > 0) {
    const minutes = computeActualMinutesFromRecords(dateKey, manualRecords);
    return { minutes, source: 'manual' };
  }

  const db = await getDatabase();
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);
  const sessions = await db.getSessionsBetween(dayStart.toISOString(), dayEnd.toISOString());
  let totalMinutes = 0;
  const methodSet = new Set<'geofence' | 'manual'>();

  sessions.forEach((session) => {
    if (!session.clockOut) return;
    const sessionStart = new Date(session.clockIn);
    const sessionEnd = new Date(session.clockOut);
    const minutes = computeOverlapMinutes(sessionStart, sessionEnd, dayStart, dayEnd);
    if (minutes > 0) {
      totalMinutes += minutes;
      if (session.trackingMethod === 'geofence_auto') {
        methodSet.add('geofence');
      } else {
        methodSet.add('manual');
      }
    }
  });

  let source: DailyActual['source'];
  if (methodSet.size === 0) source = 'manual';
  else if (methodSet.size === 1) source = methodSet.has('geofence') ? 'geofence' : 'manual';
  else source = 'mixed';

  return { minutes: totalMinutes, source };
}

export async function persistDailyActualForDate(
  dateKey: string,
  instances: Record<string, ShiftInstance>,
  manualRecords?: TrackingRecord[],
): Promise<DailyActual> {
  const db = await getDatabase();
  const plannedMinutes = computePlannedMinutesForDate(instances, dateKey);
  const { minutes: actualMinutes, source } = await computeActualMinutes(dateKey, manualRecords);
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
