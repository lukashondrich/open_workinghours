import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import type { ShiftInstance, TrackingRecord } from '@/lib/calendar/types';
import type { DailyActual } from '@/modules/geofencing/types';

function getDayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function computeOverlapMinutes(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  const effectiveStart = start > rangeStart ? start : rangeStart;
  const effectiveEnd = end < rangeEnd ? end : rangeEnd;
  const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / 60000);
}

function getInstanceWindow(instance: ShiftInstance) {
  const [year, month, day] = instance.date.split('-').map(Number);
  const [startHour, startMinute] = instance.startTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  const end = new Date(start.getTime() + instance.duration * 60000);
  return { start, end };
}

function computePlannedMinutes(instances: Record<string, ShiftInstance>, dateKey: string): number {
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);
  return Object.values(instances).reduce((total, instance) => {
    if (instance.date !== dateKey) return total;
    const { start, end } = getInstanceWindow(instance);
    const minutes = computeOverlapMinutes(start, end, dayStart, dayEnd);
    return total + minutes;
  }, 0);
}

async function computeActualMinutes(
  dateKey: string,
  manualRecords?: TrackingRecord[],
): Promise<{ minutes: number; source: DailyActual['source'] }> {
  if (manualRecords && manualRecords.length > 0) {
    const totalMinutes = manualRecords.reduce((sum, record) => sum + record.duration, 0);
    return { minutes: totalMinutes, source: 'manual' };
  }

  const db = await getDatabase();
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);
  const sessions = await db.getSessionsBetween(dayStart.toISOString(), dayEnd.toISOString());
  let totalMinutes = 0;
  const methodSet = new Set<'geofence' | 'manual'>();

  sessions.forEach((session) => {
    if (!session.clockOut) {
      return;
    }
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
  if (methodSet.size === 0) {
    source = 'manual';
  } else if (methodSet.size === 1) {
    source = methodSet.has('geofence') ? 'geofence' : 'manual';
  } else {
    source = 'mixed';
  }

  return { minutes: totalMinutes, source };
}

export async function persistDailyActualForDate(
  dateKey: string,
  instances: Record<string, ShiftInstance>,
  manualRecords?: TrackingRecord[],
): Promise<DailyActual> {
  const db = await getDatabase();
  const plannedMinutes = computePlannedMinutes(instances, dateKey);
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
