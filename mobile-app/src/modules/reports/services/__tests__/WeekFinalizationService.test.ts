import { addDays, format, parseISO } from 'date-fns';
import { WeekFinalizationService } from '../WeekFinalizationService';
import { getDatabase } from '../../../geofencing/services/Database';
import { AuthStorage } from '../../../../lib/auth/AuthStorage';
import { getCalendarStorage } from '../../../../modules/calendar/services/CalendarStorage';
import { calendarEvents } from '../../../../lib/events/calendarEvents';
import type { ReportsWeekQueueRecord, DailyActual } from '../../../geofencing/types';
import type { ConfirmedDayStatus } from '../../../../lib/calendar/types';

jest.mock('../../../geofencing/services/Database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../../../lib/auth/AuthStorage', () => ({
  AuthStorage: {
    getToken: jest.fn(),
  },
}));

jest.mock('../../../../modules/calendar/services/CalendarStorage', () => ({
  getCalendarStorage: jest.fn(),
}));

jest.mock('../../../../lib/events/calendarEvents', () => ({
  calendarEvents: {
    emit: jest.fn(),
  },
}));

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockedGetToken = AuthStorage.getToken as jest.MockedFunction<typeof AuthStorage.getToken>;
const mockedGetCalendarStorage = getCalendarStorage as jest.MockedFunction<typeof getCalendarStorage>;
const mockedCalendarEventsEmit = calendarEvents.emit as jest.MockedFunction<typeof calendarEvents.emit>;

type MockDatabase = {
  getReportsWeekQueue: jest.Mock<Promise<ReportsWeekQueueRecord[]>, []>;
  getDailyActualsByDates: jest.Mock<Promise<DailyActual[]>, [string[]]>;
  upsertReportsWeekQueue: jest.Mock<Promise<void>, [ReportsWeekQueueRecord]>;
  deleteReportsWeekByStart: jest.Mock<Promise<void>, [string]>;
};

type MockCalendarStorage = {
  loadConfirmedDays: jest.Mock<Promise<Record<string, ConfirmedDayStatus>>, []>;
  replaceConfirmedDays: jest.Mock<Promise<void>, [Record<string, ConfirmedDayStatus>]>;
};

function createWeekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), 'yyyy-MM-dd'));
}

function createDailyActual(date: string): DailyActual {
  return {
    id: `actual-${date}`,
    date,
    plannedMinutes: 480, // 8h
    actualMinutes: 540, // 9h
    source: 'geofence',
    confirmedAt: `${date}T18:00:00.000Z`,
    updatedAt: `${date}T18:00:00.000Z`,
  };
}

function createQueuedWeek(weekStart: string, sendAfter?: string | null): ReportsWeekQueueRecord {
  return {
    weekStart,
    status: 'queued',
    queuedAt: `${weekStart}T20:00:00.000Z`,
    sentAt: null,
    lastError: null,
    sendAfter: sendAfter ?? null,
    updatedAt: `${weekStart}T20:00:00.000Z`,
  };
}

function createMockDatabase(overrides: Partial<MockDatabase> = {}): MockDatabase {
  return {
    getReportsWeekQueue: jest.fn().mockResolvedValue([]),
    getDailyActualsByDates: jest.fn().mockResolvedValue([]),
    upsertReportsWeekQueue: jest.fn().mockResolvedValue(undefined),
    deleteReportsWeekByStart: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockCalendarStorage(overrides: Partial<MockCalendarStorage> = {}): MockCalendarStorage {
  return {
    loadConfirmedDays: jest.fn().mockResolvedValue({}),
    replaceConfirmedDays: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 201 ? 'Created' : status === 409 ? 'Conflict' : 'Error',
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('WeekFinalizationService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-11T10:00:00.000Z'));

    mockedGetDatabase.mockReset();
    mockedGetToken.mockReset();
    mockedGetCalendarStorage.mockReset();
    mockedCalendarEventsEmit.mockReset();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty when auth token is missing', async () => {
    const db = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue(null);

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([]);
    expect(db.getReportsWeekQueue).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips queued weeks that have not ended yet', async () => {
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek('2026-04-06')]),
    });
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([{ weekStart: '2026-04-06', status: 'skipped_not_ended' }]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('computes totals locally and sends planned_hours/actual_hours in POST body', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => createDailyActual(date))),
    });
    const calendarStorage = createMockCalendarStorage();
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');
    mockedGetCalendarStorage.mockResolvedValue(calendarStorage as any);
    (global.fetch as jest.Mock).mockResolvedValue(
      createResponse(201, { finalized_week_id: 'week-finalized-id' }),
    );

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    // Verify POST body includes planned_hours and actual_hours
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/finalized-weeks'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          week_start: weekStart,
          planned_hours: 56, // 7 days * 480 min / 60
          actual_hours: 63, // 7 days * 540 min / 60
        }),
      }),
    );

    expect(result).toEqual([
      { weekStart, status: 'sent', finalizedWeekId: 'week-finalized-id' },
    ]);
    expect(db.upsertReportsWeekQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStart,
        status: 'sent',
        sentAt: expect.any(String),
        lastError: null,
      }),
    );
    expect(calendarStorage.replaceConfirmedDays).toHaveBeenCalledTimes(1);
    expect(mockedCalendarEventsEmit).toHaveBeenCalledWith('confirmed-days-updated', {
      dates,
      submissionId: 'week-finalized-id',
    });
  });

  it('treats 409 as already finalized and marks week sent', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => createDailyActual(date))),
    });
    const calendarStorage = createMockCalendarStorage();
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');
    mockedGetCalendarStorage.mockResolvedValue(calendarStorage as any);
    (global.fetch as jest.Mock).mockResolvedValue(
      createResponse(409, { detail: 'already finalized' }),
    );

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([
      {
        weekStart,
        status: 'already_finalized',
        finalizedWeekId: `finalized-${weekStart}`,
      },
    ]);
    expect(db.upsertReportsWeekQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStart,
        status: 'sent',
      }),
    );
    expect(mockedCalendarEventsEmit).toHaveBeenCalledWith('confirmed-days-updated', {
      dates,
      submissionId: `finalized-${weekStart}`,
    });
  });

  it('reverts invalid queued week when confirmations are incomplete', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.slice(0, 6).map((date) => createDailyActual(date))),
    });
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([{ weekStart, status: 'skipped_not_fully_confirmed' }]);
    expect(db.deleteReportsWeekByStart).toHaveBeenCalledWith(weekStart);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips week when send_after is in the future', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const futureTime = new Date('2026-04-12T10:00:00.000Z').toISOString(); // future
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart, futureTime)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => createDailyActual(date))),
    });
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([{ weekStart, status: 'skipped_not_ready' }]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends week when send_after is in the past', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const pastTime = new Date('2026-04-05T18:30:00.000Z').toISOString(); // past
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart, pastTime)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => createDailyActual(date))),
    });
    const calendarStorage = createMockCalendarStorage();
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');
    mockedGetCalendarStorage.mockResolvedValue(calendarStorage as any);
    (global.fetch as jest.Mock).mockResolvedValue(
      createResponse(201, { finalized_week_id: 'test-id' }),
    );

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([{ weekStart, status: 'sent', finalizedWeekId: 'test-id' }]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('does not call DailySubmissionService (removed dependency)', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => createDailyActual(date))),
    });
    const calendarStorage = createMockCalendarStorage();
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');
    mockedGetCalendarStorage.mockResolvedValue(calendarStorage as any);
    (global.fetch as jest.Mock).mockResolvedValue(
      createResponse(201, { finalized_week_id: 'id' }),
    );

    await WeekFinalizationService.sendEligibleQueuedWeeks();

    // The old flow called getDailySubmissionQueueForRange — no longer
    expect(db).not.toHaveProperty('getDailySubmissionQueueForRange');
  });
});
