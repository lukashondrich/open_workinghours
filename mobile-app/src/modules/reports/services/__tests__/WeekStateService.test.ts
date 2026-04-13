import { addDays, format, parseISO } from 'date-fns';
import { WeekStateService } from '../WeekStateService';
import { getDatabase } from '../../../geofencing/services/Database';
import type { DailyActual, ReportsWeekQueueRecord } from '../../../geofencing/types';

jest.mock('../../../geofencing/services/Database', () => ({
  getDatabase: jest.fn(),
}));

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

type MockDatabase = {
  getFirstDailyActualDate: jest.Mock<Promise<string | null>, []>;
  getDailyActualsForRange: jest.Mock<Promise<DailyActual[]>, [string, string]>;
  getReportsWeekQueue: jest.Mock<Promise<ReportsWeekQueueRecord[]>, []>;
  getReportsWeekByStart: jest.Mock<Promise<ReportsWeekQueueRecord | null>, [string]>;
  upsertReportsWeekQueue: jest.Mock<Promise<void>, [ReportsWeekQueueRecord]>;
  deleteReportsWeekByStart: jest.Mock<Promise<void>, [string]>;
  setPreference: jest.Mock<Promise<void>, [string, string]>;
  getPreference: jest.Mock<Promise<string | null>, [string]>;
};

function createDailyActual(date: string): DailyActual {
  return {
    id: `actual-${date}`,
    date,
    plannedMinutes: 480,
    actualMinutes: 480,
    source: 'geofence',
    confirmedAt: `${date}T18:00:00.000Z`,
    updatedAt: `${date}T18:00:00.000Z`,
  };
}

function createWeekDailyActuals(weekStart: string, count: number): DailyActual[] {
  const start = parseISO(weekStart);
  return Array.from({ length: count }, (_, index) => {
    const date = format(addDays(start, index), 'yyyy-MM-dd');
    return createDailyActual(date);
  });
}

function createQueueRow(
  weekStart: string,
  status: ReportsWeekQueueRecord['status'],
): ReportsWeekQueueRecord {
  return {
    weekStart,
    status,
    queuedAt: status === 'queued' ? `${weekStart}T19:00:00.000Z` : null,
    sentAt: status === 'sent' ? `${weekStart}T21:00:00.000Z` : null,
    lastError: null,
    updatedAt: `${weekStart}T21:00:00.000Z`,
  };
}

function createMockDatabase(overrides: Partial<MockDatabase> = {}): MockDatabase {
  return {
    getFirstDailyActualDate: jest.fn().mockResolvedValue(null),
    getDailyActualsForRange: jest.fn().mockResolvedValue([]),
    getReportsWeekQueue: jest.fn().mockResolvedValue([]),
    getReportsWeekByStart: jest.fn().mockResolvedValue(null),
    upsertReportsWeekQueue: jest.fn().mockResolvedValue(undefined),
    deleteReportsWeekByStart: jest.fn().mockResolvedValue(undefined),
    setPreference: jest.fn().mockResolvedValue(undefined),
    getPreference: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('WeekStateService', () => {
  beforeEach(() => {
    mockedGetDatabase.mockReset();
  });

  it('returns current week as unconfirmed when no data exists', async () => {
    const db = createMockDatabase();
    mockedGetDatabase.mockResolvedValue(db as any);

    const result = await WeekStateService.loadWeekState(new Date(2026, 3, 11, 12, 0, 0));

    expect(db.getDailyActualsForRange).toHaveBeenCalledWith('2026-04-06', '2026-04-12');
    expect(result.sentWeeks).toEqual([]);
    expect(result.activeWeeks).toHaveLength(1);
    expect(result.activeWeeks[0]).toMatchObject({
      weekStart: '2026-04-06',
      confirmedDays: 0,
      state: 'unconfirmed',
      isCurrentWeek: true,
    });
  });

  it('builds continuous weeks with gaps and computes confirmation states', async () => {
    const db = createMockDatabase({
      getFirstDailyActualDate: jest.fn().mockResolvedValue('2026-03-10'),
      getDailyActualsForRange: jest.fn().mockResolvedValue([
        ...createWeekDailyActuals('2026-03-09', 2),
        ...createWeekDailyActuals('2026-03-30', 7),
        ...createWeekDailyActuals('2026-04-06', 3),
      ]),
    });
    mockedGetDatabase.mockResolvedValue(db as any);

    const result = await WeekStateService.loadWeekState(new Date(2026, 3, 11, 12, 0, 0));

    expect(result.activeWeeks.map((week) => week.weekStart)).toEqual([
      '2026-04-06',
      '2026-03-30',
      '2026-03-23',
      '2026-03-16',
      '2026-03-09',
    ]);

    expect(result.activeWeeks.map((week) => week.state)).toEqual([
      'unconfirmed',
      'confirmed',
      'unconfirmed',
      'unconfirmed',
      'unconfirmed',
    ]);

    expect(result.activeWeeks.map((week) => week.confirmedDays)).toEqual([3, 7, 0, 0, 2]);
  });

  it('reconciles queued rows that are no longer valid', async () => {
    const db = createMockDatabase({
      getFirstDailyActualDate: jest.fn().mockResolvedValue('2026-04-06'),
      getDailyActualsForRange: jest.fn().mockResolvedValue([
        ...createWeekDailyActuals('2026-04-06', 7),
        ...createWeekDailyActuals('2026-04-13', 6),
      ]),
      getReportsWeekQueue: jest.fn().mockResolvedValue([
        createQueueRow('2026-04-06', 'sent'),
        createQueueRow('2026-04-13', 'queued'),
      ]),
    });
    mockedGetDatabase.mockResolvedValue(db as any);

    const result = await WeekStateService.loadWeekState(new Date(2026, 3, 20, 12, 0, 0));

    expect(db.deleteReportsWeekByStart).toHaveBeenCalledWith('2026-04-13');
    expect(result.sentWeeks.map((week) => week.weekStart)).toEqual(['2026-04-06']);
    expect(result.activeWeeks.map((week) => week.weekStart)).toEqual(['2026-04-20', '2026-04-13']);
    expect(result.activeWeeks[1].state).toBe('unconfirmed');
    expect(result.activeWeeks[1].confirmedDays).toBe(6);
  });

  it('queues a fully confirmed past week', async () => {
    const db = createMockDatabase({
      getDailyActualsForRange: jest.fn().mockResolvedValue(createWeekDailyActuals('2026-03-30', 7)),
    });
    mockedGetDatabase.mockResolvedValue(db as any);

    await WeekStateService.queueWeek('2026-03-30', new Date(2026, 3, 11, 12, 0, 0));

    expect(db.upsertReportsWeekQueue).toHaveBeenCalledTimes(1);
    expect(db.upsertReportsWeekQueue.mock.calls[0][0]).toMatchObject({
      weekStart: '2026-03-30',
      status: 'queued',
      sentAt: null,
    });
  });

  it('does not queue current week', async () => {
    const db = createMockDatabase({
      getDailyActualsForRange: jest.fn().mockResolvedValue(createWeekDailyActuals('2026-04-06', 7)),
    });
    mockedGetDatabase.mockResolvedValue(db as any);

    await WeekStateService.queueWeek('2026-04-06', new Date(2026, 3, 11, 12, 0, 0));

    expect(db.upsertReportsWeekQueue).not.toHaveBeenCalled();
  });

  it('reconciles and auto-queues eligible past weeks when auto-send is enabled', async () => {
    const db = createMockDatabase({
      getFirstDailyActualDate: jest.fn().mockResolvedValue('2026-03-30'),
      getDailyActualsForRange: jest.fn().mockResolvedValue([
        ...createWeekDailyActuals('2026-03-30', 7),
        ...createWeekDailyActuals('2026-04-06', 7),
      ]),
      getReportsWeekQueue: jest.fn().mockResolvedValue([]),
    });
    mockedGetDatabase.mockResolvedValue(db as any);

    await WeekStateService.reconcileAutoSendQueue(new Date(2026, 3, 11, 12, 0, 0));

    expect(db.upsertReportsWeekQueue).toHaveBeenCalledTimes(1);
    expect(db.upsertReportsWeekQueue.mock.calls[0][0].weekStart).toBe('2026-03-30');
  });

  it('persists auto-send and first-time preferences', async () => {
    const db = createMockDatabase({
      getPreference: jest.fn()
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('2026-03-30'),
    });
    mockedGetDatabase.mockResolvedValue(db as any);

    await WeekStateService.setAutoSend(true);
    await WeekStateService.setReportsFirstTimeSeen(true);
    await WeekStateService.setLastRewardWeek('2026-03-30');

    await expect(WeekStateService.getAutoSend()).resolves.toBe(true);
    await expect(WeekStateService.getReportsFirstTimeSeen()).resolves.toBe(true);
    await expect(WeekStateService.getLastRewardWeek()).resolves.toBe('2026-03-30');

    expect(db.setPreference).toHaveBeenCalledWith('reports.auto_send', '1');
    expect(db.setPreference).toHaveBeenCalledWith('reports.first_time_seen', '1');
    expect(db.setPreference).toHaveBeenCalledWith('reports.last_reward_week', '2026-03-30');
  });
});
