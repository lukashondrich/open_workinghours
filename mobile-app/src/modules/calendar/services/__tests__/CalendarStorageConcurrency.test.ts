type MockDb = {
  execAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  runAsync: jest.Mock;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTrackedDb() {
  let activeOperations = 0;
  let maxActiveOperations = 0;
  const calls: string[] = [];

  const track = async <T,>(value: T, sql: string): Promise<T> => {
    calls.push(sql);
    activeOperations += 1;
    maxActiveOperations = Math.max(maxActiveOperations, activeOperations);
    await delay(5);
    activeOperations -= 1;
    return value;
  };

  const db: MockDb = {
    execAsync: jest.fn((sql: string) => track(undefined, sql)),
    getFirstAsync: jest.fn((sql: string) => track({ version: 5 }, sql)),
    getAllAsync: jest.fn((sql: string) => {
      const result = sql.includes('SELECT id FROM absence_templates')
        ? [{ id: 'vacation-full-day' }]
        : [];
      return track(result, sql);
    }),
    runAsync: jest.fn((sql: string) => track({ changes: 1 }, sql)),
  };

  return {
    db,
    calls,
    getMaxActiveOperations: () => maxActiveOperations,
  };
}

function loadCalendarStorage(db: MockDb) {
  jest.resetModules();
  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn(() => Promise.resolve(db)),
  }));

  return require('../CalendarStorage') as typeof import('../CalendarStorage');
}

describe('CalendarStorage concurrency', () => {
  afterEach(() => {
    jest.dontMock('expo-sqlite');
  });

  it('shares one initialization when storage is requested concurrently', async () => {
    const tracked = createTrackedDb();
    const sqlite = {
      openDatabaseAsync: jest.fn(() => Promise.resolve(tracked.db)),
    };

    jest.resetModules();
    jest.doMock('expo-sqlite', () => sqlite);

    const { getCalendarStorage } = require('../CalendarStorage') as typeof import('../CalendarStorage');

    const [first, second] = await Promise.all([
      getCalendarStorage(),
      getCalendarStorage(),
    ]);

    expect(first).toBe(second);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('serializes overlapping storage calls on the same database handle', async () => {
    const tracked = createTrackedDb();
    const { CalendarStorage } = loadCalendarStorage(tracked.db);
    const storage = new CalendarStorage();
    await storage.initialize();

    await Promise.all([
      storage.replaceDayNotes([
        {
          id: 'note-1',
          date: '2026-05-15',
          content: 'handover',
          createdAt: '2026-05-15T09:00:00.000Z',
          updatedAt: '2026-05-15T09:00:00.000Z',
        },
      ]),
      storage.replaceAbsenceInstances([]),
    ]);

    expect(tracked.getMaxActiveOperations()).toBe(1);
    expect(tracked.calls).toEqual(expect.arrayContaining([
      'DELETE FROM day_notes',
      'SELECT id FROM absence_templates',
      'DELETE FROM absence_instances',
    ]));
  });
});
