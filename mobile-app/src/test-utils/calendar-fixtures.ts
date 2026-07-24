import type { ShiftInstance, TrackingRecord, AbsenceInstance } from '../types';

/**
 * Shared test builders for calendar entities. `id` is required so identical-
 * looking calls can't silently collide when collected into a Record.
 */
export function makeShift(
  overrides: Partial<ShiftInstance> & { id: string; date: string; startTime: string; duration: number },
): ShiftInstance {
  return {
    templateId: 'tmpl-1',
    endTime: '00:00',
    color: 'teal',
    name: 'Test Shift',
    ...overrides,
  };
}

export function makeRecord(
  overrides: Partial<TrackingRecord> & { id: string; date: string; startTime: string; duration: number },
): TrackingRecord {
  return { ...overrides };
}

export function makeAbsence(
  overrides: Partial<AbsenceInstance> & { id: string; date: string; type: 'vacation' | 'sick' },
): AbsenceInstance {
  return {
    templateId: null,
    startTime: '00:00',
    endTime: '23:59',
    isFullDay: true,
    name: 'Absence',
    color: '#6B7280',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function toMap<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}
