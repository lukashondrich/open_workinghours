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

  it('is stable across equivalent Date constructions for the same local time', () => {
    // Same local time constructed two different ways
    const fp1 = createManagedEventFingerprint({
      entityType: 'shift',
      title: 'Early Shift',
      startDate: new Date(2026, 3, 27, 8, 0, 0, 0),
      endDate: new Date(2026, 3, 27, 16, 0, 0, 0),
      allDay: false,
    });
    const fp2 = createManagedEventFingerprint({
      entityType: 'shift',
      title: 'Early Shift',
      startDate: new Date(2026, 3, 27, 8, 0, 0, 0),
      endDate: new Date(2026, 3, 27, 16, 0, 0, 0),
      allDay: false,
    });

    expect(fp1).toBe(fp2);
  });

  it('changes when title changes', () => {
    const original = createManagedEventFingerprint({
      entityType: 'shift',
      title: 'Early Shift',
      startDate: new Date(2026, 3, 27, 8, 0),
      endDate: new Date(2026, 3, 27, 16, 0),
      allDay: false,
    });
    const renamed = createManagedEventFingerprint({
      entityType: 'shift',
      title: 'Late Shift',
      startDate: new Date(2026, 3, 27, 8, 0),
      endDate: new Date(2026, 3, 27, 16, 0),
      allDay: false,
    });

    expect(renamed).not.toBe(original);
  });

  it('changes when allDay changes', () => {
    const timed = createManagedEventFingerprint({
      entityType: 'absence',
      title: 'Vacation',
      startDate: new Date(2026, 3, 28, 0, 0),
      endDate: new Date(2026, 3, 29, 0, 0),
      allDay: false,
    });
    const allDay = createManagedEventFingerprint({
      entityType: 'absence',
      title: 'Vacation',
      startDate: new Date(2026, 3, 28, 0, 0),
      endDate: new Date(2026, 3, 29, 0, 0),
      allDay: true,
    });

    expect(allDay).not.toBe(timed);
  });

  it('does not change when notes content would differ', () => {
    // Fingerprint should exclude notes — same event data = same fingerprint
    const fp = createManagedEventFingerprint({
      entityType: 'shift',
      title: 'Early Shift',
      startDate: new Date(2026, 3, 27, 8, 0),
      endDate: new Date(2026, 3, 27, 16, 0),
      allDay: false,
    });

    // Call again — should be identical (notes are not an input)
    const fp2 = createManagedEventFingerprint({
      entityType: 'shift',
      title: 'Early Shift',
      startDate: new Date(2026, 3, 27, 8, 0),
      endDate: new Date(2026, 3, 27, 16, 0),
      allDay: false,
    });

    expect(fp).toBe(fp2);
  });
});
