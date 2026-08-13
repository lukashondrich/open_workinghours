import { subDays, format, setHours, startOfDay } from 'date-fns';
import { loadDashboardData } from '../DashboardDataService';
import { getDatabase } from '../Database';
import { getCalendarStorage } from '../../../calendar/services/CalendarStorage';

jest.mock('../Database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../../calendar/services/CalendarStorage', () => ({
  getCalendarStorage: jest.fn(),
}));

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockedGetCalendarStorage = getCalendarStorage as jest.MockedFunction<typeof getCalendarStorage>;

function dateKey(daysAgo: number): string {
  return format(subDays(new Date(), daysAgo), 'yyyy-MM-dd');
}

/** An 08:00–16:00 completed session on the given past day. */
function sessionOn(daysAgo: number) {
  const day = startOfDay(subDays(new Date(), daysAgo));
  return {
    clockIn: setHours(day, 8).toISOString(),
    clockOut: setHours(day, 16).toISOString(),
  };
}

describe('loadDashboardData confirmation counting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCalendarStorage.mockResolvedValue({
      loadInstances: jest.fn().mockResolvedValue({}),
      loadConfirmedDays: jest.fn().mockResolvedValue({
        [dateKey(1)]: { status: 'confirmed', confirmedAt: 'x' },
        [dateKey(2)]: { status: 'locked', confirmedAt: 'x', lockedSubmissionId: 'sub-1' },
        // dateKey(3): tracked but never confirmed
      }),
      loadAbsenceInstances: jest.fn().mockResolvedValue({}),
    } as any);
    mockedGetDatabase.mockResolvedValue({
      getActiveLocations: jest.fn().mockResolvedValue([]),
      getSessionsBetween: jest.fn().mockResolvedValue([sessionOn(1), sessionOn(2), sessionOn(3)]),
      getActiveSession: jest.fn().mockResolvedValue(null),
    } as any);
  });

  it("counts 'locked' (confirmed-and-submitted) days as confirmed", async () => {
    const data = await loadDashboardData();

    const byDate = Object.fromEntries(data.hoursSummary.days.map((d) => [d.date, d]));
    expect(byDate[dateKey(1)].isConfirmed).toBe(true);
    expect(byDate[dateKey(2)].isConfirmed).toBe(true); // locked — the v2.1.x undercount bug
    expect(byDate[dateKey(3)].isConfirmed).toBe(false);

    // Every elapsed day of the 14-day window is eligible (13 non-today days),
    // not just the 3 with sessions — empty days need review too.
    expect(data.hoursSummary.eligibleDayCount).toBe(13);
    expect(data.hoursSummary.confirmedDayCount).toBe(2);
  });
});
