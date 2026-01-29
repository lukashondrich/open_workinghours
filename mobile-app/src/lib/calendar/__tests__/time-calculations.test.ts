import type { ShiftInstance, TrackingRecord, AbsenceInstance } from '../types';
import {
  getDayBounds,
  computeOverlapMinutes,
  getInstanceWindow,
  computePlannedMinutesForDate,
  computeEffectivePlannedMinutesForDate,
  computeActualMinutesFromRecords,
  getTrackedMinutesForDate,
  getTrackingRecordsForDate,
} from '../time-calculations';

// Helper to create a ShiftInstance
function makeShift(overrides: Partial<ShiftInstance> & { date: string; startTime: string; duration: number }): ShiftInstance {
  return {
    id: 'shift-1',
    templateId: 'tmpl-1',
    endTime: '00:00',
    color: 'teal',
    name: 'Test Shift',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<TrackingRecord> & { date: string; startTime: string; duration: number }): TrackingRecord {
  return {
    id: 'rec-1',
    ...overrides,
  };
}

describe('getDayBounds', () => {
  it('returns midnight to midnight+1', () => {
    const { start, end } = getDayBounds('2025-03-15');
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(2); // March = 2
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(0);
  });
});

describe('computeOverlapMinutes', () => {
  it('returns full overlap for contained range', () => {
    const a = new Date(2025, 0, 1, 8, 0);
    const b = new Date(2025, 0, 1, 10, 0);
    const c = new Date(2025, 0, 1, 0, 0);
    const d = new Date(2025, 0, 2, 0, 0);
    expect(computeOverlapMinutes(a, b, c, d)).toBe(120);
  });

  it('returns 0 for no overlap', () => {
    const a = new Date(2025, 0, 1, 8, 0);
    const b = new Date(2025, 0, 1, 10, 0);
    const c = new Date(2025, 0, 2, 0, 0);
    const d = new Date(2025, 0, 3, 0, 0);
    expect(computeOverlapMinutes(a, b, c, d)).toBe(0);
  });

  it('clips to range boundaries', () => {
    // Session 22:00-06:00 next day, query day 1 (00:00-24:00)
    const a = new Date(2025, 0, 1, 22, 0);
    const b = new Date(2025, 0, 2, 6, 0);
    const c = new Date(2025, 0, 1, 0, 0);
    const d = new Date(2025, 0, 2, 0, 0);
    expect(computeOverlapMinutes(a, b, c, d)).toBe(120); // 22:00-00:00
  });
});

describe('getInstanceWindow', () => {
  it('computes correct start and end', () => {
    const shift = makeShift({ date: '2025-01-10', startTime: '08:30', duration: 480 });
    const { start, end } = getInstanceWindow(shift);
    expect(start.getHours()).toBe(8);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(16);
    expect(end.getMinutes()).toBe(30);
  });
});

describe('computePlannedMinutesForDate', () => {
  it('same-day shift: full duration', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '08:00', duration: 480 }),
    };
    expect(computePlannedMinutesForDate(instances, '2025-01-10')).toBe(480);
  });

  it('overnight shift: query start day gets pre-midnight portion', () => {
    // 22:00 + 480min = 06:00 next day
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '22:00', duration: 480 }),
    };
    expect(computePlannedMinutesForDate(instances, '2025-01-10')).toBe(120); // 22:00-00:00
  });

  it('overnight shift: query end day gets post-midnight portion', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '22:00', duration: 480 }),
    };
    expect(computePlannedMinutesForDate(instances, '2025-01-11')).toBe(360); // 00:00-06:00
  });

  it('24h shift splits across two days', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '08:00', duration: 1440 }),
    };
    // Day 1: 08:00-00:00 = 960 min
    expect(computePlannedMinutesForDate(instances, '2025-01-10')).toBe(960);
    // Day 2: 00:00-08:00 = 480 min
    expect(computePlannedMinutesForDate(instances, '2025-01-11')).toBe(480);
  });

  it('multiple shifts same day', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ id: 's1', date: '2025-01-10', startTime: '08:00', duration: 240 }),
      s2: makeShift({ id: 's2', date: '2025-01-10', startTime: '14:00', duration: 240 }),
    };
    expect(computePlannedMinutesForDate(instances, '2025-01-10')).toBe(480);
  });

  it('no shifts returns 0', () => {
    expect(computePlannedMinutesForDate({}, '2025-01-10')).toBe(0);
  });

  it('midnight boundary: shift ending exactly at midnight', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '16:00', duration: 480 }), // 16:00-00:00
    };
    expect(computePlannedMinutesForDate(instances, '2025-01-10')).toBe(480);
    expect(computePlannedMinutesForDate(instances, '2025-01-11')).toBe(0);
  });
});

describe('computeActualMinutesFromRecords', () => {
  it('same-day record: full net duration', () => {
    const records = [makeRecord({ date: '2025-01-10', startTime: '08:00', duration: 480, breakMinutes: 30 })];
    expect(computeActualMinutesFromRecords('2025-01-10', records)).toBe(450);
  });

  it('overnight record clipped to day with proportional break', () => {
    // 22:00 + 480min = 06:00, break = 60min
    const records = [makeRecord({ date: '2025-01-10', startTime: '22:00', duration: 480, breakMinutes: 60 })];
    // Day 1: overlap=120, ratio=120/480=0.25, break=15, net=105
    expect(computeActualMinutesFromRecords('2025-01-10', records)).toBe(105);
    // Day 2: overlap=360, ratio=360/480=0.75, break=45, net=315
    expect(computeActualMinutesFromRecords('2025-01-11', records)).toBe(315);
  });

  it('empty records returns 0', () => {
    expect(computeActualMinutesFromRecords('2025-01-10', [])).toBe(0);
  });

  it('record with no break', () => {
    const records = [makeRecord({ date: '2025-01-10', startTime: '09:00', duration: 300 })];
    expect(computeActualMinutesFromRecords('2025-01-10', records)).toBe(300);
  });
});

describe('getTrackedMinutesForDate', () => {
  it('detects overnight tracking record', () => {
    const trackingRecords: Record<string, TrackingRecord> = {
      r1: makeRecord({ date: '2025-01-10', startTime: '22:00', duration: 480 }),
    };
    const day1 = getTrackedMinutesForDate('2025-01-10', trackingRecords);
    expect(day1.trackedMinutes).toBe(120);
    expect(day1.hasTracking).toBe(true);

    const day2 = getTrackedMinutesForDate('2025-01-11', trackingRecords);
    expect(day2.trackedMinutes).toBe(360);
    expect(day2.hasTracking).toBe(true);
  });

  it('no records = no tracking', () => {
    const result = getTrackedMinutesForDate('2025-01-10', {});
    expect(result.trackedMinutes).toBe(0);
    expect(result.hasTracking).toBe(false);
  });
});

describe('getTrackingRecordsForDate', () => {
  it('includes overnight records on both days', () => {
    const trackingRecords: Record<string, TrackingRecord> = {
      r1: makeRecord({ date: '2025-01-10', startTime: '22:00', duration: 480 }),
    };
    expect(getTrackingRecordsForDate('2025-01-10', trackingRecords)).toHaveLength(1);
    expect(getTrackingRecordsForDate('2025-01-11', trackingRecords)).toHaveLength(1);
    expect(getTrackingRecordsForDate('2025-01-12', trackingRecords)).toHaveLength(0);
  });

  it('excludes non-overlapping records', () => {
    const trackingRecords: Record<string, TrackingRecord> = {
      r1: makeRecord({ date: '2025-01-10', startTime: '08:00', duration: 480 }),
    };
    expect(getTrackingRecordsForDate('2025-01-11', trackingRecords)).toHaveLength(0);
  });
});

// Helper for absence instances
function makeAbsence(overrides: Partial<AbsenceInstance> & { date: string }): AbsenceInstance {
  return {
    id: 'abs-1',
    templateId: null,
    type: 'vacation',
    startTime: '00:00',
    endTime: '23:59',
    isFullDay: true,
    name: 'Vacation',
    color: '#ccc',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

describe('computeEffectivePlannedMinutesForDate', () => {
  it('no absences: same as computePlannedMinutesForDate', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '08:00', duration: 480 }),
    };
    expect(computeEffectivePlannedMinutesForDate(instances, [], '2025-01-10')).toBe(480);
  });

  it('full-day absence removes all planned minutes', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '08:00', duration: 480 }),
    };
    const absences = [makeAbsence({ date: '2025-01-10' })];
    expect(computeEffectivePlannedMinutesForDate(instances, absences, '2025-01-10')).toBe(0);
  });

  it('partial absence subtracts overlap only', () => {
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '08:00', duration: 480 }), // 08:00-16:00
    };
    // Absence 08:00-12:00 (4h overlap with shift)
    const absences = [makeAbsence({ date: '2025-01-10', isFullDay: false, startTime: '08:00', endTime: '12:00' })];
    expect(computeEffectivePlannedMinutesForDate(instances, absences, '2025-01-10')).toBe(240);
  });

  it('overnight shift with absence on next day', () => {
    // Shift: 22:00 Jan 10 + 480min = 06:00 Jan 11
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '22:00', duration: 480 }),
    };
    // Full-day absence on Jan 11
    const absences = [makeAbsence({ date: '2025-01-11' })];

    // Jan 10: 22:00-00:00 = 120 min, no absence overlap
    expect(computeEffectivePlannedMinutesForDate(instances, absences, '2025-01-10')).toBe(120);
    // Jan 11: 00:00-06:00 = 360 min, full-day absence covers it all
    expect(computeEffectivePlannedMinutesForDate(instances, absences, '2025-01-11')).toBe(0);
  });

  it('overnight shift with partial absence on next day', () => {
    // Shift: 22:00 Jan 10 + 480min = 06:00 Jan 11
    const instances: Record<string, ShiftInstance> = {
      s1: makeShift({ date: '2025-01-10', startTime: '22:00', duration: 480 }),
    };
    // Absence 00:00-03:00 on Jan 11
    const absences = [makeAbsence({ date: '2025-01-11', isFullDay: false, startTime: '00:00', endTime: '03:00' })];

    // Jan 11: shift 00:00-06:00 (360min) minus absence 00:00-03:00 (180min) = 180min
    expect(computeEffectivePlannedMinutesForDate(instances, absences, '2025-01-11')).toBe(180);
  });

  it('no shifts returns 0', () => {
    const absences = [makeAbsence({ date: '2025-01-10' })];
    expect(computeEffectivePlannedMinutesForDate({}, absences, '2025-01-10')).toBe(0);
  });
});
