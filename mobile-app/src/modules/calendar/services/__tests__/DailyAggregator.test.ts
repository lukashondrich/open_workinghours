import { persistDailyActualForDate } from '../DailyAggregator';
import { getTrackingRecordsForDate } from '@/lib/calendar/time-calculations';
import type { AbsenceInstance, ShiftInstance } from '@/lib/calendar/types';
import type { DailyActual } from '@/modules/geofencing/types';

const upserted: DailyActual[] = [];

afterEach(() => {
  mockSessions = [];
  upserted.length = 0;
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'test-uuid',
}));

let mockSessions: Array<{ id: string; clockIn: string; clockOut: string | null; trackingMethod: string }> = [];
jest.mock('@/modules/calendar/services/CalendarStorage', () => ({
  getCalendarStorage: async () => ({
    loadTrackingBreaks: async () => ({ 'tracking-session-s1': 30 }),
  }),
}));

jest.mock('@/modules/geofencing/services/Database', () => ({
  getDatabase: async () => ({
    getSessionsBetween: async () => mockSessions,
    getDailyActual: async () => null,
    upsertDailyActual: async (record: DailyActual) => {
      upserted.push(record);
    },
  }),
}));

function makeShift(overrides: Partial<ShiftInstance> = {}): ShiftInstance {
  return {
    id: 'shift-1',
    templateId: 'tpl-1',
    date: '2026-09-07',
    startTime: '08:00',
    duration: 480,
    endTime: '16:00',
    color: 'teal',
    name: 'Frühdienst',
    ...overrides,
  };
}

function makeVacation(date: string): AbsenceInstance {
  return {
    id: 'abs-1',
    templateId: 'abs-tpl-1',
    type: 'vacation',
    date,
    startTime: '00:00',
    endTime: '23:59',
    isFullDay: true,
    name: 'Urlaub',
    color: 'amber',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  upserted.length = 0;
});

describe('persistDailyActualForDate — planned minutes', () => {
  it('records the planned shift minutes on a normal day', async () => {
    const shift = makeShift();
    const record = await persistDailyActualForDate('2026-09-07', { [shift.id]: shift }, {});

    expect(record.plannedMinutes).toBe(480);
    expect(upserted[0].plannedMinutes).toBe(480);
  });

  it('is absence-adjusted: a full-day vacation over a planned shift submits 0 planned', async () => {
    // The displayed planned value (month footer, Status widget) is
    // absence-adjusted — the confirmed snapshot must match what the user sees
    const shift = makeShift();
    const vacation = makeVacation('2026-09-07');
    const record = await persistDailyActualForDate(
      '2026-09-07',
      { [shift.id]: shift },
      { [vacation.id]: vacation }
    );

    expect(record.plannedMinutes).toBe(0);
  });

  it('records a confirmed empty day as a real 0/0 row', async () => {
    const record = await persistDailyActualForDate('2026-09-07', {}, {});

    expect(record.plannedMinutes).toBe(0);
    expect(record.actualMinutes).toBe(0);
    expect(record.confirmedAt).toBeTruthy();
    expect(upserted).toHaveLength(1);
  });

  it('session fallback (no calendar records passed) submits minutes net of calendar breaks', async () => {
    const day = new Date(2026, 8, 7, 8, 0);
    mockSessions = [
      { id: 's1', clockIn: day.toISOString(), clockOut: new Date(2026, 8, 7, 16, 0).toISOString(), trackingMethod: 'geofence_auto' },
    ];
    upserted.length = 0;
    const record = await persistDailyActualForDate('2026-09-07', {}, {});
    expect(record.actualMinutes).toBe(8 * 60 - 30);
    expect(record.source).toBe('geofence');
    mockSessions = [];
  });

  it('counts the after-midnight tail of an overnight record on the following day and labels the source from sessions', async () => {
    // Session Sun 22:00 → Mon 02:00 (geofence); the calendar record is dated Sunday
    mockSessions = [
      { id: 's1', clockIn: new Date(2026, 8, 6, 22, 0).toISOString(), clockOut: new Date(2026, 8, 7, 2, 0).toISOString(), trackingMethod: 'geofence_auto' },
    ];
    const records = [{ id: 'tracking-session-s1', date: '2026-09-06', startTime: '22:00', duration: 240, breakMinutes: 0 }];
    upserted.length = 0;
    const record = await persistDailyActualForDate('2026-09-07', {}, {}, records);
    expect(record.actualMinutes).toBe(120);
    expect(record.source).toBe('geofence'); // not 'manual' just because records were passed
  });

  it('the overlap-based lookup the week view now uses hands the Monday tail to the aggregator', async () => {
    const all = {
      'tracking-session-s1': { id: 'tracking-session-s1', date: '2026-09-06', startTime: '22:00', duration: 240, breakMinutes: 0 },
      'tracking-session-x': { id: 'tracking-session-x', date: '2026-09-05', startTime: '08:00', duration: 60, breakMinutes: 0 },
    };
    const forMonday = getTrackingRecordsForDate('2026-09-07', all); // what executeSubmit passes now
    expect(forMonday.map((r) => r.id)).toEqual(['tracking-session-s1']);
    const record = await persistDailyActualForDate('2026-09-07', {}, {}, forMonday);
    expect(record.actualMinutes).toBe(120);
  });
});
