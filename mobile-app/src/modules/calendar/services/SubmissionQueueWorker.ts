import Constants from 'expo-constants';
import { getDatabase } from '@/modules/geofencing/services/Database';
import type { WeeklySubmissionRecord } from '@/modules/geofencing/types';

type ExtraConfig = Record<string, any> | undefined;

function resolveExtra(): ExtraConfig {
  if (Constants?.expoConfig?.extra) return Constants.expoConfig.extra;
  if (Constants?.manifest?.extra) return Constants.manifest.extra as Record<string, any>;
  const manifest2 = (Constants as any)?.manifest2;
  if (manifest2?.extra?.expoGo?.extra) return manifest2.extra.expoGo.extra;
  if (manifest2?.extra?.easClient?.extra) return manifest2.extra.easClient.extra;
  return undefined;
}

function getSubmissionBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_SUBMISSION_BASE_URL;
  const extraUrl = resolveExtra()?.submissionBaseUrl;
  return envUrl ?? extraUrl ?? null;
}

function getSubmissionEndpoint() {
  const baseUrl = getSubmissionBaseUrl();
  if (!baseUrl) {
    throw new Error('Submission endpoint is not configured. Set EXPO_PUBLIC_SUBMISSION_BASE_URL.');
  }
  return `${baseUrl.replace(/\/$/, '')}/submissions/weekly`;
}

function minutesToHours(minutes: number) {
  return Number((minutes / 60).toFixed(2));
}

async function sendRecord(record: WeeklySubmissionRecord) {
  const endpoint = getSubmissionEndpoint();
  const payload = {
    week_start: record.weekStart,
    week_end: record.weekEnd,
    planned_hours: minutesToHours(record.plannedMinutesNoisy),
    actual_hours: minutesToHours(record.actualMinutesNoisy),
    client_version: Constants.expoConfig?.version ?? 'dev',
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Submission failed with status ${response.status}`);
  }

  return response.json().catch(() => null);
}

export async function processSubmissionQueue(targetIds?: string[]) {
  const db = await getDatabase();
  let queue: WeeklySubmissionRecord[] = [];

  if (targetIds?.length) {
    const all = await db.getWeeklySubmissions();
    queue = all.filter((record) => targetIds.includes(record.id));
  } else {
    queue = await db.getWeeklySubmissions('pending');
  }

  for (const record of queue) {
    try {
      await db.updateWeeklySubmissionStatus(record.id, 'sending', null);
      await sendRecord(record);
      await db.updateWeeklySubmissionStatus(record.id, 'sent', null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed';
      await db.updateWeeklySubmissionStatus(record.id, 'failed', message);
      throw error;
    }
  }

  return queue.length;
}
