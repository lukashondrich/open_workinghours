import { formatManagedEventNotes } from '../CalendarExportMarker';
import { CalendarExportReconciler } from '../CalendarExportReconciler';
import { createCalendarExportWindow } from '../CalendarExportDateWindow';
import { buildDesiredManagedCalendarEvents } from '../CalendarExportNormalize';

describe('CalendarExportReconciler', () => {
  function createStorageMock() {
    return {
      getShiftInstancesForDateRange: jest.fn(),
      getAbsenceInstancesForDateRange: jest.fn(),
      loadDeviceCalendarMappings: jest.fn(),
      saveDeviceCalendarMapping: jest.fn(),
      deleteDeviceCalendarMapping: jest.fn(),
    };
  }

  function createDeviceCalendarServiceMock() {
    return {
      getEvents: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };
  }

  it('creates missing desired events and stores mappings', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.getShiftInstancesForDateRange.mockResolvedValue([
      {
        id: 'shift-1',
        templateId: 'template-1',
        date: '2026-04-27',
        startTime: '08:00',
        duration: 480,
        endTime: '16:00',
        color: 'teal',
        name: 'Early Shift',
      },
    ]);
    storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
    storage.loadDeviceCalendarMappings.mockResolvedValue({});
    deviceCalendarService.getEvents.mockResolvedValue([]);
    deviceCalendarService.createEvent.mockResolvedValue('native-event-1');

    const reconciler = new CalendarExportReconciler(storage as any, deviceCalendarService as any);
    const result = await reconciler.reconcileManagedCalendar('calendar-1', new Date(2026, 3, 27, 9, 0));

    expect(result).toEqual({
      created: 1,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      repairedMappings: 0,
    });
    expect(deviceCalendarService.createEvent).toHaveBeenCalledTimes(1);
    expect(storage.saveDeviceCalendarMapping).toHaveBeenCalledWith({
      appId: 'shift:shift-1',
      nativeEventId: 'native-event-1',
      entityType: 'shift',
      fingerprint: expect.any(String),
    });
  });

  it('updates externally edited events matched through an existing mapping', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.getShiftInstancesForDateRange.mockResolvedValue([
      {
        id: 'shift-1',
        templateId: 'template-1',
        date: '2026-04-27',
        startTime: '08:00',
        duration: 480,
        endTime: '16:00',
        color: 'teal',
        name: 'Early Shift',
      },
    ]);
    storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
    storage.loadDeviceCalendarMappings.mockResolvedValue({
      'shift:shift-1': {
        appId: 'shift:shift-1',
        nativeEventId: 'native-event-1',
        entityType: 'shift',
        fingerprint: 'stale-fingerprint',
        updatedAt: '2026-04-27T08:00:00.000Z',
      },
    });
    deviceCalendarService.getEvents.mockResolvedValue([
      {
        id: 'native-event-1',
        calendarId: 'calendar-1',
        title: 'Edited in Calendar',
        startDate: new Date(2026, 3, 27, 8, 0),
        endDate: new Date(2026, 3, 27, 16, 0),
        allDay: false,
        notes: null,
      },
    ]);

    const reconciler = new CalendarExportReconciler(storage as any, deviceCalendarService as any);
    const result = await reconciler.reconcileManagedCalendar('calendar-1', new Date(2026, 3, 27, 9, 0));

    expect(result.updated).toBe(1);
    expect(result.repairedMappings).toBe(1);
    expect(deviceCalendarService.updateEvent).toHaveBeenCalledWith(
      'native-event-1',
      expect.objectContaining({
        title: 'Early Shift',
        notes: expect.stringContaining('owh:type=shift'),
      }),
    );
  });

  it('repairs missing mappings when a valid marker exists', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    const now = new Date(2026, 3, 27, 9, 0);
    const [desiredAbsence] = buildDesiredManagedCalendarEvents({
      shifts: [],
      absences: [
        {
          id: 'absence-1',
          templateId: null,
          type: 'vacation',
          date: '2026-04-28',
          startTime: '00:00',
          endTime: '23:59',
          isFullDay: true,
          name: 'Vacation',
          color: '#CCCCCC',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      window: createCalendarExportWindow(now),
    });

    storage.getShiftInstancesForDateRange.mockResolvedValue([]);
    storage.getAbsenceInstancesForDateRange.mockResolvedValue([
      {
        id: 'absence-1',
        templateId: null,
        type: 'vacation',
        date: '2026-04-28',
        startTime: '00:00',
        endTime: '23:59',
        isFullDay: true,
        name: 'Vacation',
        color: '#CCCCCC',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
    storage.loadDeviceCalendarMappings.mockResolvedValue({});
    deviceCalendarService.getEvents.mockResolvedValue([
      {
        id: 'native-event-absence-1',
        calendarId: 'calendar-1',
        title: 'Vacation',
        startDate: new Date(2026, 3, 28, 0, 0),
        endDate: new Date(2026, 3, 29, 0, 0),
        allDay: true,
        notes: desiredAbsence.notes,
      },
    ]);

    const reconciler = new CalendarExportReconciler(storage as any, deviceCalendarService as any);
    const result = await reconciler.reconcileManagedCalendar('calendar-1', now);

    expect(result).toEqual({
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: 1,
      repairedMappings: 1,
    });
    expect(storage.saveDeviceCalendarMapping).toHaveBeenCalledWith({
      appId: 'absence:absence-1',
      nativeEventId: 'native-event-absence-1',
      entityType: 'absence',
      fingerprint: desiredAbsence.fingerprint,
    });
  });

  it('does not update when provider-normalized notes keep the same managed fingerprint', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    const now = new Date(2026, 3, 27, 9, 0);
    const [desiredShift] = buildDesiredManagedCalendarEvents({
      shifts: [
        {
          id: 'shift-1',
          templateId: 'template-1',
          date: '2026-04-27',
          startTime: '08:00',
          duration: 480,
          endTime: '16:00',
          color: 'teal',
          name: 'Early Shift',
        },
      ],
      absences: [],
      window: createCalendarExportWindow(now),
    });

    storage.getShiftInstancesForDateRange.mockResolvedValue([
      {
        id: 'shift-1',
        templateId: 'template-1',
        date: '2026-04-27',
        startTime: '08:00',
        duration: 480,
        endTime: '16:00',
        color: 'teal',
        name: 'Early Shift',
      },
    ]);
    storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
    storage.loadDeviceCalendarMappings.mockResolvedValue({
      'shift:shift-1': {
        appId: 'shift:shift-1',
        nativeEventId: 'native-event-1',
        entityType: 'shift',
        fingerprint: desiredShift.fingerprint,
        updatedAt: '2026-04-27T08:00:00.000Z',
      },
    });
    deviceCalendarService.getEvents.mockResolvedValue([
      {
        id: 'native-event-1',
        calendarId: 'calendar-1',
        title: 'Early Shift',
        startDate: new Date(2026, 3, 27, 8, 0),
        endDate: new Date(2026, 3, 27, 16, 0),
        allDay: false,
        notes: `${desiredShift.notes}\n`,
      },
    ]);

    const reconciler = new CalendarExportReconciler(storage as any, deviceCalendarService as any);
    const result = await reconciler.reconcileManagedCalendar('calendar-1', now);

    expect(result).toEqual({
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: 1,
      repairedMappings: 0,
    });
    expect(deviceCalendarService.updateEvent).not.toHaveBeenCalled();
  });

  it('deletes stale future managed events but keeps past ones during normal reconciliation', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    const futureNotes = formatManagedEventNotes('Future Shift', {
      entityType: 'shift',
      appId: 'shift:future-shift',
      fingerprint: 'fp-future',
    });
    const pastNotes = formatManagedEventNotes('Past Shift', {
      entityType: 'shift',
      appId: 'shift:past-shift',
      fingerprint: 'fp-past',
    });

    storage.getShiftInstancesForDateRange.mockResolvedValue([]);
    storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
    storage.loadDeviceCalendarMappings.mockResolvedValue({});
    deviceCalendarService.getEvents.mockResolvedValue([
      {
        id: 'future-native-event',
        calendarId: 'calendar-1',
        title: 'Future Shift',
        startDate: new Date(2026, 3, 28, 8, 0),
        endDate: new Date(2026, 3, 28, 16, 0),
        allDay: false,
        notes: futureNotes,
      },
      {
        id: 'past-native-event',
        calendarId: 'calendar-1',
        title: 'Past Shift',
        startDate: new Date(2026, 3, 20, 8, 0),
        endDate: new Date(2026, 3, 20, 16, 0),
        allDay: false,
        notes: pastNotes,
      },
    ]);

    const reconciler = new CalendarExportReconciler(storage as any, deviceCalendarService as any);
    const result = await reconciler.reconcileManagedCalendar('calendar-1', new Date(2026, 3, 27, 9, 0));

    expect(result.deleted).toBe(1);
    expect(deviceCalendarService.deleteEvent).toHaveBeenCalledWith('future-native-event');
    expect(deviceCalendarService.deleteEvent).not.toHaveBeenCalledWith('past-native-event');
    expect(storage.deleteDeviceCalendarMapping).toHaveBeenCalledWith('shift:future-shift');
  });
});
