import { addDays, format, startOfWeek } from 'date-fns';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { DailyActual } from '@/modules/geofencing/types';
import type { ConfirmedDayStatus, ShiftInstance, ShiftTemplate, TrackingRecord } from '@/lib/calendar/types';

type SeedOptions = {
  referenceDate?: Date;
  minutesPerDay?: number;
  locationName?: string;
};

function shouldSeed(): boolean {
  const envFlag = (process as any)?.env?.TEST_DB_SEED;
  if (envFlag && String(envFlag).toLowerCase() === 'true') return true;

  const extraFlag = (Constants.expoConfig as any)?.extra?.TEST_DB_SEED;
  if (typeof extraFlag === 'string' && extraFlag.toLowerCase() === 'true') return true;
  if (typeof extraFlag === 'boolean' && extraFlag) return true;

  const globalFlag = (globalThis as any)?.__TEST_DB_SEED;
  if (typeof globalFlag === 'boolean' && globalFlag) return true;
  if (typeof globalFlag === 'string' && globalFlag.toLowerCase() === 'true') return true;

  return false;
}

export async function seedTestDeviceData(options: SeedOptions = {}) {
  const now = new Date();
  const referenceDate = options.referenceDate ?? now;
  const minutesPerDay = options.minutesPerDay ?? 8 * 60;
  const locationName = options.locationName ?? 'Test Hospital';
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });

  const db = await getDatabase();
  const calendar = await getCalendarStorage();

  // Start from a clean slate for repeatable tests
  await db.deleteAllData();
  await calendar.replaceTemplates([]);
  await calendar.replaceInstances([]);
  await calendar.replaceTrackingRecords([]);
  await calendar.replaceConfirmedDays({});

  const locationId = uuidv4();
  await db.insertLocation({
    id: locationId,
    name: locationName,
    latitude: 52.52,
    longitude: 13.405,
    radiusMeters: 200,
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const confirmedDays: Record<string, ConfirmedDayStatus> = {};
  const tracking: TrackingRecord[] = [];
  const instances: ShiftInstance[] = [];
  const templates: ShiftTemplate[] = [
    {
      id: uuidv4(),
      name: 'Day Shift',
      startTime: '08:00',
      duration: minutesPerDay,
      color: '#4C8BF5',
    },
  ];

  for (let i = 0; i < 7; i += 1) {
    const day = addDays(weekStart, i);
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayId = uuidv4();
    const confirmedAt = day.toISOString();

    const record: DailyActual = {
      id: dayId,
      date: dateKey,
      plannedMinutes: minutesPerDay,
      actualMinutes: minutesPerDay,
      source: 'manual',
      confirmedAt,
      updatedAt: confirmedAt,
    };

    await db.upsertDailyActual(record);

    confirmedDays[dateKey] = {
      status: 'confirmed',
      confirmedAt,
      lockedSubmissionId: null,
    };

    tracking.push({
      id: uuidv4(),
      date: dateKey,
      startTime: '08:00',
      duration: minutesPerDay,
    });

    instances.push({
      id: uuidv4(),
      templateId: templates[0].id,
      date: dateKey,
      startTime: '08:00',
      duration: minutesPerDay,
      endTime: '16:00',
      color: templates[0].color,
      name: templates[0].name,
    });
  }

  await calendar.replaceTemplates(templates);
  await calendar.replaceInstances(instances);
  await calendar.replaceTrackingRecords(tracking);
  await calendar.replaceConfirmedDays(confirmedDays);
}

export async function seedTestDeviceDataIfEnabled(options?: SeedOptions) {
  if (!shouldSeed()) return;
  await seedTestDeviceData(options);
}
