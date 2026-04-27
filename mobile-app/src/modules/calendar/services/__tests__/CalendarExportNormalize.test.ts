import type { AbsenceInstance, ShiftInstance } from '@/lib/calendar/types';

import { createCalendarExportWindow } from '../CalendarExportDateWindow';
import { buildDesiredManagedCalendarEvents } from '../CalendarExportNormalize';
import { parseManagedEventMarker } from '../CalendarExportMarker';

function makeShift(overrides: Partial<ShiftInstance> & { id: string; date: string; startTime: string; duration: number }): ShiftInstance {
  return {
    id: overrides.id,
    templateId: 'template-1',
    date: overrides.date,
    startTime: overrides.startTime,
    duration: overrides.duration,
    endTime: '00:00',
    color: 'teal',
    name: 'Shift',
    ...overrides,
  };
}

function makeAbsence(
  overrides: Partial<AbsenceInstance> & { id: string; date: string; name: string },
): AbsenceInstance {
  return {
    id: overrides.id,
    templateId: null,
    type: 'vacation',
    date: overrides.date,
    startTime: '00:00',
    endTime: '23:59',
    isFullDay: true,
    name: overrides.name,
    color: '#CCCCCC',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CalendarExportNormalize', () => {
  it('builds desired events for today-forward data and preserves ordering', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 9, 0), 365);
    const events = buildDesiredManagedCalendarEvents({
      shifts: [
        makeShift({ id: 'shift-a', date: '2026-04-27', startTime: '08:00', duration: 480, name: 'Early Shift' }),
      ],
      absences: [
        makeAbsence({ id: 'absence-a', date: '2026-04-28', name: 'Vacation' }),
      ],
      window,
    });

    expect(events.map((event) => event.appId)).toEqual(['shift:shift-a', 'absence:absence-a']);
    expect(events[0].fingerprint).toBeTruthy();
    expect(events[1].allDay).toBe(true);
  });

  it('includes an overnight shift that started yesterday but is still active today', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 1, 0), 365);
    const events = buildDesiredManagedCalendarEvents({
      shifts: [
        makeShift({ id: 'overnight-1', date: '2026-04-26', startTime: '22:00', duration: 480, name: 'Night Shift' }),
      ],
      absences: [],
      window,
    });

    expect(events).toHaveLength(1);
    expect(events[0].startDate.getDate()).toBe(26);
    expect(events[0].endDate.getDate()).toBe(27);
  });

  it('excludes fully historical rows that should not be newly exported', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 9, 0), 365);
    const events = buildDesiredManagedCalendarEvents({
      shifts: [
        makeShift({ id: 'old-shift', date: '2026-04-25', startTime: '08:00', duration: 480, name: 'Old Shift' }),
      ],
      absences: [],
      window,
    });

    expect(events).toEqual([]);
  });

  it('writes a parseable marker into notes', () => {
    const window = createCalendarExportWindow(new Date(2026, 3, 27, 9, 0), 365);
    const [event] = buildDesiredManagedCalendarEvents({
      shifts: [
        makeShift({ id: 'shift-a', date: '2026-04-27', startTime: '08:00', duration: 480, name: 'Early Shift' }),
      ],
      absences: [],
      window,
    });

    expect(parseManagedEventMarker(event.notes)).toEqual({
      status: 'valid',
      marker: {
        entityType: 'shift',
        appId: 'shift:shift-a',
        fingerprint: event.fingerprint,
      },
    });
  });
});
