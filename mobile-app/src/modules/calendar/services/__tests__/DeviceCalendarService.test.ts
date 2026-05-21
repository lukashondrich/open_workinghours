describe('DeviceCalendarService', () => {
  let consoleWarnSpy: jest.SpyInstance;

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
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
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
      allowsModifications: true,
      source: { id: 'source-1', name: 'iCloud', type: 'caldav' },
    });
    expoCalendarMock.getCalendarsAsync.mockResolvedValue([]);
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

  it('falls back to a writable local iOS source when the default calendar is read-only', async () => {
    expoCalendarMock.getDefaultCalendarAsync.mockResolvedValue({
      allowsModifications: false,
      source: { id: 'source-1', name: 'Subscribed', type: 'caldav' },
    });
    expoCalendarMock.getCalendarsAsync.mockResolvedValue([
      {
        id: 'calendar-local',
        title: 'On My iPhone',
        allowsModifications: true,
        source: { id: 'local-1', name: 'On My iPhone', type: 'local' },
      },
      {
        id: 'calendar-remote',
        title: 'Work',
        allowsModifications: true,
        source: { id: 'remote-1', name: 'Work', type: 'exchange' },
      },
    ]);
    expoCalendarMock.createCalendarAsync.mockResolvedValue('calendar-2');

    const service = await loadService('ios');
    const id = await service.createManagedCalendar({
      title: 'Open Working Hours',
      color: '#0F766E',
      targetMode: 'ios-default',
    });

    expect(id).toBe('calendar-2');
    expect(expoCalendarMock.createCalendarAsync).toHaveBeenCalledWith({
      title: 'Open Working Hours',
      color: '#0F766E',
      entityType: 'event',
      sourceId: 'local-1',
      source: { id: 'local-1', name: 'On My iPhone', type: 'local', isLocalAccount: undefined },
    });
  });

  it('retries the next writable iOS source when calendar creation fails', async () => {
    expoCalendarMock.getDefaultCalendarAsync.mockResolvedValue({
      allowsModifications: true,
      source: { id: 'source-1', name: 'iCloud', type: 'caldav' },
    });
    expoCalendarMock.getCalendarsAsync.mockResolvedValue([
      {
        id: 'calendar-local',
        title: 'On My iPhone',
        allowsModifications: true,
        source: { id: 'local-1', name: 'On My iPhone', type: 'local' },
      },
    ]);
    expoCalendarMock.createCalendarAsync
      .mockRejectedValueOnce(new Error('Source is not writable'))
      .mockResolvedValueOnce('calendar-3');

    const service = await loadService('ios');
    const id = await service.createManagedCalendar({
      title: 'Open Working Hours',
      color: '#0F766E',
      targetMode: 'ios-default',
    });

    expect(id).toBe('calendar-3');
    expect(expoCalendarMock.createCalendarAsync).toHaveBeenNthCalledWith(1, {
      title: 'Open Working Hours',
      color: '#0F766E',
      entityType: 'event',
      sourceId: 'source-1',
      source: { id: 'source-1', name: 'iCloud', type: 'caldav', isLocalAccount: undefined },
    });
    expect(expoCalendarMock.createCalendarAsync).toHaveBeenNthCalledWith(2, {
      title: 'Open Working Hours',
      color: '#0F766E',
      entityType: 'event',
      sourceId: 'local-1',
      source: { id: 'local-1', name: 'On My iPhone', type: 'local', isLocalAccount: undefined },
    });
  });

  it('resolves Android account and local targets from writable calendars', async () => {
    expoCalendarMock.getCalendarsAsync.mockResolvedValue([
      {
        id: 'calendar-1',
        title: 'Google',
        allowsModifications: true,
        isSynced: true,
        source: { name: 'user@example.com', type: 'com.google', isLocalAccount: false },
      },
      {
        id: 'calendar-2',
        title: 'Device Calendar',
        allowsModifications: true,
        isSynced: false,
        source: { name: 'Local phone account', type: 'LOCAL', isLocalAccount: true },
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
        source: { id: undefined, name: 'user@example.com', type: 'com.google', isLocalAccount: false },
        sourceKey: ':user@example.com:com.google:remote',
        provider: 'google',
        providerLabel: 'Google',
        accountName: 'user@example.com',
        accountType: 'com.google',
        label: 'user@example.com (Google)',
        synced: true,
        recommended: true,
      },
      {
        mode: 'android-local',
        source: { id: undefined, name: 'Local phone account', type: 'LOCAL', isLocalAccount: true },
        sourceKey: ':Local phone account:LOCAL:local',
        provider: 'local',
        providerLabel: 'Device only',
        accountName: 'Local phone account',
        accountType: 'LOCAL',
        label: 'Local phone account (Device only)',
        synced: false,
        recommended: false,
      },
    ]);
  });

  it('keeps Samsung and Google calendars distinct when they use the same email address', async () => {
    expoCalendarMock.getCalendarsAsync.mockResolvedValue([
      {
        id: 'calendar-local',
        title: 'My calendar',
        allowsModifications: true,
        isSynced: true,
        source: { name: 'My calendar', type: 'LOCAL', isLocalAccount: true },
      },
      {
        id: 'calendar-samsung',
        title: 'Samsung Calendar',
        allowsModifications: true,
        isSynced: true,
        source: { name: 'lukashondrich@googlemail.com', type: 'com.osp.app.signin', isLocalAccount: false },
      },
      {
        id: 'calendar-google',
        title: 'lukashondrich@googlemail.com',
        allowsModifications: true,
        isSynced: true,
        source: { name: 'lukashondrich@googlemail.com', type: 'com.google', isLocalAccount: false },
      },
    ]);

    const service = await loadService('android');
    await expect(service.resolveAndroidTargets()).resolves.toEqual([
      expect.objectContaining({
        mode: 'android-account',
        sourceKey: ':lukashondrich@googlemail.com:com.google:remote',
        provider: 'google',
        providerLabel: 'Google',
        label: 'lukashondrich@googlemail.com (Google)',
        recommended: true,
      }),
      expect.objectContaining({
        mode: 'android-account',
        sourceKey: ':lukashondrich@googlemail.com:com.osp.app.signin:remote',
        provider: 'samsung',
        providerLabel: 'Samsung',
        label: 'lukashondrich@googlemail.com (Samsung)',
        recommended: false,
      }),
      expect.objectContaining({
        mode: 'android-local',
        sourceKey: ':My calendar:LOCAL:local',
        provider: 'local',
        providerLabel: 'Device only',
        label: 'My calendar (Device only)',
        recommended: false,
      }),
    ]);
  });

  it('creates Android managed calendars as visible synced calendars', async () => {
    expoCalendarMock.createCalendarAsync.mockResolvedValue('calendar-android');

    const service = await loadService('android');
    const id = await service.createManagedCalendar({
      title: 'Open Working Hours',
      color: '#0F766E',
      targetMode: 'android-account',
      source: { name: 'user@example.com', type: 'com.google', isLocalAccount: false },
    });

    expect(id).toBe('calendar-android');
    expect(expoCalendarMock.createCalendarAsync).toHaveBeenCalledWith({
      title: 'Open Working Hours',
      color: '#0F766E',
      name: 'Open Working Hours',
      ownerAccount: 'user@example.com',
      accessLevel: 'owner',
      isVisible: true,
      isSynced: true,
      source: { name: 'user@example.com', type: 'com.google', isLocalAccount: false },
    });
  });

  it('falls back to an Android local account when no target source is available', async () => {
    expoCalendarMock.createCalendarAsync.mockResolvedValue('calendar-local');

    const service = await loadService('android');
    const id = await service.createManagedCalendar({
      title: 'Open Working Hours',
      color: '#0F766E',
      targetMode: 'android-local',
    });

    expect(id).toBe('calendar-local');
    expect(expoCalendarMock.createCalendarAsync).toHaveBeenCalledWith({
      title: 'Open Working Hours',
      color: '#0F766E',
      name: 'Open Working Hours',
      ownerAccount: 'Open Working Hours',
      accessLevel: 'owner',
      isVisible: true,
      isSynced: true,
      source: { isLocalAccount: true, name: 'Open Working Hours' },
    });
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
