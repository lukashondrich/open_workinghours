import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { CalendarExportEventDTO } from './CalendarExportTypes';

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Europe/Berlin';
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIcsDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatIcsDateTime(date: Date): string {
  return `${formatIcsDate(date)}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function formatIcsUtcTimestamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }

  const parts: string[] = [];
  let remaining = line;

  // First line: up to 75 octets
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);

  // Continuation lines: space + up to 74 chars
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }

  return parts.join('\r\n');
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateIcsContent(
  events: CalendarExportEventDTO[],
  options?: { now?: Date },
): string {
  const now = options?.now ?? new Date();
  const timezone = getDeviceTimezone();
  const dtstamp = formatIcsUtcTimestamp(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//Open Working Hours//EN',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${event.appId}@openworkinghours`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push('SEQUENCE:0');
    lines.push(foldLine(`SUMMARY:${escapeIcsText(event.title)}`));

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(event.startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(event.endDate)}`);
    } else {
      lines.push(foldLine(`DTSTART;TZID=${timezone}:${formatIcsDateTime(event.startDate)}`));
      lines.push(foldLine(`DTEND;TZID=${timezone}:${formatIcsDateTime(event.endDate)}`));
    }

    lines.push(`TRANSP:${event.entityType === 'absence' ? 'TRANSPARENT' : 'OPAQUE'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n') + '\r\n';
}

export function generateIcsFilename(startDate: string, endDate: string): string {
  return `open-working-hours-${startDate}-to-${endDate}.ics`;
}

export async function exportEventsToIcs(
  events: CalendarExportEventDTO[],
  startDateKey: string,
  endDateKey: string,
): Promise<void> {
  const icsContent = generateIcsContent(events);
  const filename = generateIcsFilename(startDateKey, endDateKey);

  const file = new File(Paths.document, filename);
  await file.write(icsContent);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/calendar',
    UTI: 'com.apple.ical.ics',
  });
}
