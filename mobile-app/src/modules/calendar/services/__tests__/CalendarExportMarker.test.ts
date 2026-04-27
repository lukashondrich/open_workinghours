import {
  buildManagedEventMarker,
  formatManagedEventNotes,
  parseManagedEventMarker,
} from '../CalendarExportMarker';

describe('CalendarExportMarker', () => {
  const marker = {
    entityType: 'shift' as const,
    appId: 'shift:instance-123',
    fingerprint: 'abc12345',
  };

  it('formats the marker block deterministically', () => {
    expect(buildManagedEventMarker(marker)).toBe(
      ['owh:type=shift', 'owh:id=shift:instance-123', 'owh:fp=abc12345'].join('\n'),
    );
  });

  it('places the marker after a human-readable attribution line', () => {
    expect(formatManagedEventNotes('Early Shift', marker)).toBe(
      ['Early Shift - Open Working Hours', '', 'owh:type=shift', 'owh:id=shift:instance-123', 'owh:fp=abc12345'].join('\n'),
    );
  });

  it('returns marker-only notes when no label is provided', () => {
    expect(formatManagedEventNotes('', marker)).toBe(buildManagedEventMarker(marker));
  });

  it('parses a valid marker from the notes field', () => {
    const result = parseManagedEventMarker(formatManagedEventNotes('Early Shift', marker));

    expect(result).toEqual({
      status: 'valid',
      marker,
    });
  });

  it('returns missing when no managed marker exists', () => {
    expect(parseManagedEventMarker('Some unrelated notes')).toEqual({ status: 'missing' });
  });

  it('returns invalid when marker lines are incomplete', () => {
    expect(parseManagedEventMarker('owh:type=shift\nowh:id=shift:instance-123')).toEqual({
      status: 'invalid',
    });
  });
});
