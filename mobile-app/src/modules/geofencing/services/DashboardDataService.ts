import { subDays, startOfDay, format, isBefore, isAfter, parseISO } from 'date-fns';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { ShiftInstance, ShiftColor, AbsenceInstance } from '@/lib/calendar/types';
import {
  getAbsencesForDate,
  calculateEffectivePlannedMinutes,
  getDayBounds,
  computeOverlapMinutes,
} from '@/lib/calendar/calendar-utils';

export interface DailyHoursData {
  date: string; // YYYY-MM-DD
  plannedMinutes: number;
  actualMinutes: number;
  isConfirmed: boolean;
  isToday: boolean;
  isPreAccount: boolean; // true if day is before account was created
  hasVacation: boolean;
  hasSick: boolean;
}

export interface NextShiftData {
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  color: ShiftColor;
}

export interface DashboardData {
  hoursSummary: {
    days: DailyHoursData[];
    totalPlanned: number;
    totalActual: number;
    deviation: number; // actual - planned
  };
  nextShift: NextShiftData | null;
  isLive: boolean; // true if user is currently clocked in
}

/**
 * Get planned minutes for a specific date from shift instances
 */
function computePlannedMinutes(
  instances: Record<string, ShiftInstance>,
  dateKey: string
): number {
  const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

  return Object.values(instances).reduce((total, instance) => {
    // Check if instance is on this date
    if (instance.date !== dateKey) {
      // Check for overnight overflow from previous day
      const prevDate = format(subDays(parseISO(dateKey), 1), 'yyyy-MM-dd');
      if (instance.date !== prevDate) return total;

      // Calculate if previous day's instance overflows into this day
      const [year, month, day] = instance.date.split('-').map(Number);
      const [startHour, startMinute] = instance.startTime.split(':').map(Number);
      const instanceStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
      const instanceEnd = new Date(instanceStart.getTime() + instance.duration * 60000);

      // Check if it overflows into the current day
      if (instanceEnd > dayStart) {
        return total + computeOverlapMinutes(instanceStart, instanceEnd, dayStart, dayEnd);
      }
      return total;
    }

    // Instance is on this date
    const [year, month, day] = instance.date.split('-').map(Number);
    const [startHour, startMinute] = instance.startTime.split(':').map(Number);
    const instanceStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const instanceEnd = new Date(instanceStart.getTime() + instance.duration * 60000);

    return total + computeOverlapMinutes(instanceStart, instanceEnd, dayStart, dayEnd);
  }, 0);
}

/**
 * Load dashboard data for the Status screen
 * Returns 14-day rolling data + next shift info
 *
 * @param accountCreatedAt - ISO 8601 date string when account was created (optional)
 *                           If provided, days before this date are marked as isPreAccount
 */
export async function loadDashboardData(accountCreatedAt?: string): Promise<DashboardData> {
  console.log('[DashboardDataService] Loading data, accountCreatedAt:', accountCreatedAt);
  const db = await getDatabase();
  const storage = await getCalendarStorage();

  // Load all data sources
  const [instances, confirmedDays, locations, absenceInstances] = await Promise.all([
    storage.loadInstances(),
    storage.loadConfirmedDays(),
    db.getActiveLocations(),
    storage.loadAbsenceInstances(),
  ]);

  console.log('[DashboardDataService] Loaded:', {
    instancesCount: Object.keys(instances).length,
    locationsCount: locations.length,
    absencesCount: Object.keys(absenceInstances).length,
  });

  // Calculate date range: last 14 days including today
  const today = startOfDay(new Date());
  const todayKey = format(today, 'yyyy-MM-dd');
  const startDate = subDays(today, 13);
  const startDateKey = format(startDate, 'yyyy-MM-dd');

  // Parse account creation date if provided
  const accountStartDate = accountCreatedAt ? startOfDay(parseISO(accountCreatedAt)) : null;

  // Get sessions for the date range
  const sessions = await db.getSessionsBetween(
    startDate.toISOString(),
    new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString() // Include full today
  );

  console.log('[DashboardDataService] Sessions in range:', {
    sessionsCount: sessions.length,
    dateRange: `${startDateKey} to ${todayKey}`,
    sessions: sessions.map(s => ({
      clockIn: s.clockIn,
      clockOut: s.clockOut,
      durationMinutes: s.durationMinutes,
    })),
  });

  // Check if user is currently clocked in (any location)
  let isLive = false;
  for (const location of locations) {
    const activeSession = await db.getActiveSession(location.id);
    if (activeSession && !activeSession.clockOut) {
      isLive = true;
      break;
    }
  }

  // Build daily data for 14 days
  const days: DailyHoursData[] = [];
  let totalPlanned = 0;
  let totalActual = 0;

  for (let i = 13; i >= 0; i--) {
    const dayDate = subDays(today, i);
    const dateKey = format(dayDate, 'yyyy-MM-dd');
    const isToday = dateKey === todayKey;
    const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

    // Check if this day is before account was created
    const isPreAccount = accountStartDate ? isBefore(dayDate, accountStartDate) : false;

    // For pre-account days, don't calculate any data
    if (isPreAccount) {
      days.push({
        date: dateKey,
        plannedMinutes: 0,
        actualMinutes: 0,
        isConfirmed: false,
        isToday,
        isPreAccount: true,
        hasVacation: false,
        hasSick: false,
      });
      continue;
    }

    // Get absences for this day
    const dayAbsences = getAbsencesForDate(absenceInstances, dateKey);
    const hasVacation = dayAbsences.some((a) => a.type === 'vacation');
    const hasSick = dayAbsences.some((a) => a.type === 'sick');

    // Calculate planned minutes (raw)
    const rawPlannedMinutes = computePlannedMinutes(instances, dateKey);

    // Calculate effective planned minutes (accounting for absences)
    const shiftsForDay = Object.values(instances).filter((i) => i.date === dateKey);
    const plannedMinutes = dayAbsences.length > 0
      ? calculateEffectivePlannedMinutes(shiftsForDay, dayAbsences)
      : rawPlannedMinutes;

    // Calculate actual minutes from sessions
    let actualMinutes = 0;
    for (const session of sessions) {
      const sessionStart = new Date(session.clockIn);
      let sessionEnd: Date;

      if (session.clockOut) {
        sessionEnd = new Date(session.clockOut);
      } else if (isToday) {
        // Active session: use current time
        sessionEnd = new Date();
      } else {
        // Skip incomplete sessions for past days
        continue;
      }

      const overlap = computeOverlapMinutes(sessionStart, sessionEnd, dayStart, dayEnd);
      actualMinutes += overlap;
    }

    // Check if day is confirmed
    const isConfirmed = confirmedDays[dateKey]?.status === 'confirmed';

    days.push({
      date: dateKey,
      plannedMinutes,
      actualMinutes,
      isConfirmed,
      isToday,
      isPreAccount: false,
      hasVacation,
      hasSick,
    });

    totalPlanned += plannedMinutes;
    totalActual += actualMinutes;
  }

  // Find next shift
  const nextShift = findNextShift(instances, todayKey);

  return {
    hoursSummary: {
      days,
      totalPlanned,
      totalActual,
      deviation: totalActual - totalPlanned,
    },
    nextShift,
    isLive,
  };
}

/**
 * Find the next upcoming shift instance
 */
function findNextShift(
  instances: Record<string, ShiftInstance>,
  todayKey: string
): NextShiftData | null {
  const now = new Date();
  const today = startOfDay(now);

  // Filter and sort instances by date and time
  const futureInstances = Object.values(instances)
    .filter((instance) => {
      const instanceDate = parseISO(instance.date);

      // If instance is in the future (after today), include it
      if (isAfter(instanceDate, today)) {
        return true;
      }

      // If instance is today, check if start time is in the future
      if (instance.date === todayKey) {
        const [hours, minutes] = instance.startTime.split(':').map(Number);
        const instanceDateTime = new Date(today);
        instanceDateTime.setHours(hours, minutes, 0, 0);
        return isAfter(instanceDateTime, now);
      }

      return false;
    })
    .sort((a, b) => {
      // Sort by date first
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      // Then by start time
      return a.startTime.localeCompare(b.startTime);
    });

  if (futureInstances.length === 0) {
    return null;
  }

  const next = futureInstances[0];
  return {
    date: next.date,
    startTime: next.startTime,
    endTime: next.endTime,
    name: next.name,
    color: next.color,
  };
}
