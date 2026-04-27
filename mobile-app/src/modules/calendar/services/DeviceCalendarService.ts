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
  const status = response.status === 'granted' || response.status === 'denied'
    ? response.status
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

  async getBestIosSource(): Promise<DeviceCalendarSourceRecord | null> {
    if (Platform.OS !== 'ios') {
      return null;
    }

    try {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      const source = mapSource((defaultCalendar as any)?.source);
      if (source) {
        return source;
      }
    } catch (error) {
      console.warn('[DeviceCalendarService] Failed to load iOS default calendar source:', error);
    }

    const calendars = await this.getWritableCalendars();
    const local = calendars.find((calendar) => calendar.source?.type === Calendar.SourceType.LOCAL);
    if (local?.source) {
      return local.source;
    }

    return calendars.find((calendar) => calendar.source?.id)?.source ?? null;
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
      const sourceKey = `${source.id ?? ''}:${source.name}:${source.type ?? 'local'}`;
      if (bySource.has(sourceKey)) {
        return;
      }

      bySource.set(sourceKey, {
        mode: local ? 'android-local' : 'android-account',
        source,
        label: local ? `${source.name} (Device only)` : source.name,
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
      const source = input.source ?? await this.getBestIosSource();
      if (!source?.id) {
        throw new Error('No writable calendar source is available on this device.');
      }

      return Calendar.createCalendarAsync({
        title: input.title,
        color: input.color,
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: source.id,
        source,
      });
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
      source,
      ...(input.targetMode === 'android-account' && input.source ? { isSynced: true } : {}),
    });
  }

  async updateCalendar(id: string, updates: { title?: string; color?: string }): Promise<void> {
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
