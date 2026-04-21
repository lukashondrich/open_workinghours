import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ReportsScreen from '../ReportsScreen';
import { WeekStateService } from '../../services/WeekStateService';
import { CollectiveInsightsService } from '../../services/CollectiveInsightsService';

jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useNavigation: () => ({ navigate: jest.fn() }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactLocal.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    state: {
      user: {
        stateCode: 'BE',
        specialty: 'Nursing',
      },
    },
  }),
}));

jest.mock('@/lib/i18n', () => ({
  t: (key: string, options?: Record<string, unknown>) =>
    options?.count !== undefined ? `${key}:${String(options.count)}` : key,
  getDateLocale: () => 'en',
}));

jest.mock('lucide-react-native', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Icon = () => ReactLocal.createElement(View);
  return {
    Check: Icon,
    X: Icon,
    Share2: Icon,
    Send: Icon,
    Download: Icon,
    MapPin: Icon,
    Lock: Icon,
  };
});

jest.mock('../../services/WeekStateService', () => ({
  WeekStateService: {
    getAutoSend: jest.fn(),
    getReportsFirstTimeSeen: jest.fn(),
    getLastRewardWeek: jest.fn(),
    reconcileAutoSendQueue: jest.fn(),
    loadWeekState: jest.fn(),
    setReportsFirstTimeSeen: jest.fn(),
    queueWeek: jest.fn(),
    unqueueWeek: jest.fn(),
    setAutoSend: jest.fn(),
    setLastRewardWeek: jest.fn(),
  },
}));

jest.mock('../../services/CollectiveInsightsService', () => ({
  CollectiveInsightsService: {
    getLatestPublishedStateSpecialtyInsights: jest.fn(),
  },
}));

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (WeekStateService.getAutoSend as jest.Mock).mockResolvedValue(false);
    (WeekStateService.getReportsFirstTimeSeen as jest.Mock).mockResolvedValue(false);
    (WeekStateService.getLastRewardWeek as jest.Mock).mockResolvedValue(null);
    (WeekStateService.reconcileAutoSendQueue as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders unlocked collective insights when sent weeks and published stats exist', async () => {
    (WeekStateService.loadWeekState as jest.Mock).mockResolvedValue({
      activeWeeks: [],
      sentWeeks: [
        {
          weekStart: '2026-03-30',
          weekEnd: '2026-04-05',
          weekNumber: 14,
          confirmedDays: 7,
          totalDays: 7,
          state: 'sent',
          isCurrentWeek: false,
        },
      ],
    });
    (CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights as jest.Mock).mockResolvedValue({
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

    const { queryByText, getByText } = render(<ReportsScreen />);

    await waitFor(() => {
      expect(CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights).toHaveBeenCalledWith({
        stateCode: 'BE',
        specialty: 'Nursing',
      });
    });

    expect(getByText(/reports\.collective\.avgOvertime/)).toBeTruthy();
    expect(queryByText('reports.collective.placeholder')).toBeNull();
  });
});
