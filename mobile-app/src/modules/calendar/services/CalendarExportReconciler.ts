import { addLocalDays, createCalendarExportWindow } from './CalendarExportDateWindow';
import { CalendarExportSyncError } from './CalendarExportErrors';
import { buildDesiredManagedCalendarEvents } from './CalendarExportNormalize';
import { parseManagedEventMarker } from './CalendarExportMarker';
import type {
  CalendarExportReconcileResult,
  DesiredManagedCalendarEvent,
  DeviceCalendarEventRecord,
  DeviceCalendarMappingRecord,
  UpsertManagedEventInput,
} from './CalendarExportTypes';
import type { DeviceCalendarService } from './DeviceCalendarService';
import type { CalendarStorage } from './CalendarStorage';

type CalendarExportStorage = Pick<
  CalendarStorage,
  | 'getShiftInstancesForDateRange'
  | 'getAbsenceInstancesForDateRange'
  | 'loadDeviceCalendarMappings'
  | 'saveDeviceCalendarMapping'
  | 'deleteDeviceCalendarMapping'
>;

function toUpsertInput(event: DesiredManagedCalendarEvent): UpsertManagedEventInput {
  return {
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    notes: event.notes,
  };
}

function isPastManagedEvent(event: DeviceCalendarEventRecord, todayStart: Date): boolean {
  return event.endDate.getTime() <= todayStart.getTime();
}

function needsUpdate(
  actual: DeviceCalendarEventRecord,
  desired: DesiredManagedCalendarEvent,
): boolean {
  const markerResult = parseManagedEventMarker(actual.notes);
  const markerFingerprint = markerResult.status === 'valid' ? markerResult.marker.fingerprint : null;

  return (
    actual.title !== desired.title ||
    actual.startDate.getTime() !== desired.startDate.getTime() ||
    actual.endDate.getTime() !== desired.endDate.getTime() ||
    actual.allDay !== desired.allDay ||
    actual.notes !== desired.notes ||
    markerFingerprint !== desired.fingerprint
  );
}

export class CalendarExportReconciler {
  constructor(
    private readonly storage: CalendarExportStorage,
    private readonly deviceCalendarService: Pick<
      DeviceCalendarService,
      'getEvents' | 'createEvent' | 'updateEvent' | 'deleteEvent'
    >,
  ) {}

  async reconcileManagedCalendar(
    calendarId: string,
    now: Date = new Date(),
  ): Promise<CalendarExportReconcileResult> {
    const window = createCalendarExportWindow(now);
    const [shifts, absences, mappings] = await Promise.all([
      this.storage.getShiftInstancesForDateRange(window.queryStartDate, window.queryEndDate),
      this.storage.getAbsenceInstancesForDateRange(window.queryStartDate, window.queryEndDate),
      this.storage.loadDeviceCalendarMappings(),
    ]);

    const desiredEvents = buildDesiredManagedCalendarEvents({
      shifts,
      absences,
      window,
    });

    const actualEvents = await this.deviceCalendarService.getEvents(
      calendarId,
      addLocalDays(window.todayStart, -1),
      addLocalDays(window.horizonEndExclusive, 1),
    );

    const actualById = new Map(actualEvents.map((event) => [event.id, event]));
    const markerEvents = new Map<string, DeviceCalendarEventRecord>();
    actualEvents.forEach((event) => {
      const marker = parseManagedEventMarker(event.notes);
      if (marker.status === 'valid') {
        markerEvents.set(marker.marker.appId, event);
      }
    });

    const result: CalendarExportReconcileResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      repairedMappings: 0,
    };

    const desiredIds = new Set(desiredEvents.map((event) => event.appId));
    const usedActualIds = new Set<string>();

    for (const desiredEvent of desiredEvents) {
      const mapping = mappings[desiredEvent.appId];
      const mappedEvent = mapping ? actualById.get(mapping.nativeEventId) ?? null : null;
      const markerEvent = markerEvents.get(desiredEvent.appId) ?? null;
      const actualEvent = mappedEvent ?? markerEvent;

      if (!actualEvent) {
        const createdId = await this.createEvent(calendarId, desiredEvent);
        await this.storage.saveDeviceCalendarMapping({
          appId: desiredEvent.appId,
          nativeEventId: createdId,
          entityType: desiredEvent.entityType,
          fingerprint: desiredEvent.fingerprint,
        });
        result.created += 1;
        continue;
      }

      usedActualIds.add(actualEvent.id);

      if (needsUpdate(actualEvent, desiredEvent)) {
        await this.updateEvent(actualEvent.id, desiredEvent);
        result.updated += 1;
      } else {
        result.unchanged += 1;
      }

      if (this.shouldRepairMapping(mapping, desiredEvent, actualEvent)) {
        await this.storage.saveDeviceCalendarMapping({
          appId: desiredEvent.appId,
          nativeEventId: actualEvent.id,
          entityType: desiredEvent.entityType,
          fingerprint: desiredEvent.fingerprint,
        });
        result.repairedMappings += 1;
      }
    }

    for (const [appId, actualEvent] of markerEvents.entries()) {
      if (usedActualIds.has(actualEvent.id)) {
        continue;
      }

      if (desiredIds.has(appId)) {
        continue;
      }

      if (isPastManagedEvent(actualEvent, window.todayStart)) {
        continue;
      }

      await this.deleteEvent(actualEvent.id);
      await this.storage.deleteDeviceCalendarMapping(appId);
      result.deleted += 1;
    }

    return result;
  }

  async deleteManagedEvents(
    calendarId: string,
    options?: { now?: Date; includePast?: boolean },
  ): Promise<number> {
    const now = options?.now ?? new Date();
    const includePast = options?.includePast ?? false;
    const window = createCalendarExportWindow(now);
    const events = await this.deviceCalendarService.getEvents(
      calendarId,
      addLocalDays(window.todayStart, -3650),
      addLocalDays(window.horizonEndExclusive, 3650),
    );

    let deleted = 0;
    for (const event of events) {
      const marker = parseManagedEventMarker(event.notes);
      if (marker.status !== 'valid') {
        continue;
      }

      if (!includePast && isPastManagedEvent(event, window.todayStart)) {
        continue;
      }

      await this.deleteEvent(event.id);
      await this.storage.deleteDeviceCalendarMapping(marker.marker.appId);
      deleted += 1;
    }

    return deleted;
  }

  private shouldRepairMapping(
    mapping: DeviceCalendarMappingRecord | undefined,
    desiredEvent: DesiredManagedCalendarEvent,
    actualEvent: DeviceCalendarEventRecord,
  ): boolean {
    return (
      !mapping ||
      mapping.nativeEventId !== actualEvent.id ||
      mapping.entityType !== desiredEvent.entityType ||
      mapping.fingerprint !== desiredEvent.fingerprint
    );
  }

  private async createEvent(
    calendarId: string,
    desiredEvent: DesiredManagedCalendarEvent,
  ): Promise<string> {
    try {
      return await this.deviceCalendarService.createEvent(calendarId, toUpsertInput(desiredEvent));
    } catch (error) {
      throw new CalendarExportSyncError('event-write-failed', 'Failed to create exported calendar event.', error);
    }
  }

  private async updateEvent(
    nativeEventId: string,
    desiredEvent: DesiredManagedCalendarEvent,
  ): Promise<void> {
    try {
      await this.deviceCalendarService.updateEvent(nativeEventId, toUpsertInput(desiredEvent));
    } catch (error) {
      throw new CalendarExportSyncError('event-write-failed', 'Failed to update exported calendar event.', error);
    }
  }

  private async deleteEvent(nativeEventId: string): Promise<void> {
    try {
      await this.deviceCalendarService.deleteEvent(nativeEventId);
    } catch (error) {
      throw new CalendarExportSyncError('event-write-failed', 'Failed to delete exported calendar event.', error);
    }
  }
}
