import Constants from 'expo-constants';

const BASE_URL =
  Constants.expoConfig?.extra?.submissionBaseUrl ||
  Constants.expoConfig?.extra?.authBaseUrl ||
  'http://localhost:8000';

interface StatsByStateSpecialtyRow {
  planned_mean_hours: number | null;
  overtime_mean_hours: number | null;
  planned_ci_half: number | null;
  actual_ci_half: number | null;
  overtime_ci_half: number | null;
  n_display: number | null;
  status: string;
  period_start: string;
  period_end: string;
}

export interface CollectiveInsightsData {
  plannedMeanHours: number;
  actualMeanHours: number;
  overtimeMeanHours: number;
  plannedCiHalf: number;
  actualCiHalf: number;
  overtimeCiHalf: number;
  nDisplay: number;
  periodStart: string;
  periodEnd: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePublishedRow(row: StatsByStateSpecialtyRow): CollectiveInsightsData | null {
  if (row.status !== 'published') {
    return null;
  }

  if (
    !isFiniteNumber(row.planned_mean_hours) ||
    !isFiniteNumber(row.overtime_mean_hours) ||
    !isFiniteNumber(row.planned_ci_half) ||
    !isFiniteNumber(row.actual_ci_half) ||
    !isFiniteNumber(row.overtime_ci_half) ||
    !isFiniteNumber(row.n_display)
  ) {
    return null;
  }

  return {
    plannedMeanHours: row.planned_mean_hours,
    actualMeanHours: row.planned_mean_hours + row.overtime_mean_hours,
    overtimeMeanHours: row.overtime_mean_hours,
    plannedCiHalf: row.planned_ci_half,
    actualCiHalf: row.actual_ci_half,
    overtimeCiHalf: row.overtime_ci_half,
    nDisplay: row.n_display,
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

export class CollectiveInsightsService {
  static async getLatestPublishedStateSpecialtyInsights(params: {
    stateCode: string;
    specialty: string;
    countryCode?: string;
  }): Promise<CollectiveInsightsData | null> {
    const stateCode = params.stateCode?.trim();
    const specialty = params.specialty?.trim();
    const countryCode = params.countryCode?.trim() || 'DEU';

    if (!stateCode || !specialty) {
      return null;
    }

    const searchParams = new URLSearchParams({
      country_code: countryCode,
      state_code: stateCode,
      specialty,
      limit: '1',
    });

    const response = await fetch(`${BASE_URL}/stats/by-state-specialty?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch collective insights: HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    return parsePublishedRow(payload[0] as StatsByStateSpecialtyRow);
  }
}
