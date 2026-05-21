import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import type {
  AndroidCalendarTarget,
  AndroidCalendarProvider,
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

  return source.isLocalAccount === true || !source.type || source.type.toLowerCase() === 'local';
}

function getAndroidCalendarProvider(
  source: DeviceCalendarSourceRecord,
  local: boolean,
): AndroidCalendarProvider {
  if (local) {
    return 'local';
  }

  const type = source.type?.toLowerCase() ?? '';

  if (type === 'com.google') {
    return 'google';
  }

  if (type === 'com.osp.app.signin') {
    return 'samsung';
  }

  if (type.includes('exchange')) {
    return 'exchange';
  }

  if (type.includes('caldav')) {
    return 'caldav';
  }

  return 'other';
}

function getAndroidProviderLabel(
  provider: AndroidCalendarProvider,
  source: DeviceCalendarSourceRecord,
): string {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'samsung':
      return 'Samsung';
    case 'exchange':
      return 'Exchange';
    case 'caldav':
      return 'CalDAV';
    case 'local':
      return 'Device only';
    case 'other':
      return source.type && source.type !== source.name ? source.type : 'Account';
  }
}

function getAndroidTargetSortRank(
  provider: AndroidCalendarProvider,
  synced: boolean,
): number {
  if (provider === 'local') {
    return 90;
  }

  const providerRank: Record<AndroidCalendarProvider, number> = {
    google: 10,
    exchange: 20,
    caldav: 25,
    samsung: 30,
    other: 50,
    local: 90,
  };

  return providerRank[provider] + (synced ? 0 : 15);
}

function getAndroidTargetLabel(
  source: DeviceCalendarSourceRecord,
  providerLabel: string,
): string {
  return `${source.name} (${providerLabel})`;
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
    const bySource = new Map<string, AndroidCalendarTarget & { sortRank: number }>();

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

      const synced = calendar.isSynced === true && !local;
      const provider = getAndroidCalendarProvider(source, local);
      const providerLabel = getAndroidProviderLabel(provider, source);

      bySource.set(sourceKey, {
        mode: local ? 'android-local' : 'android-account',
        source,
        sourceKey,
        provider,
        providerLabel,
        accountName: source.name,
        accountType: source.type ?? null,
        label: getAndroidTargetLabel(source, providerLabel),
        synced,
        recommended: false,
        sortRank: getAndroidTargetSortRank(provider, synced),
      });
    });

    return [...bySource.values()]
      .sort((left, right) => left.sortRank - right.sortRank || left.label.localeCompare(right.label))
      .map(({ sortRank: _sortRank, ...target }, index) => ({
        ...target,
        recommended: index === 0,
      }));
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
