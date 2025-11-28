import { addDays, format, startOfWeek } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import type { DailyActual, WeeklySubmissionRecord } from '@/modules/geofencing/types';
import { addLaplaceNoiseToMinutes } from '@/lib/privacy/LaplaceNoise';
import { PRIVACY_EPSILON } from '@/lib/privacy/constants';

export interface WeekSummary {
  weekStartDate: Date;
  weekEndDate: Date;
  weekStart: string;
  weekEnd: string;
  dayRecords: DailyActual[];
  plannedMinutesTrue: number;
  actualMinutesTrue: number;
}

export function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function buildWeekDateKeys(weekStartDate: Date): string[] {
  return Array.from({ length: 7 }).map((_, idx) => {
    const day = addDays(weekStartDate, idx);
    return format(day, 'yyyy-MM-dd');
  });
}

export async function loadWeekSummary(referenceDate: Date): Promise<WeekSummary> {
  const weekStartDate = getWeekStart(referenceDate);
  const weekEndDate = addDays(weekStartDate, 6);
  const dateKeys = buildWeekDateKeys(weekStartDate);
  const db = await getDatabase();
  const dailyRecords = await db.getDailyActualsByDates(dateKeys);

  if (dailyRecords.length !== dateKeys.length) {
    throw new Error('All days in the week must be confirmed before submission');
  }

  const totals = dailyRecords.reduce(
    (acc, record) => {
      acc.planned += record.plannedMinutes;
      acc.actual += record.actualMinutes;
      return acc;
    },
    { planned: 0, actual: 0 },
  );

  return {
    weekStartDate,
    weekEndDate,
    weekStart: format(weekStartDate, 'yyyy-MM-dd'),
    weekEnd: format(weekEndDate, 'yyyy-MM-dd'),
    dayRecords: dailyRecords,
    plannedMinutesTrue: totals.planned,
    actualMinutesTrue: totals.actual,
  };
}

export async function enqueueWeeklySubmission(
  summary: WeekSummary,
  epsilon: number = PRIVACY_EPSILON,
): Promise<WeeklySubmissionRecord> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const plannedMinutesNoisy = addLaplaceNoiseToMinutes(summary.plannedMinutesTrue, epsilon);
  const actualMinutesNoisy = addLaplaceNoiseToMinutes(summary.actualMinutesTrue, epsilon);
  const record: WeeklySubmissionRecord = {
    id,
    weekStart: summary.weekStart,
    weekEnd: summary.weekEnd,
    plannedMinutesTrue: summary.plannedMinutesTrue,
    actualMinutesTrue: summary.actualMinutesTrue,
    plannedMinutesNoisy,
    actualMinutesNoisy,
    epsilon,
    status: 'pending',
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insertWeeklySubmission(
    record,
    summary.dayRecords.map((day) => day.id),
  );

  return record;
}
