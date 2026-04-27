import type { AbsenceInstance, ShiftInstance } from '@/lib/calendar/types';

export const DEVICE_CALENDAR_TARGET_MODES = [
  'ios-default',
  'android-account',
  'android-local',
] as const;

export type DeviceCalendarTargetMode = (typeof DEVICE_CALENDAR_TARGET_MODES)[number];
export type ManagedCalendarEntityType = 'shift' | 'absence';

export interface DeviceCalendarStateRecord {
  enabled: boolean;
  calendarId: string | null;
  targetSourceId: string | null;
  targetMode: DeviceCalendarTargetMode | null;
  lastFullSyncAt: string | null;
  lastSyncError: string | null;
  updatedAt: string;
}

export interface DeviceCalendarMappingRecord {
  appId: string;
  nativeEventId: string;
  entityType: ManagedCalendarEntityType;
  fingerprint: string;
  updatedAt: string;
}

export interface CalendarExportWindow {
  todayStart: Date;
  horizonEndExclusive: Date;
  queryStartDate: string;
  queryEndDate: string;
  horizonDays: number;
}

export interface ManagedEventMarker {
  entityType: ManagedCalendarEntityType;
  appId: string;
  fingerprint: string;
}

export type ManagedEventMarkerParseResult =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'valid'; marker: ManagedEventMarker };

export interface DesiredManagedCalendarEvent {
  appId: string;
  entityType: ManagedCalendarEntityType;
  sourceId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes: string;
  fingerprint: string;
}

export interface BuildDesiredManagedEventsInput {
  shifts: ShiftInstance[];
  absences: AbsenceInstance[];
  window: CalendarExportWindow;
}

export interface ManagedEventFingerprintInput {
  entityType: ManagedCalendarEntityType;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
}
