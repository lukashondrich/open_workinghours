import { formatManagedEventNotes } from '../CalendarExportMarker';
import { CalendarExportManager } from '../CalendarExportManager';

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  SourceType: { LOCAL: 'local' },
  CalendarAccessLevel: { OWNER: 'owner' },
}), { virtual: true });

jest.mock('@/lib/events/scheduleEvents', () => ({
  scheduleEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}), { virtual: true });

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('CalendarExportManager', () => {
  function createStorageMock() {
    return {
      getShiftInstancesForDateRange: jest.fn(),
      getAbsenceInstancesForDateRange: jest.fn(),
      loadDeviceCalendarMappings: jest.fn(),
      saveDeviceCalendarMapping: jest.fn(),
      deleteDeviceCalendarMapping: jest.fn(),
      deleteAllDeviceCalendarMappings: jest.fn(),
      loadDeviceCalendarState: jest.fn(),
      saveDeviceCalendarState: jest.fn(),
      clearDeviceCalendarState: jest.fn(),
    };
  }

  function createDeviceCalendarServiceMock() {
    return {
      getPermissionState: jest.fn(),
      requestPermission: jest.fn(),
      findCalendarById: jest.fn(),
      findCalendarsByTitle: jest.fn(),
      getEvents: jest.fn(),
      resolveAndroidTargets: jest.fn(),
      createManagedCalendar: jest.fn(),
      updateCalendar: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
      deleteCalendar: jest.fn(),
    };
  }

  it('returns disabled when sync is not enabled in state', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue(null);

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.runSyncIfEnabled()).resolves.toEqual({ status: 'disabled' });
    expect(deviceCalendarService.getPermissionState).not.toHaveBeenCalled();
  });

  it('persists a permission error when sync is enabled but access is revoked', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: null,
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.runSyncIfEnabled()).resolves.toEqual({ status: 'blocked-permission' });
    expect(storage.saveDeviceCalendarState).toHaveBeenCalledWith({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: 'permission-denied',
    });
  });

  it('reuses an existing writable calendar and clears sync errors after reconcile', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: 'permission-denied',
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    storage.getShiftInstancesForDateRange.mockResolvedValue([]);
    storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
    storage.loadDeviceCalendarMappings.mockResolvedValue({});
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    deviceCalendarService.findCalendarById.mockResolvedValue({
      id: 'calendar-1',
      title: 'Open Working Hours',
      color: '#0F766E',
      allowsModifications: true,
      source: null,
      sourceId: null,
    });
    deviceCalendarService.getEvents.mockResolvedValue([]);

    const now = new Date(2026, 3, 27, 9, 0);
    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    const result = await manager.runSyncIfEnabled(now);

    expect(result).toEqual({
      status: 'ok',
      calendarId: 'calendar-1',
      result: {
        created: 0,
        updated: 0,
        deleted: 0,
        unchanged: 0,
        repairedMappings: 0,
      },
    });
    expect(storage.saveDeviceCalendarState).toHaveBeenCalledWith({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: now.toISOString(),
      lastSyncError: null,
    });
  });

  it('falls back to deleting managed events when calendar deletion throws', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: null,
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    storage.loadDeviceCalendarMappings.mockResolvedValue({});
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    deviceCalendarService.deleteCalendar.mockRejectedValue(new Error('calendar delete failed'));
    deviceCalendarService.getEvents.mockResolvedValue([
      {
        id: 'native-event-1',
        calendarId: 'calendar-1',
        title: 'Vacation',
        startDate: new Date(2026, 3, 28, 0, 0),
        endDate: new Date(2026, 3, 29, 0, 0),
        allDay: true,
        notes: formatManagedEventNotes('Vacation', {
          entityType: 'absence',
          appId: 'absence:absence-1',
          fingerprint: 'fp-1',
        }),
      },
    ]);

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    const result = await manager.deleteExportedCalendarData({
      now: new Date(2026, 3, 27, 9, 0),
    });

    expect(result).toEqual({ status: 'deleted', deletedEvents: 1 });
    expect(deviceCalendarService.deleteEvent).toHaveBeenCalledWith('native-event-1');
    expect(storage.deleteDeviceCalendarMapping).toHaveBeenCalledWith('absence:absence-1');
    expect(storage.deleteAllDeviceCalendarMappings).toHaveBeenCalled();
    expect(storage.clearDeviceCalendarState).toHaveBeenCalled();
  });

  it('returns blocked-permission when deleting exported data without calendar access', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: null,
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.deleteExportedCalendarData()).resolves.toEqual({ status: 'blocked-permission' });
    expect(storage.clearDeviceCalendarState).not.toHaveBeenCalled();
    expect(storage.deleteAllDeviceCalendarMappings).not.toHaveBeenCalled();
  });

  it('persists lastSyncError when ensureManagedCalendar throws', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'missing-calendar',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: null,
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    // Calendar not found and no recovery candidates
    deviceCalendarService.findCalendarById.mockResolvedValue(null);
    deviceCalendarService.findCalendarsByTitle.mockResolvedValue([]);
    // createManagedCalendar throws
    deviceCalendarService.createManagedCalendar.mockRejectedValue(
      new Error('Calendar creation failed: source not available'),
    );

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.runSyncIfEnabled()).rejects.toThrow('Calendar creation failed');

    // lastSyncError must be persisted so the UI can show it
    expect(storage.saveDeviceCalendarState).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncError: 'Calendar creation failed: source not available',
      }),
    );
  });

  it('persists lastSyncError when reconciler throws', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'calendar-1',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: null,
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    deviceCalendarService.findCalendarById.mockResolvedValue({
      id: 'calendar-1',
      title: 'Open Working Hours',
      color: '#0F766E',
      allowsModifications: true,
    });
    // Reconciler will throw because getShiftInstancesForDateRange is not mocked
    storage.getShiftInstancesForDateRange.mockRejectedValue(
      new Error('SQLite read failure'),
    );

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.runSyncIfEnabled()).rejects.toThrow('SQLite read failure');

    expect(storage.saveDeviceCalendarState).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncError: 'SQLite read failure',
      }),
    );
  });

  it('refuses to recover when multiple marker-bearing calendars share the managed title', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    storage.loadDeviceCalendarState.mockResolvedValue({
      enabled: true,
      calendarId: 'missing-calendar',
      targetSourceId: null,
      targetMode: 'ios-default',
      lastFullSyncAt: null,
      lastSyncError: null,
      updatedAt: '2026-04-27T08:00:00.000Z',
    });
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    deviceCalendarService.findCalendarById.mockResolvedValue(null);
    deviceCalendarService.findCalendarsByTitle.mockResolvedValue([
      {
        id: 'calendar-1',
        title: 'Open Working Hours',
        color: '#0F766E',
        allowsModifications: true,
        source: { id: 'source-1', name: 'iCloud', type: 'caldav', isLocalAccount: false },
        sourceId: 'source-1',
      },
      {
        id: 'calendar-2',
        title: 'Open Working Hours',
        color: '#0F766E',
        allowsModifications: true,
        source: { id: 'source-2', name: 'Local', type: 'local', isLocalAccount: true },
        sourceId: 'source-2',
      },
    ]);
    deviceCalendarService.getEvents
      .mockResolvedValueOnce([
        {
          id: 'native-event-1',
          calendarId: 'calendar-1',
          title: 'Shift',
          startDate: new Date(2026, 3, 28, 8, 0),
          endDate: new Date(2026, 3, 28, 16, 0),
          allDay: false,
          notes: formatManagedEventNotes('Shift', {
            entityType: 'shift',
            appId: 'shift:shift-1',
            fingerprint: 'fp-1',
          }),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'native-event-2',
          calendarId: 'calendar-2',
          title: 'Vacation',
          startDate: new Date(2026, 3, 29, 0, 0),
          endDate: new Date(2026, 3, 30, 0, 0),
          allDay: true,
          notes: formatManagedEventNotes('Vacation', {
            entityType: 'absence',
            appId: 'absence:absence-1',
            fingerprint: 'fp-2',
          }),
        },
      ]);

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.runSyncIfEnabled(new Date(2026, 3, 27, 9, 0))).rejects.toThrow(
      'Multiple managed calendar candidates were found; refusing to guess.',
    );
  });

  it('uses stable Android source keys when enabling sync for a selected account', async () => {
    const platform = require('react-native').Platform as { OS: string };
    const originalOS = platform.OS;
    platform.OS = 'android';

    try {
      const storage = createStorageMock();
      const deviceCalendarService = createDeviceCalendarServiceMock();
      const workSourceKey = ':work@example.com:com.google:remote';
      const targets = [
        {
          mode: 'android-account',
          source: { name: 'personal@example.com', type: 'com.google', isLocalAccount: false },
          sourceKey: ':personal@example.com:com.google:remote',
          label: 'personal@example.com',
          synced: true,
        },
        {
          mode: 'android-account',
          source: { name: 'work@example.com', type: 'com.google', isLocalAccount: false },
          sourceKey: workSourceKey,
          label: 'work@example.com',
          synced: true,
        },
      ];

      storage.loadDeviceCalendarState
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          enabled: true,
          calendarId: null,
          targetSourceId: workSourceKey,
          targetMode: 'android-account',
          lastFullSyncAt: null,
          lastSyncError: null,
          updatedAt: '2026-04-27T08:00:00.000Z',
        });
      storage.getShiftInstancesForDateRange.mockResolvedValue([]);
      storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
      storage.loadDeviceCalendarMappings.mockResolvedValue({});
      deviceCalendarService.getPermissionState.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      });
      deviceCalendarService.resolveAndroidTargets.mockResolvedValue(targets);
      deviceCalendarService.findCalendarsByTitle.mockResolvedValue([]);
      deviceCalendarService.createManagedCalendar.mockResolvedValue('calendar-android');
      deviceCalendarService.getEvents.mockResolvedValue([]);

      const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
      const result = await manager.enableSync({
        targetMode: 'android-account',
        targetSourceId: workSourceKey,
      });

      expect(result).toEqual({
        status: 'ok',
        calendarId: 'calendar-android',
        result: {
          created: 0,
          updated: 0,
          deleted: 0,
          unchanged: 0,
          repairedMappings: 0,
        },
      });
      expect(storage.saveDeviceCalendarState).toHaveBeenNthCalledWith(1, {
        enabled: true,
        calendarId: null,
        targetSourceId: workSourceKey,
        targetMode: 'android-account',
        lastFullSyncAt: null,
        lastSyncError: null,
      });
      expect(deviceCalendarService.createManagedCalendar).toHaveBeenCalledWith({
        title: 'Open Working Hours',
        color: '#0F766E',
        targetMode: 'android-account',
        source: targets[1].source,
      });
      expect(storage.saveDeviceCalendarState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          calendarId: 'calendar-android',
          targetSourceId: workSourceKey,
          targetMode: 'android-account',
          lastSyncError: null,
        }),
      );
    } finally {
      platform.OS = originalOS;
    }
  });

  it('requests calendar permission before Android target resolution needs calendar access', async () => {
    const storage = createStorageMock();
    const deviceCalendarService = createDeviceCalendarServiceMock();
    deviceCalendarService.getPermissionState.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });
    deviceCalendarService.requestPermission.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });

    const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
    await expect(manager.ensureCalendarPermission()).resolves.toEqual({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });
    expect(deviceCalendarService.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('falls back to an Android local calendar when account-backed calendar creation fails', async () => {
    const platform = require('react-native').Platform as { OS: string };
    const originalOS = platform.OS;
    platform.OS = 'android';
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const storage = createStorageMock();
      const deviceCalendarService = createDeviceCalendarServiceMock();
      const accountSourceKey = ':user@example.com:com.google:remote';
      const localSourceKey = ':My calendar:LOCAL:local';
      const targets = [
        {
          mode: 'android-account',
          source: { name: 'user@example.com', type: 'com.google', isLocalAccount: false },
          sourceKey: accountSourceKey,
          label: 'user@example.com (Google)',
          synced: true,
        },
        {
          mode: 'android-local',
          source: { name: 'My calendar', type: 'LOCAL', isLocalAccount: true },
          sourceKey: localSourceKey,
          label: 'My calendar (Device only)',
          synced: false,
        },
      ];

      storage.loadDeviceCalendarState
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          enabled: true,
          calendarId: null,
          targetSourceId: accountSourceKey,
          targetMode: 'android-account',
          lastFullSyncAt: null,
          lastSyncError: null,
          updatedAt: '2026-04-27T08:00:00.000Z',
        });
      storage.getShiftInstancesForDateRange.mockResolvedValue([]);
      storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
      storage.loadDeviceCalendarMappings.mockResolvedValue({});
      deviceCalendarService.getPermissionState.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      });
      deviceCalendarService.resolveAndroidTargets.mockResolvedValue(targets);
      deviceCalendarService.findCalendarsByTitle.mockResolvedValue([]);
      deviceCalendarService.createManagedCalendar
        .mockRejectedValueOnce(new Error('account calendar insert rejected'))
        .mockResolvedValueOnce('calendar-local');
      deviceCalendarService.getEvents.mockResolvedValue([]);

      const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
      const result = await manager.enableSync({
        targetMode: 'android-account',
        targetSourceId: accountSourceKey,
      });

      expect(result.status).toBe('ok');
      expect(deviceCalendarService.createManagedCalendar).toHaveBeenNthCalledWith(1, {
        title: 'Open Working Hours',
        color: '#0F766E',
        targetMode: 'android-account',
        source: targets[0].source,
      });
      expect(deviceCalendarService.createManagedCalendar).toHaveBeenNthCalledWith(2, {
        title: 'Open Working Hours',
        color: '#0F766E',
        targetMode: 'android-local',
        source: targets[1].source,
      });
      expect(storage.saveDeviceCalendarState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          calendarId: 'calendar-local',
          targetMode: 'android-local',
          targetSourceId: localSourceKey,
          lastSyncError: null,
        }),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CalendarExportManager] Failed to create Android account-backed calendar, falling back to device-only calendar:',
        expect.any(Error),
      );
    } finally {
      consoleWarnSpy.mockRestore();
      platform.OS = originalOS;
    }
  });

  it('repairs an existing Android managed calendar that was created hidden', async () => {
    const platform = require('react-native').Platform as { OS: string };
    const originalOS = platform.OS;
    platform.OS = 'android';

    try {
      const storage = createStorageMock();
      const deviceCalendarService = createDeviceCalendarServiceMock();
      storage.loadDeviceCalendarState.mockResolvedValue({
        enabled: true,
        calendarId: 'calendar-hidden',
        targetSourceId: ':work@example.com:com.google:remote',
        targetMode: 'android-account',
        lastFullSyncAt: null,
        lastSyncError: null,
        updatedAt: '2026-04-27T08:00:00.000Z',
      });
      storage.getShiftInstancesForDateRange.mockResolvedValue([]);
      storage.getAbsenceInstancesForDateRange.mockResolvedValue([]);
      storage.loadDeviceCalendarMappings.mockResolvedValue({});
      deviceCalendarService.getPermissionState.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      });
      deviceCalendarService.findCalendarById.mockResolvedValue({
        id: 'calendar-hidden',
        title: 'Open Working Hours',
        color: '#0F766E',
        allowsModifications: true,
        isVisible: false,
        isSynced: false,
        source: { name: 'work@example.com', type: 'com.google', isLocalAccount: false },
        sourceId: null,
      });
      deviceCalendarService.getEvents.mockResolvedValue([]);

      const manager = new CalendarExportManager(storage as any, deviceCalendarService as any);
      await manager.runSyncIfEnabled(new Date(2026, 3, 27, 9, 0));

      expect(deviceCalendarService.updateCalendar).toHaveBeenCalledWith('calendar-hidden', {
        isVisible: true,
        isSynced: true,
      });
      expect(deviceCalendarService.createManagedCalendar).not.toHaveBeenCalled();
    } finally {
      platform.OS = originalOS;
    }
  });
});
