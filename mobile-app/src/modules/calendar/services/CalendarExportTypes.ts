import type { AbsenceInstance, ShiftInstance } from '@/lib/calendar/types';

export const DEVICE_CALENDAR_TARGET_MODES = [
  'ios-default',
  'android-account',
  'android-local',
] as const;

export type DeviceCalendarTargetMode = (typeof DEVICE_CALENDAR_TARGET_MODES)[number];
export type ManagedCalendarEntityType = 'shift' | 'absence';
export type CalendarExportSyncIssueCode =
  | 'permission-denied'
  | 'target-read-failed'
  | 'calendar-create-failed'
  | 'calendar-create-fallback-local'
  | 'calendar-validation-failed'
  | 'event-write-failed'
  | 'ambiguous-recovery'
  | 'sync-failed'
  | 'unknown';
export type AndroidCalendarProvider =
  | 'google'
  | 'samsung'
  | 'exchange'
  | 'caldav'
  | 'local'
  | 'other';

export interface DeviceCalendarStateRecord {
  enabled: boolean;
  calendarId: string | null;
  targetSourceId: string | null;
  targetMode: DeviceCalendarTargetMode | null;
  lastFullSyncAt: string | null;
  lastSyncError: CalendarExportSyncIssueCode | string | null;
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

export interface DeviceCalendarPermissionState {
  status: 'undetermined' | 'denied' | 'granted';
  granted: boolean;
  canAskAgain: boolean;
}

export interface DeviceCalendarSourceRecord {
  id?: string;
  name: string;
  type?: string;
  isLocalAccount?: boolean;
}

export interface DeviceCalendarRecord {
  id: string;
  title: string;
  color: string;
  allowsModifications: boolean;
  ownerAccount?: string | null;
  name?: string | null;
  isPrimary?: boolean;
  isVisible?: boolean;
  isSynced?: boolean;
  source?: DeviceCalendarSourceRecord | null;
  sourceId?: string | null;
}

export interface DeviceCalendarEventRecord {
  id: string;
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes: string | null;
}

export interface AndroidCalendarTarget {
  mode: 'android-account' | 'android-local';
  source: DeviceCalendarSourceRecord;
  sourceKey: string;
  provider: AndroidCalendarProvider;
  providerLabel: string;
  accountName: string;
  accountType: string | null;
  label: string;
  synced: boolean;
  recommended: boolean;
}

export interface CreateManagedCalendarInput {
  title: string;
  color: string;
  targetMode: DeviceCalendarTargetMode;
  source?: DeviceCalendarSourceRecord | null;
}

export interface UpsertManagedEventInput {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes: string;
}

export interface CalendarExportEventDTO {
  appId: string;
  entityType: ManagedCalendarEntityType;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
}

export interface CalendarExportReconcileResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  repairedMappings: number;
}
