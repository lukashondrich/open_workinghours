import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import type {
  AndroidCalendarTarget,
  CreateManagedCalendarInput,
  DeviceCalendarEventRecord,
  DeviceCalendarPermissionState,
  DeviceCalendarRecord,
  DeviceCalendarSourceRecord,
  UpsertManagedEventInput,
} from './CalendarExportTypes';

function mapPermissionState(response: {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
}): DeviceCalendarPermissionState {
  const status = response.status === 'granted'
    ? 'granted'
    : response.status === 'denied' || response.status === 'restricted'
      ? 'denied'
      : 'undetermined';

  return {
    status,
    granted: response.granted,
    canAskAgain: response.canAskAgain,
  };
}

function mapSource(source: any | null | undefined): DeviceCalendarSourceRecord | null {
  if (!source) {
    return null;
  }

  return {
    id: source.id,
    name: source.name,
    type: source.type,
    isLocalAccount: source.isLocalAccount,
  };
}

function mapCalendarRecord(calendar: any): DeviceCalendarRecord {
  return {
    id: calendar.id,
    title: calendar.title ?? calendar.name ?? '',
    color: calendar.color ?? '',
    allowsModifications: calendar.allowsModifications !== false,
    ownerAccount: calendar.ownerAccount ?? null,
    name: calendar.name ?? null,
    isPrimary: calendar.isPrimary,
    isVisible: calendar.isVisible,
    isSynced: calendar.isSynced,
    source: mapSource(calendar.source),
    sourceId: calendar.sourceId ?? null,
  };
}

function mapEventRecord(event: any): DeviceCalendarEventRecord {
  return {
    id: event.id,
    calendarId: event.calendarId,
    title: event.title ?? '',
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    allDay: event.allDay === true,
    notes: event.notes ?? null,
  };
}

function isAndroidLocalSource(source: DeviceCalendarSourceRecord | null | undefined): boolean {
  if (!source) {
    return false;
  }

  return source.isLocalAccount === true || !source.type;
}

function getAndroidTargetLabel(source: DeviceCalendarSourceRecord, local: boolean): string {
  if (local) {
    return `${source.name} (Device only)`;
  }

  if (source.type === 'com.google') {
    return `${source.name} (Google)`;
  }

  if (source.type === 'com.osp.app.signin') {
    return `${source.name} (Samsung)`;
  }

  if (source.type && source.type !== source.name) {
    return `${source.name} (${source.type})`;
  }

  return source.name;
}

export function getDeviceCalendarSourceKey(source: DeviceCalendarSourceRecord | null | undefined): string | null {
  if (!source) {
    return null;
  }

  return [
    source.id ?? '',
    source.name,
    source.type ?? '',
    source.isLocalAccount === true ? 'local' : 'remote',
  ].join(':');
}

function toExpoSource(source: DeviceCalendarSourceRecord): Calendar.Source {
  return source as unknown as Calendar.Source;
}

export class DeviceCalendarService {
  async getPermissionState(): Promise<DeviceCalendarPermissionState> {
    return mapPermissionState(await Calendar.getCalendarPermissionsAsync());
  }

  async requestPermission(): Promise<DeviceCalendarPermissionState> {
    return mapPermissionState(await Calendar.requestCalendarPermissionsAsync());
  }

  async getCalendars(): Promise<DeviceCalendarRecord[]> {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.map(mapCalendarRecord);
  }

  async getWritableCalendars(): Promise<DeviceCalendarRecord[]> {
    const calendars = await this.getCalendars();
    return calendars.filter((calendar) => calendar.allowsModifications);
  }

  async findCalendarById(id: string): Promise<DeviceCalendarRecord | null> {
    const calendars = await this.getCalendars();
    return calendars.find((calendar) => calendar.id === id) ?? null;
  }

  async findCalendarsByTitle(title: string): Promise<DeviceCalendarRecord[]> {
    const calendars = await this.getWritableCalendars();
    return calendars.filter((calendar) => calendar.title === title);
  }

  async getPreferredIosSources(): Promise<DeviceCalendarSourceRecord[]> {
    if (Platform.OS !== 'ios') {
      return [];
    }

    const candidates: DeviceCalendarSourceRecord[] = [];
    const seen = new Set<string>();
    const addCandidate = (source: DeviceCalendarSourceRecord | null | undefined) => {
      const key = getDeviceCalendarSourceKey(source);
      if (!key || seen.has(key) || !source?.id) {
        return;
      }

      seen.add(key);
      candidates.push(source);
    };

    try {
      const defaultCalendar = mapCalendarRecord(await Calendar.getDefaultCalendarAsync());
      if (defaultCalendar.allowsModifications) {
        addCandidate(defaultCalendar.source);
      }
    } catch (error) {
      console.warn('[DeviceCalendarService] Failed to load iOS default calendar source:', error);
    }

    const calendars = await this.getWritableCalendars();
    calendars
      .filter((calendar) => calendar.source?.type === Calendar.SourceType.LOCAL)
      .forEach((calendar) => addCandidate(calendar.source));

    calendars.forEach((calendar) => addCandidate(calendar.source));

    return candidates;
  }

  async getBestIosSource(): Promise<DeviceCalendarSourceRecord | null> {
    const [best] = await this.getPreferredIosSources();
    return best ?? null;
  }

  async resolveAndroidTargets(): Promise<AndroidCalendarTarget[]> {
    const calendars = await this.getWritableCalendars();
    const bySource = new Map<string, AndroidCalendarTarget>();

    calendars.forEach((calendar) => {
      const source = calendar.source;
      if (!source) {
        return;
      }

      const local = isAndroidLocalSource(source);
      const sourceKey = getDeviceCalendarSourceKey(source);
      if (!sourceKey) {
        return;
      }
      if (bySource.has(sourceKey)) {
        return;
      }

      bySource.set(sourceKey, {
        mode: local ? 'android-local' : 'android-account',
        source,
        sourceKey,
        label: getAndroidTargetLabel(source, local),
        synced: calendar.isSynced === true && !local,
      });
    });

    return [...bySource.values()].sort((left, right) => {
      if (left.mode !== right.mode) {
        return left.mode === 'android-account' ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
  }

  async createManagedCalendar(input: CreateManagedCalendarInput): Promise<string> {
    if (Platform.OS === 'ios') {
      const candidateSources = input.source
        ? [input.source]
        : await this.getPreferredIosSources();

      if (candidateSources.length === 0) {
        throw new Error('No writable calendar source is available on this device.');
      }

      let lastError: unknown = null;
      for (const source of candidateSources) {
        if (!source?.id) {
          continue;
        }

        try {
          return await Calendar.createCalendarAsync({
            title: input.title,
            color: input.color,
            entityType: Calendar.EntityTypes.EVENT,
            sourceId: source.id,
            source: toExpoSource(source),
          });
        } catch (error) {
          lastError = error;
          console.warn('[DeviceCalendarService] Failed to create iOS managed calendar with source, retrying next candidate:', error);
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('No writable calendar source is available on this device.');
    }

    const source = input.source ?? {
      isLocalAccount: true,
      name: input.title,
    };

    return Calendar.createCalendarAsync({
      title: input.title,
      color: input.color,
      name: input.title,
      ownerAccount: source.name,
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      isVisible: true,
      isSynced: true,
      source: toExpoSource(source),
    });
  }

  async updateCalendar(
    id: string,
    updates: { title?: string; color?: string; isVisible?: boolean; isSynced?: boolean },
  ): Promise<void> {
    await Calendar.updateCalendarAsync(id, updates);
  }

  async deleteCalendar(id: string): Promise<void> {
    await Calendar.deleteCalendarAsync(id);
  }

  async getEvents(
    calendarId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DeviceCalendarEventRecord[]> {
    const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);
    return events.map(mapEventRecord);
  }

  async createEvent(calendarId: string, input: UpsertManagedEventInput): Promise<string> {
    return Calendar.createEventAsync(calendarId, {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      allDay: input.allDay,
      notes: input.notes,
    });
  }

  async updateEvent(id: string, input: UpsertManagedEventInput): Promise<void> {
    await Calendar.updateEventAsync(id, {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      allDay: input.allDay,
      notes: input.notes,
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await Calendar.deleteEventAsync(id);
  }
}
