import type { ManagedEventFingerprintInput } from './CalendarExportTypes';

function stableHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function formatLocalDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function createManagedEventFingerprint(input: ManagedEventFingerprintInput): string {
  return stableHash(
    JSON.stringify([
      input.entityType,
      input.title,
      formatLocalDateTime(input.startDate),
      formatLocalDateTime(input.endDate),
      input.allDay,
    ]),
  );
}
