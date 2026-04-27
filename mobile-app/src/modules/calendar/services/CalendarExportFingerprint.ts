import type { ManagedEventFingerprintInput } from './CalendarExportTypes';

function stableHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createManagedEventFingerprint(input: ManagedEventFingerprintInput): string {
  return stableHash(
    JSON.stringify([
      input.entityType,
      input.title,
      input.startDate.toISOString(),
      input.endDate.toISOString(),
      input.allDay,
    ]),
  );
}
