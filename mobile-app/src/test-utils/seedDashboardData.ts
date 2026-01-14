/**
 * Seed test data for the Status Screen Dashboard
 * Creates 14 days of varied planned/actual hours for testing
 */

import { subDays, addDays, format, addMinutes } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { ShiftTemplate, ShiftInstance, ConfirmedDayStatus, AbsenceInstance } from '@/lib/calendar/types';

// Test data patterns for 14 days (index 0 = 13 days ago, index 13 = today)
// Format: [plannedMinutes, actualMinutes, isConfirmed, shiftType, startHour, absence]
// shiftType: 'day' = 08:00, 'late' = 14:00, 'night' = 22:00 (overnight), 'none' = no shift
// absence: 'none' | 'vacation' | 'sick'
// Realistic pattern: Mix of normal days, overtime, undertime, weekends, night shifts, absences
type ShiftType = 'day' | 'late' | 'night' | 'none';
type AbsenceType = 'none' | 'vacation' | 'sick';
const TEST_DATA: Array<[number, number, boolean, ShiftType, number, AbsenceType]> = [
  // Week 2 ago (days 13-7 ago) - may be pre-account for some users
  [480, 510, true, 'day', 8, 'none'],       // Day 13: 8h planned, 8.5h actual
  [480, 480, true, 'day', 8, 'none'],       // Day 12: 8h planned, 8h actual
  [360, 390, true, 'day', 9, 'none'],       // Day 11: 6h planned, 6.5h actual (short day)
  [480, 540, true, 'late', 14, 'none'],     // Day 10: 8h planned late shift, 9h actual
  [480, 420, true, 'day', 8, 'none'],       // Day 9: 8h planned, 7h actual
  [0, 0, true, 'none', 0, 'none'],          // Day 8: Weekend - no work
  [0, 180, true, 'none', 10, 'none'],       // Day 7: No planned, but 3h tracked (called in)

  // Last week + today (days 6-0 ago)
  [840, 900, true, 'night', 22, 'none'],    // Day 6: 14h night shift, 15h actual (OVERNIGHT)
  [480, 0, true, 'day', 8, 'vacation'],     // Day 5: Vacation day 🌴
  [480, 0, true, 'day', 8, 'sick'],         // Day 4: Sick day 🌡️
  [480, 360, false, 'day', 8, 'none'],      // Day 3: 8h planned, 6h actual (left early)
  [480, 525, false, 'late', 14, 'none'],    // Day 2: 8h late shift, 8.75h actual
  [240, 270, false, 'day', 8, 'none'],      // Day 1 (yesterday): 4h planned, 4.5h actual
  [480, 150, false, 'day', 8, 'none'],      // Day 0 (today): 8h planned, 2.5h so far
];

// Shift templates
const TEMPLATES: ShiftTemplate[] = [
  {
    id: 'template-day-shift',
    name: 'Day Shift',
    startTime: '08:00',
    duration: 480, // 8 hours
    color: 'teal',
  },
  {
    id: 'template-late-shift',
    name: 'Late Shift',
    startTime: '14:00',
    duration: 480,
    color: 'purple',
  },
  {
    id: 'template-night-shift',
    name: 'Night Shift',
    startTime: '22:00',
    duration: 600, // 10 hours (overnight)
    color: 'amber',
  },
];

export async function seedDashboardTestData() {
  console.log('[SeedDashboard] Starting dashboard test data seed...');

  const db = await getDatabase();
  const storage = await getCalendarStorage();
  const today = new Date();

  // Clear ALL existing data first
  await db.deleteAllData();
  await storage.replaceTemplates([]);
  await storage.replaceInstances([]);
  await storage.replaceTrackingRecords([]);
  await storage.replaceConfirmedDays({});

  // Create a test location
  const locationId = Crypto.randomUUID();
  await db.insertLocation({
    id: locationId,
    name: 'City Hospital',
    latitude: 52.52,
    longitude: 13.405,
    radiusMeters: 200,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('[SeedDashboard] Created test location: City Hospital');

  // Save templates
  await storage.replaceTemplates(TEMPLATES);

  const instances: ShiftInstance[] = [];
  const absenceInstances: AbsenceInstance[] = [];
  const confirmedDays: Record<string, ConfirmedDayStatus> = {};
  const now = new Date().toISOString();

  // Generate data for each of the 14 days
  for (let i = 0; i < TEST_DATA.length; i++) {
    const daysAgo = 13 - i;
    const day = subDays(today, daysAgo);
    const dateKey = format(day, 'yyyy-MM-dd');
    const [plannedMinutes, actualMinutes, isConfirmed, shiftType, startHour, absence] = TEST_DATA[i];

    // Create shift instance if there's planned time
    if (plannedMinutes > 0 && shiftType !== 'none') {
      const template = shiftType === 'day' ? TEMPLATES[0] :
                       shiftType === 'late' ? TEMPLATES[1] : TEMPLATES[2];
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const startDate = new Date(day);
      startDate.setHours(startHour, 0, 0, 0);
      const endDate = addMinutes(startDate, plannedMinutes);
      const endTime = format(endDate, 'HH:mm');

      instances.push({
        id: `instance-${dateKey}`,
        templateId: template.id,
        date: dateKey,
        startTime: startTime,
        duration: plannedMinutes,
        endTime: endTime,
        color: template.color,
        name: template.name,
      });
    }

    // Create absence instance if there's an absence
    if (absence !== 'none') {
      absenceInstances.push({
        id: `absence-${dateKey}`,
        templateId: null,
        type: absence,
        date: dateKey,
        startTime: '00:00',
        endTime: '23:59',
        isFullDay: true,
        name: absence === 'vacation' ? 'Vacation' : 'Sick Day',
        color: absence === 'vacation' ? 'teal' : 'rose',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create tracking session if there's actual time
    if (actualMinutes > 0) {
      const clockInTime = new Date(day);
      clockInTime.setHours(startHour || 8, 0, 0, 0);
      const clockOutTime = addMinutes(clockInTime, actualMinutes);
      const isToday = daysAgo === 0;

      // Insert session directly into database to avoid clock-in conflicts
      const sessionId = Crypto.randomUUID();
      await db.insertSession({
        id: sessionId,
        locationId: locationId,
        clockIn: clockInTime.toISOString(),
        clockOut: isToday ? null : clockOutTime.toISOString(),
        durationMinutes: isToday ? null : actualMinutes,
        trigger: 'geofence_auto',
        createdAt: clockInTime.toISOString(),
        updatedAt: (isToday ? clockInTime : clockOutTime).toISOString(),
      });
    }

    // Set confirmed status for days with planned shifts or absences
    if (isConfirmed && (plannedMinutes > 0 || actualMinutes > 0 || absence !== 'none')) {
      confirmedDays[dateKey] = {
        status: 'confirmed',
        confirmedAt: day.toISOString(),
        lockedSubmissionId: null,
      };
    }
  }

  // Add future shifts for NextShiftWidget
  // Tomorrow: Day shift
  const tomorrow = addDays(today, 1);
  const tomorrowKey = format(tomorrow, 'yyyy-MM-dd');
  instances.push({
    id: `instance-${tomorrowKey}`,
    templateId: TEMPLATES[0].id,
    date: tomorrowKey,
    startTime: '08:00',
    duration: 480,
    endTime: '16:00',
    color: 'teal',
    name: 'Day Shift',
  });

  // Day after tomorrow: Late shift
  const dayAfter = addDays(today, 2);
  const dayAfterKey = format(dayAfter, 'yyyy-MM-dd');
  instances.push({
    id: `instance-${dayAfterKey}`,
    templateId: TEMPLATES[1].id,
    date: dayAfterKey,
    startTime: '14:00',
    duration: 480,
    endTime: '22:00',
    color: 'purple',
    name: 'Late Shift',
  });

  await storage.replaceInstances(instances);
  await storage.replaceAbsenceInstances(absenceInstances);
  await storage.replaceConfirmedDays(confirmedDays);

  console.log(`[SeedDashboard] Created ${instances.length} shift instances`);
  console.log(`[SeedDashboard] Created ${absenceInstances.length} absence instances`);
  console.log(`[SeedDashboard] Marked ${Object.keys(confirmedDays).length} days as confirmed`);
  console.log('[SeedDashboard] Dashboard test data seeding complete!');
}

/**
 * Clear all test data
 */
export async function clearDashboardTestData() {
  const db = await getDatabase();
  const storage = await getCalendarStorage();

  await db.deleteAllData();
  await storage.replaceTemplates([]);
  await storage.replaceInstances([]);
  await storage.replaceTrackingRecords([]);
  await storage.replaceConfirmedDays({});

  console.log('[SeedDashboard] All test data cleared');
}
