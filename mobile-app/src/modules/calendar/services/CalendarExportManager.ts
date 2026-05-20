import { Platform } from 'react-native';

import { addLocalDays, createCalendarExportWindow } from './CalendarExportDateWindow';
import { parseManagedEventMarker } from './CalendarExportMarker';
import { CalendarExportReconciler } from './CalendarExportReconciler';
import { MANAGED_EXPORT_CALENDAR_COLOR, MANAGED_EXPORT_CALENDAR_TITLE } from './CalendarExportConfig';
import type {
  CalendarExportReconcileResult,
  CreateManagedCalendarInput,
  DeviceCalendarRecord,
  DeviceCalendarStateRecord,
} from './CalendarExportTypes';
import { DeviceCalendarService, getDeviceCalendarSourceKey } from './DeviceCalendarService';
import { CalendarStorage, getCalendarStorage } from './CalendarStorage';

export class MultipleManagedCalendarsError extends Error {
  constructor() {
    super('Multiple managed calendar candidates were found; refusing to guess.');
    this.name = 'MultipleManagedCalendarsError';
  }
}

export type CalendarExportSyncOutcome =
  | { status: 'disabled' }
  | { status: 'blocked-permission' }
  | { status: 'ok'; calendarId: string; result: CalendarExportReconcileResult };

export type CalendarExportDeleteOutcome =
  | { status: 'noop' }
  | { status: 'blocked-permission' }
  | { status: 'deleted'; deletedEvents: number };

export class CalendarExportManager {
  private readonly reconciler: CalendarExportReconciler;

  constructor(
    private readonly storage: Pick<
      CalendarStorage,
      | 'getShiftInstancesForDateRange'
      | 'getAbsenceInstancesForDateRange'
      | 'loadDeviceCalendarMappings'
      | 'saveDeviceCalendarMapping'
      | 'deleteDeviceCalendarMapping'
      | 'deleteAllDeviceCalendarMappings'
      | 'loadDeviceCalendarState'
      | 'saveDeviceCalendarState'
      | 'clearDeviceCalendarState'
    >,
    private readonly deviceCalendarService: DeviceCalendarService,
  ) {
    this.reconciler = new CalendarExportReconciler(storage, deviceCalendarService);
  }

  async runSyncIfEnabled(now: Date = new Date()): Promise<CalendarExportSyncOutcome> {
    const state = await this.storage.loadDeviceCalendarState();
    if (!state?.enabled) {
      return { status: 'disabled' };
    }

    const permission = await this.deviceCalendarService.getPermissionState();
    if (!permission.granted) {
      await this.persistState(state, {
        lastSyncError: 'permission-denied',
      });
      return { status: 'blocked-permission' };
    }

    try {
      const calendarResolution = await this.ensureManagedCalendar(state, now);
      const result = await this.reconciler.reconcileManagedCalendar(calendarResolution.calendarId, now);

      await this.persistState(state, {
        calendarId: calendarResolution.calendarId,
        targetMode: calendarResolution.targetMode ?? state.targetMode ?? null,
        targetSourceId: calendarResolution.targetSourceId ?? state.targetSourceId ?? null,
        lastFullSyncAt: now.toISOString(),
        lastSyncError: null,
      });

      return {
        status: 'ok',
        calendarId: calendarResolution.calendarId,
        result,
      };
    } catch (error) {
      await this.persistState(state, {
        lastSyncError: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  async getState(): Promise<DeviceCalendarStateRecord | null> {
    return this.storage.loadDeviceCalendarState();
  }

  async getAndroidTargets() {
    return this.deviceCalendarService.resolveAndroidTargets();
  }

  async enableSync(options?: {
    targetMode?: DeviceCalendarStateRecord['targetMode'];
    targetSourceId?: string | null;
  }): Promise<CalendarExportSyncOutcome> {
    let permission = await this.deviceCalendarService.getPermissionState();
    if (!permission.granted) {
      permission = await this.deviceCalendarService.requestPermission();
      if (!permission.granted) {
        return { status: 'blocked-permission' };
      }
    }

    const state = await this.storage.loadDeviceCalendarState();
    const target = await this.resolveEnableTarget(options, state);

    await this.storage.saveDeviceCalendarState({
      enabled: true,
      calendarId: state?.calendarId ?? null,
      targetSourceId: target.targetSourceId,
      targetMode: target.targetMode,
      lastFullSyncAt: state?.lastFullSyncAt ?? null,
      lastSyncError: null,
    });

    return this.runSyncIfEnabled();
  }

  async markDisabledKeepingEvents(): Promise<void> {
    const state = await this.storage.loadDeviceCalendarState();
    if (!state) {
      return;
    }

    await this.persistState(state, {
      enabled: false,
      lastSyncError: null,
    });
  }

  async deleteExportedCalendarData(
    options?: { now?: Date; clearState?: boolean },
  ): Promise<CalendarExportDeleteOutcome> {
    const state = await this.storage.loadDeviceCalendarState();
    if (!state?.calendarId) {
      if (options?.clearState !== false) {
        await this.storage.clearDeviceCalendarState();
        await this.storage.deleteAllDeviceCalendarMappings();
      }
      return { status: 'noop' };
    }

    const permission = await this.deviceCalendarService.getPermissionState();
    if (!permission.granted) {
      return { status: 'blocked-permission' };
    }

    let deletedEvents = 0;
    try {
      await this.deviceCalendarService.deleteCalendar(state.calendarId);
    } catch (error) {
      console.warn('[CalendarExportManager] Failed to delete managed calendar directly, falling back to per-event cleanup:', error);
      deletedEvents = await this.reconciler.deleteManagedEvents(
        state.calendarId,
        { now: options?.now, includePast: true },
      );
    }

    await this.storage.deleteAllDeviceCalendarMappings();
    if (options?.clearState !== false) {
      await this.storage.clearDeviceCalendarState();
    } else {
      await this.persistState(state, {
        enabled: false,
      });
    }

    return { status: 'deleted', deletedEvents };
  }

  async clearLocalExportState(): Promise<void> {
    await this.storage.deleteAllDeviceCalendarMappings();
    await this.storage.clearDeviceCalendarState();
  }

  private async ensureManagedCalendar(
    state: DeviceCalendarStateRecord,
    now: Date,
  ): Promise<{ calendarId: string; targetMode: DeviceCalendarStateRecord['targetMode']; targetSourceId: string | null }> {
    if (state.calendarId) {
      const existing = await this.deviceCalendarService.findCalendarById(state.calendarId);
      if (existing?.allowsModifications) {
        await this.repairAndroidManagedCalendarVisibility(existing);
        return {
          calendarId: existing.id,
          targetMode: state.targetMode,
          targetSourceId: state.targetSourceId,
        };
      }
    }

    const recovered = await this.findRecoverableCalendar(now);
    if (recovered) {
      await this.repairAndroidManagedCalendarVisibility(recovered);
      return {
        calendarId: recovered.id,
        targetMode: state.targetMode,
        targetSourceId: getDeviceCalendarSourceKey(recovered.source) ?? recovered.source?.id ?? state.targetSourceId,
      };
    }

    const createInput = await this.resolveCreateCalendarInput(state);
    const calendarId = await this.deviceCalendarService.createManagedCalendar(createInput);

    return {
      calendarId,
      targetMode: createInput.targetMode,
      targetSourceId: getDeviceCalendarSourceKey(createInput.source) ?? createInput.source?.id ?? null,
    };
  }

  private async findRecoverableCalendar(now: Date): Promise<DeviceCalendarRecord | null> {
    const candidates = await this.deviceCalendarService.findCalendarsByTitle(MANAGED_EXPORT_CALENDAR_TITLE);
    if (candidates.length === 0) {
      return null;
    }

    const window = createCalendarExportWindow(now);
    const markerBearing: DeviceCalendarRecord[] = [];

    for (const candidate of candidates) {
      const events = await this.deviceCalendarService.getEvents(
        candidate.id,
        addLocalDays(window.todayStart, -3650),
        addLocalDays(window.horizonEndExclusive, 3650),
      );

      if (events.some((event) => parseManagedEventMarker(event.notes).status === 'valid')) {
        markerBearing.push(candidate);
      }
    }

    if (markerBearing.length === 0) {
      return null;
    }

    if (markerBearing.length > 1) {
      throw new MultipleManagedCalendarsError();
    }

    return markerBearing[0];
  }

  private async resolveCreateCalendarInput(
    state: DeviceCalendarStateRecord,
  ): Promise<CreateManagedCalendarInput> {
    if (state.targetMode === 'android-account') {
      const targets = await this.deviceCalendarService.resolveAndroidTargets();
      const chosen = targets.find((target) => this.isTargetSourceMatch(target, state.targetSourceId))
        ?? targets.find((target) => target.mode === 'android-account')
        ?? targets.find((target) => target.mode === 'android-local')
        ?? null;

      return {
        title: MANAGED_EXPORT_CALENDAR_TITLE,
        color: MANAGED_EXPORT_CALENDAR_COLOR,
        targetMode: chosen?.mode ?? 'android-local',
        source: chosen?.source ?? null,
      };
    }

    if (state.targetMode === 'android-local') {
      const targets = await this.deviceCalendarService.resolveAndroidTargets();
      const local = targets.find((target) => target.mode === 'android-local') ?? null;

      return {
        title: MANAGED_EXPORT_CALENDAR_TITLE,
        color: MANAGED_EXPORT_CALENDAR_COLOR,
        targetMode: 'android-local',
        source: local?.source ?? null,
      };
    }

    return {
      title: MANAGED_EXPORT_CALENDAR_TITLE,
      color: MANAGED_EXPORT_CALENDAR_COLOR,
      targetMode: 'ios-default',
      source: null,
    };
  }

  private async resolveEnableTarget(
    options: { targetMode?: DeviceCalendarStateRecord['targetMode']; targetSourceId?: string | null } | undefined,
    currentState: DeviceCalendarStateRecord | null,
  ): Promise<{ targetMode: DeviceCalendarStateRecord['targetMode']; targetSourceId: string | null }> {
    const requestedTargetMode = options?.targetMode ?? currentState?.targetMode ?? null;
    const requestedTargetSourceId = options?.targetSourceId ?? currentState?.targetSourceId ?? null;

    if (
      requestedTargetMode === 'android-account' ||
      requestedTargetMode === 'android-local' ||
      (!requestedTargetMode && Platform.OS === 'android')
    ) {
      const targets = await this.deviceCalendarService.resolveAndroidTargets();
      const chosen = targets.find((target) => this.isTargetSourceMatch(target, requestedTargetSourceId))
        ?? (requestedTargetMode ? targets.find((target) => target.mode === requestedTargetMode) : null)
        ?? targets.find((target) => target.mode === 'android-account')
        ?? targets.find((target) => target.mode === 'android-local')
        ?? null;

      return {
        targetMode: chosen?.mode ?? 'android-local',
        targetSourceId: chosen?.sourceKey ?? chosen?.source.id ?? null,
      };
    }

    return {
      targetMode: 'ios-default',
      targetSourceId: null,
    };
  }

  private async persistState(
    state: DeviceCalendarStateRecord,
    updates: Partial<DeviceCalendarStateRecord> & { enabled?: boolean },
  ): Promise<void> {
    await this.storage.saveDeviceCalendarState({
      enabled: updates.enabled ?? state.enabled,
      calendarId: updates.calendarId !== undefined ? updates.calendarId : state.calendarId,
      targetSourceId: updates.targetSourceId !== undefined ? updates.targetSourceId : state.targetSourceId,
      targetMode: updates.targetMode !== undefined ? updates.targetMode : state.targetMode,
      lastFullSyncAt: updates.lastFullSyncAt !== undefined ? updates.lastFullSyncAt : state.lastFullSyncAt,
      lastSyncError: updates.lastSyncError !== undefined ? updates.lastSyncError : state.lastSyncError,
    });
  }

  private async repairAndroidManagedCalendarVisibility(calendar: DeviceCalendarRecord): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    const updates: { isVisible?: boolean; isSynced?: boolean } = {};
    if (calendar.isVisible !== true) {
      updates.isVisible = true;
    }
    if (calendar.isSynced !== true) {
      updates.isSynced = true;
    }

    if (Object.keys(updates).length > 0) {
      await this.deviceCalendarService.updateCalendar(calendar.id, updates);
    }
  }

  private isTargetSourceMatch(
    target: { sourceKey?: string; source: { id?: string } },
    storedSourceId: string | null | undefined,
  ): boolean {
    if (!storedSourceId) {
      return false;
    }

    return target.sourceKey === storedSourceId || target.source.id === storedSourceId;
  }
}

let calendarExportManagerPromise: Promise<CalendarExportManager> | null = null;

export async function getCalendarExportManager(): Promise<CalendarExportManager> {
  if (!calendarExportManagerPromise) {
    calendarExportManagerPromise = (async () => {
      const storage = await getCalendarStorage();
      return new CalendarExportManager(storage, new DeviceCalendarService());
    })().catch((error) => {
      calendarExportManagerPromise = null;
      throw error;
    });
  }

  return calendarExportManagerPromise;
}
