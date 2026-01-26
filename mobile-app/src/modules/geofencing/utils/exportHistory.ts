/**
 * Work History Export Utilities
 *
 * Handles exporting work session history to CSV format.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { TrackingSession } from '@/modules/geofencing/types';

/**
 * Export sessions to CSV and open the share sheet.
 *
 * @param sessions - Array of tracking sessions to export
 * @param locationName - Name of the location (used in filename)
 */
export async function exportSessionsToCSV(
  sessions: TrackingSession[],
  locationName: string
): Promise<void> {
  const csv = generateCSV(sessions);
  const filename = `work-history-${sanitizeFilename(locationName)}.csv`;

  // Create file in document directory
  const file = new File(Paths.document, filename);
  await file.write(csv);

  // Share the file
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}

/**
 * Generate CSV content from sessions.
 */
function generateCSV(sessions: TrackingSession[]): string {
  const header = 'Date,Day,Clock In,Clock Out,Duration (hours),Method,Status';

  const rows = sessions.map((session) => {
    const date = formatDateForCSV(session.clockIn);
    const day = formatDayName(session.clockIn);
    const clockIn = formatTimeForCSV(session.clockIn);
    const clockOut = session.clockOut ? formatTimeForCSV(session.clockOut) : '';
    const hours = session.durationMinutes
      ? (session.durationMinutes / 60).toFixed(2)
      : '';
    const method = session.trackingMethod === 'geofence_auto' ? 'Automatic' : 'Manual';
    const status = session.state === 'completed' ? 'Completed' : 'Active';

    return `${date},${day},${clockIn},${clockOut},${hours},${method},${status}`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Format ISO date string to YYYY-MM-DD for CSV.
 */
function formatDateForCSV(isoString: string): string {
  return isoString.split('T')[0];
}

/**
 * Get day name from ISO date string.
 */
function formatDayName(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Format ISO date string to HH:MM for CSV.
 */
function formatTimeForCSV(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Sanitize string for use in filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}
