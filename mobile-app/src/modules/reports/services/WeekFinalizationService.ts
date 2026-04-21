import Constants from 'expo-constants';
import { addDays, format, isAfter, parseISO, startOfDay } from 'date-fns';
import { getDatabase } from '../../geofencing/services/Database';
import { AuthStorage } from '@/lib/auth/AuthStorage';
import { DailySubmissionService } from '@/modules/auth/services/DailySubmissionService';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { ReportsWeekQueueRecord } from '../../geofencing/types';
import type { ConfirmedDayStatus } from '@/lib/calendar/types';
import { calendarEvents } from '@/lib/events/calendarEvents';

const BASE_URL = Constants.expoConfig?.extra?.submissionBaseUrl || 'http://localhost:8000';
const WEEK_DAYS = 7;

function buildWeekDateKeys(weekStartDate: Date): string[] {
  return Array.from({ length: WEEK_DAYS }).map((_, index) => {
    const day = addDays(weekStartDate, index);
    return format(day, 'yyyy-MM-dd');
  });
}

export type SendResultStatus =
  | 'sent'
  | 'already_finalized'
  | 'skipped_not_ended'
  | 'skipped_not_fully_confirmed'
  | 'skipped_daily_incomplete'
  | 'failed';

export interface SendResult {
  weekStart: string;
  status: SendResultStatus;
  finalizedWeekId?: string;
  errorMessage?: string;
}

interface FinalizedWeekResponse {
  finalized_week_id?: string;
}

export class WeekFinalizationService {
  static async sendEligibleQueuedWeeks(): Promise<SendResult[]> {
    const db = await getDatabase();
    const token = await AuthStorage.getToken();
    if (!token) {
      return [];
    }

    const queuedWeeks = await db.getReportsWeekQueue('queued');
    const sortedQueuedWeeks = [...queuedWeeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    const results: SendResult[] = [];

    for (const queuedWeek of sortedQueuedWeeks) {
      // Process one week at a time to keep ordering deterministic.
      // eslint-disable-next-line no-await-in-loop
      const result = await this.sendQueuedWeek(queuedWeek, token);
      results.push(result);
    }

    return results;
  }

  private static async sendQueuedWeek(
    queuedWeek: ReportsWeekQueueRecord,
    token: string,
  ): Promise<SendResult> {
    const db = await getDatabase();
    const weekStartDate = parseISO(queuedWeek.weekStart);
    if (Number.isNaN(weekStartDate.getTime())) {
      const errorMessage = `Invalid queued week start: ${queuedWeek.weekStart}`;
      await this.markQueuedError(queuedWeek, errorMessage);
      return { weekStart: queuedWeek.weekStart, status: 'failed', errorMessage };
    }

    const weekEndDate = addDays(weekStartDate, WEEK_DAYS - 1);
    const today = startOfDay(new Date());
    // A week is eligible for finalization when its last day (Sunday) is today or earlier.
    if (isAfter(startOfDay(weekEndDate), today)) {
      return { weekStart: queuedWeek.weekStart, status: 'skipped_not_ended' };
    }

    const dateKeys = buildWeekDateKeys(weekStartDate);
    const dailyActuals = await db.getDailyActualsByDates(dateKeys);
    if (dailyActuals.length < WEEK_DAYS) {
      await db.deleteReportsWeekByStart(queuedWeek.weekStart);
      return { weekStart: queuedWeek.weekStart, status: 'skipped_not_fully_confirmed' };
    }

    try {
      await this.ensureDailyQueueEntries(dateKeys);
      await DailySubmissionService.processQueueForDates(dateKeys, {
        pendingRetries: 5,
        failedRetries: 3,
      });

      const hasAllSent = await this.hasAllDailySubmissionsSent(dateKeys);
      if (!hasAllSent) {
        const errorMessage = 'Not all daily submissions are sent yet.';
        await this.markQueuedError(queuedWeek, errorMessage);
        return { weekStart: queuedWeek.weekStart, status: 'skipped_daily_incomplete', errorMessage };
      }

      const response = await fetch(`${BASE_URL}/finalized-weeks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ week_start: queuedWeek.weekStart }),
      });

      if (response.status === 201) {
        const payload = (await this.safeJson(response)) as FinalizedWeekResponse | null;
        const finalizedWeekId = payload?.finalized_week_id ?? `finalized-${queuedWeek.weekStart}`;
        await this.markWeekSent(queuedWeek, finalizedWeekId);
        return { weekStart: queuedWeek.weekStart, status: 'sent', finalizedWeekId };
      }

      if (response.status === 409) {
        const finalizedWeekId = `finalized-${queuedWeek.weekStart}`;
        await this.markWeekSent(queuedWeek, finalizedWeekId);
        return { weekStart: queuedWeek.weekStart, status: 'already_finalized', finalizedWeekId };
      }

      const errorMessage = await this.parseErrorResponse(response);
      await this.markQueuedError(queuedWeek, errorMessage);
      return { weekStart: queuedWeek.weekStart, status: 'failed', errorMessage };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown finalization error';
      await this.markQueuedError(queuedWeek, errorMessage);
      return { weekStart: queuedWeek.weekStart, status: 'failed', errorMessage };
    }
  }

  private static async ensureDailyQueueEntries(dateKeys: string[]): Promise<void> {
    const db = await getDatabase();
    const sortedDates = [...dateKeys].sort();
    const queuedRows = await db.getDailySubmissionQueueForRange(sortedDates[0], sortedDates[sortedDates.length - 1]);
    const queuedDateSet = new Set(queuedRows.map((row) => row.date));

    for (const date of dateKeys) {
      if (queuedDateSet.has(date)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await DailySubmissionService.enqueueDailySubmission(date);
    }
  }

  private static async hasAllDailySubmissionsSent(dateKeys: string[]): Promise<boolean> {
    const db = await getDatabase();
    const sortedDates = [...dateKeys].sort();
    const queuedRows = await db.getDailySubmissionQueueForRange(sortedDates[0], sortedDates[sortedDates.length - 1]);
    const sentDateSet = new Set(
      queuedRows
        .filter((row) => row.status === 'sent')
        .map((row) => row.date),
    );

    return dateKeys.every((date) => sentDateSet.has(date));
  }

  private static async markWeekSent(queuedWeek: ReportsWeekQueueRecord, finalizedWeekId: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.upsertReportsWeekQueue({
      weekStart: queuedWeek.weekStart,
      status: 'sent',
      queuedAt: queuedWeek.queuedAt ?? now,
      sentAt: now,
      lastError: null,
      updatedAt: now,
    });

    await this.lockCalendarWeek(queuedWeek.weekStart, finalizedWeekId);
  }

  private static async markQueuedError(queuedWeek: ReportsWeekQueueRecord, errorMessage: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.upsertReportsWeekQueue({
      weekStart: queuedWeek.weekStart,
      status: 'queued',
      queuedAt: queuedWeek.queuedAt ?? now,
      sentAt: null,
      lastError: errorMessage,
      updatedAt: now,
    });
  }

  private static async lockCalendarWeek(weekStart: string, submissionId: string): Promise<void> {
    const calendarStorage = await getCalendarStorage();
    const confirmedDays = await calendarStorage.loadConfirmedDays();
    const weekStartDate = parseISO(weekStart);
    const dateKeys = buildWeekDateKeys(weekStartDate);

    for (const date of dateKeys) {
      const existing = confirmedDays[date] ?? { status: 'confirmed' as const };
      const lockedStatus: ConfirmedDayStatus = {
        ...existing,
        status: 'locked',
        lockedSubmissionId: submissionId,
      };
      confirmedDays[date] = lockedStatus;
    }

    await calendarStorage.replaceConfirmedDays(confirmedDays);
    calendarEvents.emit('confirmed-days-updated', {
      dates: dateKeys,
      submissionId,
    });
  }

  private static async parseErrorResponse(response: Response): Promise<string> {
    const payload = await this.safeJson(response);
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === 'string') {
        return detail;
      }
    }
    return `HTTP ${response.status}: ${response.statusText}`;
  }

  private static async safeJson(response: Response): Promise<unknown | null> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}
