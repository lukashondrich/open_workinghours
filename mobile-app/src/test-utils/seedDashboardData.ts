/**
 * Seed test data for the Status Screen Dashboard
 * Creates 14 days of varied planned/actual hours for testing
 */

import { subDays, format, addMinutes } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { ShiftTemplate, ShiftInstance, ConfirmedDayStatus } from '@/lib/calendar/types';

// Test data patterns for 14 days (index 0 = 13 days ago, index 13 = today)
// Format: [plannedMinutes, actualMinutes, isConfirmed]
const TEST_DATA: Array<[number, number, boolean]> = [
  // Week 2 ago (days 13-7 ago)
  [480, 510, true],   // Day 13: 8h planned, 8.5h actual (overtime), confirmed
  [480, 480, true],   // Day 12: 8h planned, 8h actual (exact), confirmed
  [480, 420, true],   // Day 11: 8h planned, 7h actual (undertime), confirmed
  [0, 0, true],       // Day 10: Weekend - no work, confirmed
  [0, 0, true],       // Day 9: Weekend - no work, confirmed
  [480, 540, true],   // Day 8: 8h planned, 9h actual (overtime), confirmed
  [480, 450, true],   // Day 7: 8h planned, 7.5h actual (undertime), confirmed

  // Last week (days 6-0 ago)
  [480, 600, true],   // Day 6: 8h planned, 10h actual (big overtime), confirmed
  [480, 480, true],   // Day 5: 8h planned, 8h actual (exact), confirmed
  [480, 495, true],   // Day 4: 8h planned, 8.25h actual (slight overtime), confirmed
  [0, 0, false],      // Day 3: Weekend - no work, unconfirmed
  [0, 120, false],    // Day 2: No planned shift but 2h actual (unplanned work), unconfirmed
  [480, 360, false],  // Day 1: 8h planned, 6h actual (undertime), unconfirmed
  [480, 180, false],  // Day 0 (today): 8h planned, 3h actual so far (in progress)
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
