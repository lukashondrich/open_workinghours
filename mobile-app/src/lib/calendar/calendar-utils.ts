import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import type { ShiftColor, ShiftInstance, TrackingRecord } from './types';

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getMonthDays(month: Date): Date[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return eachDayOfInterval({ start, end });
}

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
}

const COLOR_MAP = {
  // Primary brand color (hospital teal/green)
  teal: {
    bg: '#E6F5F1',
    border: '#96D6C8',
    text: '#134532',
    dot: '#2E8B6B',
  },
  blue: {
    bg: '#E3F2FD',
    border: '#90CAF9',
    text: '#0D47A1',
    dot: '#1E88E5',
  },
  green: {
    bg: '#E8F5E9',
    border: '#A5D6A7',
    text: '#1B5E20',
    dot: '#2E7D32',
  },
  amber: {
    bg: '#FFF8E1',
    border: '#FFE082',
    text: '#E65100',
    dot: '#FF8F00',
  },
  rose: {
    bg: '#FCE4EC',
    border: '#F48FB1',
    text: '#880E4F',
    dot: '#D81B60',
  },
  purple: {
    bg: '#F3E5F5',
    border: '#CE93D8',
    text: '#4A148C',
    dot: '#8E24AA',
  },
  // Keep cyan for backwards compatibility, but prefer teal
  cyan: {
    bg: '#E0F7FA',
    border: '#80DEEA',
    text: '#006064',
    dot: '#00ACC1',
  },
} as const;

const CLASS_MAP = {
  // Primary brand color (hospital teal/green)
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-950',
    border: 'border-teal-400 dark:border-teal-600',
    text: 'text-teal-900 dark:text-teal-100',
    dot: 'bg-teal-500',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    border: 'border-blue-400 dark:border-blue-600',
    text: 'text-blue-900 dark:text-blue-100',
    dot: 'bg-blue-500',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-950',
    border: 'border-green-400 dark:border-green-600',
    text: 'text-green-900 dark:text-green-100',
    dot: 'bg-green-500',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    border: 'border-amber-400 dark:border-amber-600',
    text: 'text-amber-900 dark:text-amber-100',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-950',
    border: 'border-rose-400 dark:border-rose-600',
    text: 'text-rose-900 dark:text-rose-100',
    dot: 'bg-rose-500',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-950',
    border: 'border-purple-400 dark:border-purple-600',
    text: 'text-purple-900 dark:text-purple-100',
    dot: 'bg-purple-500',
  },
  cyan: {
    bg: 'bg-cyan-100 dark:bg-cyan-950',
    border: 'border-cyan-400 dark:border-cyan-600',
    text: 'text-cyan-900 dark:text-cyan-100',
    dot: 'bg-cyan-500',
  },
} as const;

export function getColorClasses(color: ShiftColor) {
  return CLASS_MAP[color];
}

export function getColorPalette(color: ShiftColor) {
  return COLOR_MAP[color];
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) {
    return `${mins}min`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

/**
 * Load real tracking records from geofencing sessions in workinghours.db
 *
 * @param startDate - Start date of range (YYYY-MM-DD)
 * @param endDate - End date of range (YYYY-MM-DD)
 * @returns Promise of tracking records by ID
 */
export async function loadRealTrackingRecords(startDate: string, endDate: string): Promise<Record<string, TrackingRecord>> {
  const { getDatabase } = await import('@/modules/geofencing/services/Database');
  const db = await getDatabase();

  // Convert date strings to ISO timestamps for query
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const startIso = new Date(startYear, startMonth - 1, startDay, 0, 0, 0).toISOString();
  const endIso = new Date(endYear, endMonth - 1, endDay, 23, 59, 59).toISOString();

  const sessions = await db.getSessionsBetween(startIso, endIso);

  const trackingRecords: Record<string, TrackingRecord> = {};

  sessions.forEach((session) => {
    const clockInDate = new Date(session.clockIn);

    // For active sessions (no clock-out), use current time as end time
    const isActive = !session.clockOut;
    const clockOutDate = session.clockOut ? new Date(session.clockOut) : new Date();

    // Extract date (YYYY-MM-DD) from clock-in time
    const date = format(clockInDate, 'yyyy-MM-dd');

    // Extract start time (HH:mm)
    const startTime = format(clockInDate, 'HH:mm');

    // Calculate duration in minutes
    const durationMs = clockOutDate.getTime() - clockInDate.getTime();
    const duration = Math.round(durationMs / 60000); // Convert ms to minutes

    // Create tracking record
    const trackingId = `tracking-session-${session.id}`;
    trackingRecords[trackingId] = {
      id: trackingId,
      date,
      startTime,
      duration,
      isActive,
    };
  });

  return trackingRecords;
}

export function generateSimulatedTracking(instances: Record<string, ShiftInstance>): Record<string, TrackingRecord> {
  const trackingRecords: Record<string, TrackingRecord> = {};
  const instancesByDate: Record<string, ShiftInstance[]> = {};
  Object.values(instances).forEach((instance) => {
    if (!instancesByDate[instance.date]) {
      instancesByDate[instance.date] = [];
    }
    instancesByDate[instance.date].push(instance);
  });

  Object.entries(instancesByDate).forEach(([date, dateInstances]) => {
    dateInstances.forEach((instance) => {
      const variance = Math.random();
      let startTime = instance.startTime;
      let duration = instance.duration;
      if (variance < 0.3) {
        const lateMinutes = Math.floor(Math.random() * 4) * 5 + 5;
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + lateMinutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMinutes = totalMinutes % 60;
        startTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
        duration = Math.max(5, duration - lateMinutes);
      } else if (variance < 0.5) {
        const earlyMinutes = Math.floor(Math.random() * 3) * 5 + 5;
        duration = Math.max(5, duration - earlyMinutes);
      } else if (variance < 0.65) {
        const extraMinutes = Math.floor(Math.random() * 5) * 5 + 10;
        duration = duration + extraMinutes;
      }
      const trackingId = `tracking-${date}-${instance.id}`;
      trackingRecords[trackingId] = {
        id: trackingId,
        date,
        startTime,
        duration,
      };
    });
  });

  if (Math.random() < 0.1 && Object.keys(instancesByDate).length > 0) {
    const dates = Object.keys(instancesByDate);
    const randomDate = dates[Math.floor(Math.random() * dates.length)];
    const unexpectedId = `tracking-unexpected-${randomDate}`;
    trackingRecords[unexpectedId] = {
      id: unexpectedId,
      date: randomDate,
      startTime: '14:00',
      duration: 120,
    };
  }

  return trackingRecords;
}

export function generateHourMarkers(): string[] {
  const hours: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    hours.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return hours;
}

export function calculateShiftDisplay(
  startTime: string,
  duration: number,
  slotHeight: number = 40,
): {
  topOffset: number;
  height: number;
  spansNextDay: boolean;
  nextDayHeight: number;
} {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  const minutesInDay = 24 * 60;
  const topOffset = (startMinutes / 60) * slotHeight;
  if (endMinutes <= minutesInDay) {
    return {
      topOffset,
      height: (duration / 60) * slotHeight,
      spansNextDay: false,
      nextDayHeight: 0,
    };
  }
  const remainingMinutesToday = minutesInDay - startMinutes;
  const minutesNextDay = endMinutes - minutesInDay;
  return {
    topOffset,
    height: (remainingMinutesToday / 60) * slotHeight,
    spansNextDay: true,
    nextDayHeight: (minutesNextDay / 60) * slotHeight,
  };
}

export function getInstancesForDate(
  instances: Record<string, ShiftInstance>,
  date: string,
  previousDate: string | null,
): { current: ShiftInstance[]; fromPrevious: ShiftInstance[] } {
  const current = Object.values(instances).filter((instance) => instance.date === date);
  const fromPrevious = previousDate
    ? Object.values(instances).filter((instance) => {
        if (instance.date !== previousDate) return false;
        const startMinutes = timeToMinutes(instance.startTime);
        const endMinutes = startMinutes + instance.duration;
        return endMinutes > 24 * 60;
      })
    : [];
  return { current, fromPrevious };
}
