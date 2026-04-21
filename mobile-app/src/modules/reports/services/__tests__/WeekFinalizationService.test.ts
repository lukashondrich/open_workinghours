import { addDays, format, parseISO } from 'date-fns';
import { WeekFinalizationService } from '../WeekFinalizationService';
import { getDatabase } from '../../../geofencing/services/Database';
import { AuthStorage } from '../../../../lib/auth/AuthStorage';
import { DailySubmissionService } from '../../../../modules/auth/services/DailySubmissionService';
import { getCalendarStorage } from '../../../../modules/calendar/services/CalendarStorage';
import { calendarEvents } from '../../../../lib/events/calendarEvents';
import type { ReportsWeekQueueRecord } from '../../../geofencing/types';
import type { ConfirmedDayStatus } from '../../../../lib/calendar/types';

jest.mock('../../../geofencing/services/Database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../../../lib/auth/AuthStorage', () => ({
  AuthStorage: {
    getToken: jest.fn(),
  },
}));

jest.mock('../../../../modules/auth/services/DailySubmissionService', () => ({
  DailySubmissionService: {
    processQueueForDates: jest.fn(),
    enqueueDailySubmission: jest.fn(),
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
const mockedProcessQueueForDates = DailySubmissionService.processQueueForDates as jest.MockedFunction<typeof DailySubmissionService.processQueueForDates>;
const mockedEnqueueDailySubmission = DailySubmissionService.enqueueDailySubmission as jest.MockedFunction<typeof DailySubmissionService.enqueueDailySubmission>;
const mockedGetCalendarStorage = getCalendarStorage as jest.MockedFunction<typeof getCalendarStorage>;
const mockedCalendarEventsEmit = calendarEvents.emit as jest.MockedFunction<typeof calendarEvents.emit>;

type MockDatabase = {
  getReportsWeekQueue: jest.Mock<Promise<ReportsWeekQueueRecord[]>, []>;
  getDailyActualsByDates: jest.Mock<Promise<any[]>, [string[]]>;
  getDailySubmissionQueueForRange: jest.Mock<Promise<any[]>, [string, string]>;
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

function createQueuedWeek(weekStart: string): ReportsWeekQueueRecord {
  return {
    weekStart,
    status: 'queued',
    queuedAt: `${weekStart}T20:00:00.000Z`,
    sentAt: null,
    lastError: null,
    updatedAt: `${weekStart}T20:00:00.000Z`,
  };
}

function createMockDatabase(overrides: Partial<MockDatabase> = {}): MockDatabase {
  return {
    getReportsWeekQueue: jest.fn().mockResolvedValue([]),
    getDailyActualsByDates: jest.fn().mockResolvedValue([]),
    getDailySubmissionQueueForRange: jest.fn().mockResolvedValue([]),
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
    mockedProcessQueueForDates.mockReset();
    mockedEnqueueDailySubmission.mockReset();
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

  it('marks week as sent and locks calendar days on 201 response', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => ({ date }))),
      getDailySubmissionQueueForRange: jest.fn().mockResolvedValue(
        dates.map((date) => ({ date, status: 'sent' })),
      ),
    });
    const calendarStorage = createMockCalendarStorage();
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');
    mockedGetCalendarStorage.mockResolvedValue(calendarStorage as any);
    (global.fetch as jest.Mock).mockResolvedValue(
      createResponse(201, { finalized_week_id: 'week-finalized-id' }),
    );

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(mockedProcessQueueForDates).toHaveBeenCalledWith(dates, { pendingRetries: 5, failedRetries: 3 });
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
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => ({ date }))),
      getDailySubmissionQueueForRange: jest.fn().mockResolvedValue(
        dates.map((date) => ({ date, status: 'sent' })),
      ),
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
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.slice(0, 6).map((date) => ({ date }))),
    });
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([{ weekStart, status: 'skipped_not_fully_confirmed' }]);
    expect(db.deleteReportsWeekByStart).toHaveBeenCalledWith(weekStart);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps week queued with error when daily submissions are incomplete', async () => {
    const weekStart = '2026-03-30';
    const dates = createWeekDates(weekStart);
    const db = createMockDatabase({
      getReportsWeekQueue: jest.fn().mockResolvedValue([createQueuedWeek(weekStart)]),
      getDailyActualsByDates: jest.fn().mockResolvedValue(dates.map((date) => ({ date }))),
      getDailySubmissionQueueForRange: jest.fn()
        .mockResolvedValueOnce(dates.map((date) => ({ date, status: 'pending' })))
        .mockResolvedValueOnce(dates.slice(0, 6).map((date) => ({ date, status: 'sent' }))),
    });
    mockedGetDatabase.mockResolvedValue(db as any);
    mockedGetToken.mockResolvedValue('jwt');

    const result = await WeekFinalizationService.sendEligibleQueuedWeeks();

    expect(result).toEqual([
      {
        weekStart,
        status: 'skipped_daily_incomplete',
        errorMessage: 'Not all daily submissions are sent yet.',
      },
    ]);
    expect(db.upsertReportsWeekQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStart,
        status: 'queued',
        lastError: 'Not all daily submissions are sent yet.',
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
