import type { AbsenceInstance, ShiftInstance } from '@/lib/calendar/types';

import { createManagedEventFingerprint } from './CalendarExportFingerprint';
import { isWithinCalendarExportWindow, getNextDateKey } from './CalendarExportDateWindow';
import { formatManagedEventNotes } from './CalendarExportMarker';
import type {
  BuildDesiredManagedEventsInput,
  CalendarExportWindow,
  DesiredManagedCalendarEvent,
  ManagedCalendarEntityType,
} from './CalendarExportTypes';

function buildManagedAppId(entityType: ManagedCalendarEntityType, sourceId: string): string {
  return `${entityType}:${sourceId}`;
}

function createLocalDate(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function createLocalMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function finalizeDesiredEvent(
  event: Omit<DesiredManagedCalendarEvent, 'notes' | 'fingerprint'>,
): DesiredManagedCalendarEvent {
  const fingerprint = createManagedEventFingerprint({
    entityType: event.entityType,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
  });

  return {
    ...event,
    fingerprint,
    notes: formatManagedEventNotes(event.title, {
      entityType: event.entityType,
      appId: event.appId,
      fingerprint,
    }),
  };
}

function normalizeShiftInstance(
  instance: ShiftInstance,
  window: CalendarExportWindow,
): DesiredManagedCalendarEvent | null {
  const startDate = createLocalDate(instance.date, instance.startTime);
  const endDate = new Date(startDate.getTime() + instance.duration * 60000);

  if (!isWithinCalendarExportWindow(startDate, endDate, window)) {
    return null;
  }

  return finalizeDesiredEvent({
    appId: buildManagedAppId('shift', instance.id),
    entityType: 'shift',
    sourceId: instance.id,
    title: instance.name,
    startDate,
    endDate,
    allDay: false,
  });
}

function normalizeAbsenceInstance(
  instance: AbsenceInstance,
  window: CalendarExportWindow,
): DesiredManagedCalendarEvent | null {
  const startDate = instance.isFullDay
    ? createLocalMidnight(instance.date)
    : createLocalDate(instance.date, instance.startTime);

  const endDate = instance.isFullDay
    ? createLocalMidnight(getNextDateKey(instance.date))
    : (() => {
        const sameDayEnd = createLocalDate(instance.date, instance.endTime);
        if (sameDayEnd > startDate) {
          return sameDayEnd;
        }

        return createLocalDate(getNextDateKey(instance.date), instance.endTime);
      })();

  if (!isWithinCalendarExportWindow(startDate, endDate, window)) {
    return null;
  }

  return finalizeDesiredEvent({
    appId: buildManagedAppId('absence', instance.id),
    entityType: 'absence',
    sourceId: instance.id,
    title: instance.name,
    startDate,
    endDate,
    allDay: instance.isFullDay,
  });
}

export function buildDesiredManagedCalendarEvents(
  input: BuildDesiredManagedEventsInput,
): DesiredManagedCalendarEvent[] {
  const shiftEvents = input.shifts
    .map((instance) => normalizeShiftInstance(instance, input.window))
    .filter((event): event is DesiredManagedCalendarEvent => event !== null);

  const absenceEvents = input.absences
    .map((instance) => normalizeAbsenceInstance(instance, input.window))
    .filter((event): event is DesiredManagedCalendarEvent => event !== null);

  return [...shiftEvents, ...absenceEvents].sort((left, right) => {
    const startDifference = left.startDate.getTime() - right.startDate.getTime();
    if (startDifference !== 0) {
      return startDifference;
    }

    return left.appId.localeCompare(right.appId);
  });
}

export function buildDesiredManagedShiftEvents(
  shifts: ShiftInstance[],
  window: CalendarExportWindow,
): DesiredManagedCalendarEvent[] {
  return shifts
    .map((instance) => normalizeShiftInstance(instance, window))
    .filter((event): event is DesiredManagedCalendarEvent => event !== null);
}

export function buildDesiredManagedAbsenceEvents(
  absences: AbsenceInstance[],
  window: CalendarExportWindow,
): DesiredManagedCalendarEvent[] {
  return absences
    .map((instance) => normalizeAbsenceInstance(instance, window))
    .filter((event): event is DesiredManagedCalendarEvent => event !== null);
}
