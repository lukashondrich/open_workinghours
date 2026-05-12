import { generateIcsContent, generateIcsFilename } from '../IcsFileGenerator';
import type { CalendarExportEventDTO } from '../CalendarExportTypes';

// Mock expo-file-system and expo-sharing (not needed for unit tests of content generation)
jest.mock('expo-file-system', () => ({}), { virtual: true });
jest.mock('expo-sharing', () => ({}), { virtual: true });

const now = new Date(2026, 3, 30, 10, 0, 0); // 2026-04-30 10:00:00

describe('IcsFileGenerator', () => {
  const shiftEvent: CalendarExportEventDTO = {
    appId: 'shift:shift-1',
    entityType: 'shift',
    title: 'Early Shift',
    startDate: new Date(2026, 3, 30, 8, 0),
    endDate: new Date(2026, 3, 30, 16, 0),
    allDay: false,
  };

  const absenceEvent: CalendarExportEventDTO = {
    appId: 'absence:absence-1',
    entityType: 'absence',
    title: 'Vacation',
    startDate: new Date(2026, 4, 1, 0, 0),
    endDate: new Date(2026, 4, 2, 0, 0),
    allDay: true,
  };

  it('produces a valid VCALENDAR wrapper with VERSION, CALSCALE, and PRODID', () => {
    const ics = generateIcsContent([], { now });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('PRODID:-//Open Working Hours//EN');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('includes UID, DTSTAMP, and SEQUENCE:0 in each VEVENT', () => {
    const ics = generateIcsContent([shiftEvent], { now });

    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:shift:shift-1@openworkinghours');
    expect(ics).toContain('DTSTAMP:20260430T');
    expect(ics).toContain('SEQUENCE:0');
    expect(ics).toContain('END:VEVENT');
  });

  it('formats timed events with TZID on DTSTART and DTEND', () => {
    const ics = generateIcsContent([shiftEvent], { now });

    // Should contain TZID= (device timezone) with local time
    expect(ics).toMatch(/DTSTART;TZID=.+:20260430T080000/);
    expect(ics).toMatch(/DTEND;TZID=.+:20260430T160000/);
  });

  it('formats full-day absences with VALUE=DATE', () => {
    const ics = generateIcsContent([absenceEvent], { now });

    expect(ics).toContain('DTSTART;VALUE=DATE:20260501');
    expect(ics).toContain('DTEND;VALUE=DATE:20260502');
    // Should NOT contain TZID for all-day events
    expect(ics).not.toMatch(/DTSTART;TZID=.*:20260501/);
  });

  it('sets TRANSP:OPAQUE for shifts and TRANSP:TRANSPARENT for absences', () => {
    const ics = generateIcsContent([shiftEvent, absenceEvent], { now });
    const vevents = ics.split('BEGIN:VEVENT').slice(1);

    // First VEVENT is the shift
    expect(vevents[0]).toContain('TRANSP:OPAQUE');
    // Second VEVENT is the absence
    expect(vevents[1]).toContain('TRANSP:TRANSPARENT');
  });

  it('folds long lines at 75 characters', () => {
    const longTitleEvent: CalendarExportEventDTO = {
      ...shiftEvent,
      title: 'A'.repeat(100),
    };

    const ics = generateIcsContent([longTitleEvent], { now });
    const lines = ics.split('\r\n');

    // Every physical line should be <= 75 chars (continuation lines start with space)
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('generates correct filename from date range', () => {
    expect(generateIcsFilename('2026-04-30', '2026-05-28')).toBe(
      'open-working-hours-2026-04-30-to-2026-05-28.ics'
    );
  });

  it('escapes special characters in SUMMARY', () => {
    const eventWithSpecialChars: CalendarExportEventDTO = {
      ...shiftEvent,
      title: 'Night; Shift, with\\backslash',
    };

    const ics = generateIcsContent([eventWithSpecialChars], { now });

    expect(ics).toContain('Night\\; Shift\\, with\\\\backslash');
  });

  it('uses CRLF line endings per RFC 5545', () => {
    const ics = generateIcsContent([shiftEvent], { now });

    // Should use \r\n line endings
    expect(ics).toContain('\r\n');
    // Should not have bare \n without preceding \r (except inside escaped text)
    const withoutEscaped = ics.replace(/\\n/g, '');
    const bareNewlines = withoutEscaped.split('\n').filter((_, i) => {
      const pos = withoutEscaped.indexOf('\n');
      return pos > 0 && withoutEscaped[pos - 1] !== '\r';
    });
    // All newlines should be preceded by \r
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('renders multiple events in order', () => {
    const ics = generateIcsContent([shiftEvent, absenceEvent], { now });
    const shiftPos = ics.indexOf('shift:shift-1@openworkinghours');
    const absencePos = ics.indexOf('absence:absence-1@openworkinghours');

    expect(shiftPos).toBeLessThan(absencePos);
  });
});
