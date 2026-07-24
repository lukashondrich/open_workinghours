import { subDays, startOfDay, format, isBefore, isAfter, parseISO } from 'date-fns';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { ShiftInstance, ShiftColor, AbsenceInstance } from '@/lib/calendar/types';
import {
  getAbsencesForDate,
  hasConfirmableActivity,
} from '@/lib/calendar/calendar-utils';
import { computeEffectivePlannedMinutesForDate, getDayBounds, computeOverlapMinutes } from '@/lib/calendar/time-calculations';

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
    // totalPlanned/totalActual/deviation share one scope: elapsed days only
    // (today excluded — it would read negative mid-shift). This keeps
    // deviation === totalActual - totalPlanned true in the UI. The per-day
    // `days` array still includes today for the chart.
    totalPlanned: number;
    totalActual: number;
    deviation: number;
    eligibleDayCount: number; // elapsed days with activity (confirmable)
    confirmedDayCount: number; // subset of eligible days confirmed
  };
  nextShift: NextShiftData | null;
  isLive: boolean; // true if user is currently clocked in
}


/**
 * Load dashboard data for the Status screen
 * Returns 14-day rolling data + next shift info
 *
 * @param accountCreatedAt - ISO 8601 date string when account was created (optional)
 *                           If provided, days before this date are marked as isPreAccount
 */
export async function loadDashboardData(accountCreatedAt?: string): Promise<DashboardData> {
  const db = await getDatabase();
  const storage = await getCalendarStorage();

  // Load all data sources
  const [instances, confirmedDays, locations, absenceInstances] = await Promise.all([
    storage.loadInstances(),
    storage.loadConfirmedDays(),
    db.getActiveLocations(),
    storage.loadAbsenceInstances(),
  ]);

  // Calculate date range: last 14 days including today
  const today = startOfDay(new Date());
  const todayKey = format(today, 'yyyy-MM-dd');
  const startDate = subDays(today, 13);

  // Parse account creation date if provided
  const accountStartDate = accountCreatedAt ? startOfDay(parseISO(accountCreatedAt)) : null;

  // Get sessions for the date range
  const sessions = await db.getSessionsBetween(
    startDate.toISOString(),
    new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString() // Include full today
  );

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
  let eligibleDayCount = 0;
  let confirmedDayCount = 0;

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

    // Calculate planned minutes (accounting for absences + overnight shifts)
    const plannedMinutes = computeEffectivePlannedMinutesForDate(instances, absenceInstances, dateKey);

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

    // Displayed totals and confirmation completeness only consider elapsed
    // days — one shared scope keeps Soll/Ist/deviation arithmetic honest.
    // (!isToday here ≡ getMonthSummary's dateKey < todayKey: the 14-day
    // window ends at today, so every non-today day is in the past.)
    if (!isToday) {
      totalPlanned += plannedMinutes;
      totalActual += actualMinutes;

      if (hasConfirmableActivity(plannedMinutes, actualMinutes, hasVacation, hasSick)) {
        eligibleDayCount++;
        if (isConfirmed) confirmedDayCount++;
      }
    }
  }

  // Find next shift
  const nextShift = findNextShift(instances, todayKey);

  return {
    hoursSummary: {
      days,
      totalPlanned,
      totalActual,
      deviation: totalActual - totalPlanned,
      eligibleDayCount,
      confirmedDayCount,
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
