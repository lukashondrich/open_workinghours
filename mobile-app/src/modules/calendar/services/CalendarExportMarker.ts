import type {
  ManagedCalendarEntityType,
  ManagedEventMarker,
  ManagedEventMarkerParseResult,
} from './CalendarExportTypes';

function isManagedEntityType(value: string): value is ManagedCalendarEntityType {
  return value === 'shift' || value === 'absence';
}

export function buildManagedEventMarker(marker: ManagedEventMarker): string {
  return [
    `owh:type=${marker.entityType}`,
    `owh:id=${marker.appId}`,
    `owh:fp=${marker.fingerprint}`,
  ].join('\n');
}

export function formatManagedEventNotes(
  label: string | null | undefined,
  marker: ManagedEventMarker,
): string {
  const markerBlock = buildManagedEventMarker(marker);
  const trimmedLabel = label?.trim();

  if (!trimmedLabel) {
    return markerBlock;
  }

  return `${trimmedLabel} - Open Working Hours\n\n${markerBlock}`;
}

export function parseManagedEventMarker(
  notes: string | null | undefined,
): ManagedEventMarkerParseResult {
  if (!notes) {
    return { status: 'missing' };
  }

  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const relevantLines = lines.filter((line) => line.startsWith('owh:'));

  if (relevantLines.length === 0) {
    return { status: 'missing' };
  }

  const type = relevantLines.find((line) => line.startsWith('owh:type='))?.slice('owh:type='.length);
  const appId = relevantLines.find((line) => line.startsWith('owh:id='))?.slice('owh:id='.length);
  const fingerprint = relevantLines.find((line) => line.startsWith('owh:fp='))?.slice('owh:fp='.length);

  if (!type || !appId || !fingerprint) {
    return { status: 'invalid' };
  }

  if (!isManagedEntityType(type)) {
    return { status: 'invalid' };
  }

  return {
    status: 'valid',
    marker: {
      entityType: type,
      appId,
      fingerprint,
    },
  };
}
