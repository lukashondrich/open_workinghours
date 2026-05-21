import type { CalendarExportSyncIssueCode } from './CalendarExportTypes';

export class CalendarExportSyncError extends Error {
  constructor(
    readonly code: CalendarExportSyncIssueCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CalendarExportSyncError';
  }
}

export function getCalendarExportSyncIssueCode(error: unknown): CalendarExportSyncIssueCode {
  if (error instanceof CalendarExportSyncError) {
    return error.code;
  }

  if (error instanceof Error && error.name === 'MultipleManagedCalendarsError') {
    return 'ambiguous-recovery';
  }

  return 'sync-failed';
}
