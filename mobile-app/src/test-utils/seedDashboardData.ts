/**
 * Seed test data for the Status Screen Dashboard
 * Creates 14 days of varied planned/actual hours for testing
 */

import { subDays, addDays, format, addMinutes } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { ShiftTemplate, ShiftInstance, ConfirmedDayStatus } from '@/lib/calendar/types';

// Test data patterns for 14 days (index 0 = 13 days ago, index 13 = today)
// Format: [plannedMinutes, actualMinutes, isConfirmed]
// Realistic pattern: Mix of normal days, overtime, undertime, weekends
const TEST_DATA: Array<[number, number, boolean]> = [
  // Week 2 ago (Mon-Sun, days 13-7 ago)
  [480, 540, true],   // Mon: 8h planned, 9h actual (overtime), confirmed
  [480, 510, true],   // Tue: 8h planned, 8.5h actual (overtime), confirmed
  [480, 480, true],   // Wed: 8h planned, 8h actual (exact), confirmed
  [480, 570, true],   // Thu: 8h planned, 9.5h actual (overtime), confirmed
  [480, 420, true],   // Fri: 8h planned, 7h actual (left early), confirmed
  [0, 0, true],       // Sat: Weekend - no work
  [0, 0, true],       // Sun: Weekend - no work

  // Last week + today (Mon-Sun, days 6-0 ago)
  [480, 660, true],   // Mon: 8h planned, 11h actual (big overtime day), confirmed
  [480, 540, true],   // Tue: 8h planned, 9h actual (overtime), confirmed
  [480, 495, true],   // Wed: 8h planned, 8.25h actual (slight overtime), confirmed
  [480, 450, false],  // Thu: 8h planned, 7.5h actual (undertime), unconfirmed
  [480, 525, false],  // Fri: 8h planned, 8.75h actual (overtime), unconfirmed
  [0, 0, false],      // Sat: Weekend - no work
  [480, 210, false],  // Sun (today): 8h planned, 3.5h actual so far (in progress - on call)
];

// Shift templates
const TEMPLATES: ShiftTemplate[] = [
  {
    id: 'template-day-shift',
    name: 'Day Shift',
    startTime: '08:00',
    duration: 480, // 8 hours
    color: 'blue',
  },
  {
    id: 'template-late-shift',
    name: 'Late Shift',
    startTime: '14:00',
    duration: 480,
    color: 'purple',
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
  const confirmedDays: Record<string, ConfirmedDayStatus> = {};

  // Generate data for each of the 14 days
  for (let i = 0; i < TEST_DATA.length; i++) {
    const daysAgo = 13 - i;
    const day = subDays(today, daysAgo);
    const dateKey = format(day, 'yyyy-MM-dd');
    const [plannedMinutes, actualMinutes, isConfirmed] = TEST_DATA[i];

    // Create shift instance if there's planned time
    if (plannedMinutes > 0) {
      const template = TEMPLATES[0]; // Use day shift
      const startTime = template.startTime;
      const [startHour, startMin] = startTime.split(':').map(Number);
      const startDate = new Date(day);
      startDate.setHours(startHour, startMin, 0, 0);
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

    // Create tracking session if there's actual time
    if (actualMinutes > 0) {
      const clockInTime = new Date(day);
      clockInTime.setHours(8, 0, 0, 0);
      const clockOutTime = addMinutes(clockInTime, actualMinutes);
      const isToday = daysAgo === 0;

      // Create the session directly
      const sessionId = Crypto.randomUUID();
      const now = new Date().toISOString();

      // Use clockIn to create session
      await db.clockIn(locationId, clockInTime.toISOString(), 'geofence_auto');

      // Get the session we just created and clock it out (except for today)
      if (!isToday) {
        const sessions = await db.getActiveSession(locationId);
        if (sessions) {
          await db.clockOut(sessions.id, clockOutTime.toISOString());
        }
      }
    }

    // Set confirmed status for days with planned shifts
    if (isConfirmed && (plannedMinutes > 0 || actualMinutes > 0)) {
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
    color: 'blue',
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
  await storage.replaceConfirmedDays(confirmedDays);

  console.log(`[SeedDashboard] Created ${instances.length} shift instances`);
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
