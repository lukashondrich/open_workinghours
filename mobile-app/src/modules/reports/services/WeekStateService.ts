import { addDays, format, getISOWeek, isAfter, parseISO, startOfDay, startOfWeek } from 'date-fns';
import { getDatabase } from '../../geofencing/services/Database';
import type { DailyActual, ReportsWeekQueueRecord } from '../../geofencing/types';

export type WeekState = 'unconfirmed' | 'confirmed' | 'queued' | 'sent';

export interface WeekStateRecord {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  confirmedDays: number;
  totalDays: number;
  state: WeekState;
  isCurrentWeek: boolean;
}

export interface WeekStateReadModel {
  activeWeeks: WeekStateRecord[];
  sentWeeks: WeekStateRecord[];
}

const WEEK_STARTS_ON_MONDAY = 1;
const WEEK_DAYS = 7;

const PREF_AUTO_SEND = 'reports.auto_send';
const PREF_FIRST_TIME_SEEN = 'reports.first_time_seen';
const PREF_LAST_REWARD_WEEK = 'reports.last_reward_week';

interface WeekContext {
  db: Awaited<ReturnType<typeof getDatabase>>;
  currentWeekStartDate: Date;
  currentWeekStartKey: string;
  currentWeekEndKey: string;
  firstWeekStartDate: Date;
  confirmedDaysByWeekStart: Map<string, number>;
  queueRows: ReportsWeekQueueRecord[];
}

function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getWeekStartDate(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON_MONDAY });
}

function getWeekStartFromDateKey(dateKey: string): string {
  const parsed = parseISO(dateKey);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return formatDateKey(getWeekStartDate(parsed));
}

function sortByWeekStartDesc(a: WeekStateRecord, b: WeekStateRecord): number {
  return b.weekStart.localeCompare(a.weekStart);
}

function getEarliestQueueWeekStart(queueRows: ReportsWeekQueueRecord[]): string | null {
  if (queueRows.length === 0) return null;
  return queueRows.reduce((min, row) => (row.weekStart < min ? row.weekStart : min), queueRows[0].weekStart);
}

function parseWeekStartOrThrow(weekStart: string): Date {
  const parsed = parseISO(weekStart);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid weekStart: ${weekStart}`);
  }
  return getWeekStartDate(parsed);
}

function normalizeWeekStartKey(weekStart: string): string {
  return formatDateKey(parseWeekStartOrThrow(weekStart));
}

export class WeekStateService {
  static async loadWeekState(referenceDate: Date = new Date()): Promise<WeekStateReadModel> {
    const context = await this.getWeekContext(referenceDate);
    const queueRows = await this.reconcileInvalidQueuedWeeks(context);
    const queueByWeekStart = new Map(queueRows.map((row) => [row.weekStart, row]));

    const activeWeeks: WeekStateRecord[] = [];
    const sentWeeks: WeekStateRecord[] = [];

    let cursor = context.firstWeekStartDate;
    while (!isAfter(cursor, context.currentWeekStartDate)) {
      const weekStart = formatDateKey(cursor);
      const weekEnd = formatDateKey(addDays(cursor, WEEK_DAYS - 1));
      const confirmedDays = context.confirmedDaysByWeekStart.get(weekStart) ?? 0;
      const isCurrentWeek = weekStart === context.currentWeekStartKey;
      const state = this.resolveWeekState({
        isCurrentWeek,
        confirmedDays,
        queueRecord: queueByWeekStart.get(weekStart),
      });

      const row: WeekStateRecord = {
        weekStart,
        weekEnd,
        weekNumber: getISOWeek(cursor),
        confirmedDays,
        totalDays: WEEK_DAYS,
        state,
        isCurrentWeek,
      };

      if (state === 'sent') {
        sentWeeks.push(row);
      } else {
        activeWeeks.push(row);
      }

      cursor = addDays(cursor, WEEK_DAYS);
    }

    activeWeeks.sort(sortByWeekStartDesc);
    sentWeeks.sort(sortByWeekStartDesc);

    return { activeWeeks, sentWeeks };
  }

  static async queueWeek(weekStart: string, referenceDate: Date = new Date()): Promise<void> {
    const db = await getDatabase();
    const normalizedWeekStart = normalizeWeekStartKey(weekStart);
    const currentWeekStart = formatDateKey(getWeekStartDate(startOfDay(referenceDate)));

    // Queueing is only for past weeks.
    if (normalizedWeekStart >= currentWeekStart) {
      return;
    }

    const weekEnd = formatDateKey(addDays(parseISO(normalizedWeekStart), WEEK_DAYS - 1));
    const dailyActuals = await db.getDailyActualsForRange(normalizedWeekStart, weekEnd);
    if (dailyActuals.length < WEEK_DAYS) {
      throw new Error('Week must be fully confirmed before queueing');
    }

    const existing = await db.getReportsWeekByStart(normalizedWeekStart);
    if (existing?.status === 'sent') {
      return;
    }

    const now = new Date().toISOString();
    await db.upsertReportsWeekQueue({
      weekStart: normalizedWeekStart,
      status: 'queued',
      queuedAt: existing?.queuedAt ?? now,
      sentAt: null,
      lastError: existing?.lastError ?? null,
      updatedAt: now,
    });
  }

  static async unqueueWeek(weekStart: string): Promise<void> {
    const db = await getDatabase();
    const normalizedWeekStart = normalizeWeekStartKey(weekStart);
    const existing = await db.getReportsWeekByStart(normalizedWeekStart);

    if (!existing || existing.status === 'sent') {
      return;
    }

    await db.deleteReportsWeekByStart(normalizedWeekStart);
  }

  static async getQueuedWeeks(): Promise<string[]> {
    const db = await getDatabase();
    const queuedRows = await db.getReportsWeekQueue('queued');
    return queuedRows.map((row) => row.weekStart);
  }

  static async setAutoSend(enabled: boolean): Promise<void> {
    const db = await getDatabase();
    await db.setPreference(PREF_AUTO_SEND, enabled ? '1' : '0');
  }

  static async getAutoSend(): Promise<boolean> {
    const db = await getDatabase();
    const value = await db.getPreference(PREF_AUTO_SEND);
    return value === '1';
  }

  static async setReportsFirstTimeSeen(seen: boolean): Promise<void> {
    const db = await getDatabase();
    await db.setPreference(PREF_FIRST_TIME_SEEN, seen ? '1' : '0');
  }

  static async getReportsFirstTimeSeen(): Promise<boolean> {
    const db = await getDatabase();
    const value = await db.getPreference(PREF_FIRST_TIME_SEEN);
    return value === '1';
  }

  static async setLastRewardWeek(weekStart: string): Promise<void> {
    const db = await getDatabase();
    await db.setPreference(PREF_LAST_REWARD_WEEK, normalizeWeekStartKey(weekStart));
  }

  static async getLastRewardWeek(): Promise<string | null> {
    const db = await getDatabase();
    return db.getPreference(PREF_LAST_REWARD_WEEK);
  }

  static async reconcileAutoSendQueue(referenceDate: Date = new Date()): Promise<void> {
    const context = await this.getWeekContext(referenceDate);
    const queueRows = await this.reconcileInvalidQueuedWeeks(context);
    const queueByWeekStart = new Map(queueRows.map((row) => [row.weekStart, row]));

    for (const [weekStart, confirmedDays] of context.confirmedDaysByWeekStart.entries()) {
      const isPastWeek = weekStart < context.currentWeekStartKey;
      const isFullyConfirmed = confirmedDays >= WEEK_DAYS;
      if (!isPastWeek || !isFullyConfirmed) {
        continue;
      }

      const existing = queueByWeekStart.get(weekStart);
      if (existing?.status === 'queued' || existing?.status === 'sent') {
        continue;
      }

      const now = new Date().toISOString();
      await context.db.upsertReportsWeekQueue({
        weekStart,
        status: 'queued',
        queuedAt: now,
        sentAt: null,
        lastError: null,
        updatedAt: now,
      });
    }
  }

  private static async getWeekContext(referenceDate: Date): Promise<WeekContext> {
    const db = await getDatabase();
    const today = startOfDay(referenceDate);
    const currentWeekStartDate = getWeekStartDate(today);
    const currentWeekStartKey = formatDateKey(currentWeekStartDate);
    const currentWeekEndKey = formatDateKey(addDays(currentWeekStartDate, WEEK_DAYS - 1));

    const [firstDailyActualDate, queueRows] = await Promise.all([
      db.getFirstDailyActualDate(),
      db.getReportsWeekQueue(),
    ]);

    let firstWeekStartDate = currentWeekStartDate;

    if (firstDailyActualDate) {
      const parsed = parseISO(firstDailyActualDate);
      if (!Number.isNaN(parsed.getTime())) {
        firstWeekStartDate = getWeekStartDate(parsed);
      }
    }

    const earliestQueueWeekStart = getEarliestQueueWeekStart(queueRows);
    if (earliestQueueWeekStart) {
      const queueWeekStartDate = parseWeekStartOrThrow(earliestQueueWeekStart);
      if (isAfter(firstWeekStartDate, queueWeekStartDate)) {
        firstWeekStartDate = queueWeekStartDate;
      }
    }

    if (isAfter(firstWeekStartDate, currentWeekStartDate)) {
      firstWeekStartDate = currentWeekStartDate;
    }

    const dailyActuals = await db.getDailyActualsForRange(
      formatDateKey(firstWeekStartDate),
      currentWeekEndKey,
    );

    const confirmedDaysByWeekStart = this.countConfirmedDaysByWeekStart(dailyActuals);

    return {
      db,
      currentWeekStartDate,
      currentWeekStartKey,
      currentWeekEndKey,
      firstWeekStartDate,
      confirmedDaysByWeekStart,
      queueRows,
    };
  }

  private static countConfirmedDaysByWeekStart(dailyActuals: DailyActual[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const dailyActual of dailyActuals) {
      const weekStart = getWeekStartFromDateKey(dailyActual.date);
      counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
    }
    return counts;
  }

  private static async reconcileInvalidQueuedWeeks(context: WeekContext): Promise<ReportsWeekQueueRecord[]> {
    const validRows: ReportsWeekQueueRecord[] = [];

    for (const row of context.queueRows) {
      if (row.status !== 'queued') {
        validRows.push(row);
        continue;
      }

      const confirmedDays = context.confirmedDaysByWeekStart.get(row.weekStart) ?? 0;
      const isPastWeek = row.weekStart < context.currentWeekStartKey;
      const isFullyConfirmed = confirmedDays >= WEEK_DAYS;

      if (isPastWeek && isFullyConfirmed) {
        validRows.push(row);
        continue;
      }

      await context.db.deleteReportsWeekByStart(row.weekStart);
    }

    return validRows;
  }

  private static resolveWeekState({
    isCurrentWeek,
    confirmedDays,
    queueRecord,
  }: {
    isCurrentWeek: boolean;
    confirmedDays: number;
    queueRecord: ReportsWeekQueueRecord | undefined;
  }): WeekState {
    if (isCurrentWeek) {
      return 'unconfirmed';
    }

    const isFullyConfirmed = confirmedDays >= WEEK_DAYS;

    if (queueRecord?.status === 'sent') {
      return 'sent';
    }

    if (queueRecord?.status === 'queued' && isFullyConfirmed) {
      return 'queued';
    }

    if (isFullyConfirmed) {
      return 'confirmed';
    }

    return 'unconfirmed';
  }
}
