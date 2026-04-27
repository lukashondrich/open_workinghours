describe('DeviceCalendarService', () => {
  const expoCalendarMock = {
    getCalendarPermissionsAsync: jest.fn(),
    requestCalendarPermissionsAsync: jest.fn(),
    getCalendarsAsync: jest.fn(),
    getDefaultCalendarAsync: jest.fn(),
    createCalendarAsync: jest.fn(),
    updateCalendarAsync: jest.fn(),
    deleteCalendarAsync: jest.fn(),
    getEventsAsync: jest.fn(),
    createEventAsync: jest.fn(),
    updateEventAsync: jest.fn(),
    deleteEventAsync: jest.fn(),
    EntityTypes: {
      EVENT: 'event',
    },
    CalendarAccessLevel: {
      OWNER: 'owner',
    },
    SourceType: {
      LOCAL: 'local',
    },
  };

  beforeEach(() => {
    Object.values(expoCalendarMock).forEach((value) => {
      if (typeof value === 'function' && 'mockReset' in value) {
        (value as jest.Mock).mockReset();
      }
    });
    jest.resetModules();
  });

  async function loadService(platformOS: 'ios' | 'android') {
    jest.doMock('expo-calendar', () => expoCalendarMock, { virtual: true });
    jest.doMock('react-native', () => ({
      Platform: { OS: platformOS },
    }));

    const { DeviceCalendarService } = require('../DeviceCalendarService');
    return new DeviceCalendarService();
  }

  it('maps permission state from Expo', async () => {
    expoCalendarMock.getCalendarPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });

    const service = await loadService('ios');
    await expect(service.getPermissionState()).resolves.toEqual({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
  });

  it('creates a managed iOS calendar using the default source', async () => {
    expoCalendarMock.getDefaultCalendarAsync.mockResolvedValue({
      source: { id: 'source-1', name: 'iCloud', type: 'caldav' },
    });
    expoCalendarMock.createCalendarAsync.mockResolvedValue('calendar-1');

    const service = await loadService('ios');
    const id = await service.createManagedCalendar({
      title: 'Open Working Hours',
      color: '#0F766E',
      targetMode: 'ios-default',
    });

    expect(id).toBe('calendar-1');
    expect(expoCalendarMock.createCalendarAsync).toHaveBeenCalledWith({
      title: 'Open Working Hours',
      color: '#0F766E',
      entityType: 'event',
      sourceId: 'source-1',
      source: { id: 'source-1', name: 'iCloud', type: 'caldav' },
    });
  });

  it('resolves Android account and local targets from writable calendars', async () => {
    expoCalendarMock.getCalendarsAsync.mockResolvedValue([
      {
        id: 'calendar-1',
        title: 'Google',
        allowsModifications: true,
        isSynced: true,
        source: { id: 'google-1', name: 'Google', type: 'com.google' },
      },
      {
        id: 'calendar-2',
        title: 'Device Calendar',
        allowsModifications: true,
        isSynced: false,
        source: { name: 'Local phone account', isLocalAccount: true },
      },
      {
        id: 'calendar-3',
        title: 'Read only',
        allowsModifications: false,
        source: { id: 'ignored', name: 'Ignored', type: 'com.other' },
      },
    ]);

    const service = await loadService('android');
    await expect(service.resolveAndroidTargets()).resolves.toEqual([
      {
        mode: 'android-account',
        source: { id: 'google-1', name: 'Google', type: 'com.google', isLocalAccount: undefined },
        label: 'Google',
        synced: true,
      },
      {
        mode: 'android-local',
        source: { id: undefined, name: 'Local phone account', type: undefined, isLocalAccount: true },
        label: 'Local phone account (Device only)',
        synced: false,
      },
    ]);
  });

  it('maps native events into service event records', async () => {
    expoCalendarMock.getEventsAsync.mockResolvedValue([
      {
        id: 'event-1',
        calendarId: 'calendar-1',
        title: 'Early Shift',
        startDate: '2026-04-27T06:00:00.000Z',
        endDate: '2026-04-27T14:00:00.000Z',
        allDay: false,
        notes: 'owh:type=shift',
      },
    ]);

    const service = await loadService('ios');
    const events = await service.getEvents(
      'calendar-1',
      new Date('2026-04-27T00:00:00.000Z'),
      new Date('2026-04-28T00:00:00.000Z'),
    );

    expect(events).toEqual([
      {
        id: 'event-1',
        calendarId: 'calendar-1',
        title: 'Early Shift',
        startDate: new Date('2026-04-27T06:00:00.000Z'),
        endDate: new Date('2026-04-27T14:00:00.000Z'),
        allDay: false,
        notes: 'owh:type=shift',
      },
    ]);
  });
});
