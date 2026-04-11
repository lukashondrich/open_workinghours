import { CollectiveInsightsService } from '../CollectiveInsightsService';

describe('CollectiveInsightsService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns parsed insights when row is published with required fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          planned_mean_hours: 40,
          overtime_mean_hours: 5,
          planned_ci_half: 1.2,
          actual_ci_half: 1.7,
          overtime_ci_half: 0.8,
          n_display: 35,
          status: 'published',
          period_start: '2026-03-30',
          period_end: '2026-04-05',
        },
      ],
    });

    const result = await CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights({
      stateCode: 'BE',
      specialty: 'Nursing',
    });

    expect(result).toEqual({
      plannedMeanHours: 40,
      actualMeanHours: 45,
      overtimeMeanHours: 5,
      plannedCiHalf: 1.2,
      actualCiHalf: 1.7,
      overtimeCiHalf: 0.8,
      nDisplay: 35,
      periodStart: '2026-03-30',
      periodEnd: '2026-04-05',
    });
  });

  it('returns null for suppressed rows', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          planned_mean_hours: null,
          overtime_mean_hours: null,
          planned_ci_half: null,
          actual_ci_half: null,
          overtime_ci_half: null,
          n_display: null,
          status: 'suppressed',
          period_start: '2026-03-30',
          period_end: '2026-04-05',
        },
      ],
    });

    const result = await CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights({
      stateCode: 'BE',
      specialty: 'Nursing',
    });

    expect(result).toBeNull();
  });

  it('returns null when payload is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights({
      stateCode: 'BE',
      specialty: 'Nursing',
    });

    expect(result).toBeNull();
  });

  it('throws on non-ok responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(
      CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights({
        stateCode: 'BE',
        specialty: 'Nursing',
      }),
    ).rejects.toThrow('Failed to fetch collective insights: HTTP 500');
  });
});
