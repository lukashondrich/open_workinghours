import { createManagedEventFingerprint } from '../CalendarExportFingerprint';

describe('CalendarExportFingerprint', () => {
  const input = {
    entityType: 'shift' as const,
    title: 'Early Shift',
    startDate: new Date('2026-04-27T06:00:00.000Z'),
    endDate: new Date('2026-04-27T14:00:00.000Z'),
    allDay: false,
  };

  it('is stable for identical semantic input', () => {
    const first = createManagedEventFingerprint(input);
    const second = createManagedEventFingerprint({ ...input });

    expect(first).toBe(second);
  });

  it('changes when an exported field changes', () => {
    const original = createManagedEventFingerprint(input);
    const updated = createManagedEventFingerprint({
      ...input,
      endDate: new Date('2026-04-27T15:00:00.000Z'),
    });

    expect(updated).not.toBe(original);
  });
});
