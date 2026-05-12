import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactLocal.useEffect(() => callback(), [callback]);
    },
  };
});

import CalendarExportScreen from '../CalendarExportScreen';

const mockGetState = jest.fn();
const mockGetShiftInstancesForDateRange = jest.fn();
const mockGetAbsenceInstancesForDateRange = jest.fn();
const mockBuildDesiredManagedCalendarEvents = jest.fn();
const mockExportEventsToIcs = jest.fn();

jest.mock('@/lib/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('lucide-react-native', () => {
  const ReactLocal = require('react');
  const { View: NativeView } = require('react-native');
  const Icon = () => ReactLocal.createElement(NativeView);
  return {
    Calendar: Icon,
    Download: Icon,
  };
});

jest.mock('@/components/ui', () => {
  const ReactLocal = require('react');
  const { View: NativeView, Text: NativeText } = require('react-native');
  return {
    ListItem: ({ title, subtitle, rightElement, testID }: any) => ReactLocal.createElement(
      NativeView,
      { testID },
      ReactLocal.createElement(NativeText, null, title),
      subtitle ? ReactLocal.createElement(NativeText, null, subtitle) : null,
      rightElement,
    ),
  };
});

jest.mock('@/components/ui/SettingsDetailLayout', () => ({
  SettingsDetailLayout: ({ children }: { children: React.ReactNode }) => {
    const ReactLocal = require('react');
    const { View: NativeView } = require('react-native');
    return ReactLocal.createElement(NativeView, null, children);
  },
}));

jest.mock('@/modules/calendar/services/CalendarExportManager', () => ({
  getCalendarExportManager: () => Promise.resolve({
    getState: mockGetState,
  }),
}));

jest.mock('@/modules/calendar/services/CalendarStorage', () => ({
  getCalendarStorage: () => Promise.resolve({
    getShiftInstancesForDateRange: mockGetShiftInstancesForDateRange,
    getAbsenceInstancesForDateRange: mockGetAbsenceInstancesForDateRange,
  }),
}));

jest.mock('@/modules/calendar/services/CalendarExportNormalize', () => ({
  buildDesiredManagedCalendarEvents: (...args: any[]) => mockBuildDesiredManagedCalendarEvents(...args),
}));

jest.mock('@/modules/calendar/services/IcsFileGenerator', () => ({
  exportEventsToIcs: (...args: any[]) => mockExportEventsToIcs(...args),
}));

describe('CalendarExportScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T12:00:00'));
    jest.clearAllMocks();

    mockGetState.mockResolvedValue({
      enabled: false,
      lastSyncError: null,
    });
    mockGetShiftInstancesForDateRange.mockResolvedValue([]);
    mockGetAbsenceInstancesForDateRange.mockResolvedValue([]);
    mockBuildDesiredManagedCalendarEvents.mockReturnValue([
      {
        appId: 'shift-1',
        entityType: 'shift',
        title: 'Early Shift',
        startDate: new Date('2026-05-01T06:00:00'),
        endDate: new Date('2026-05-01T14:00:00'),
        allDay: false,
      },
    ]);
    mockExportEventsToIcs.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queries one extra day before the preset start date for ICS exports', async () => {
    const { getByTestId } = render(<CalendarExportScreen />);

    fireEvent.press(getByTestId('ics-export-next4weeks'));

    await waitFor(() => {
      expect(mockGetShiftInstancesForDateRange).toHaveBeenCalledWith('2026-04-30', '2026-05-29');
      expect(mockGetAbsenceInstancesForDateRange).toHaveBeenCalledWith('2026-04-30', '2026-05-29');
    });

    expect(mockBuildDesiredManagedCalendarEvents).toHaveBeenCalledWith(expect.objectContaining({
      window: expect.objectContaining({
        queryStartDate: '2026-04-30',
        queryEndDate: '2026-05-29',
      }),
    }));
    expect(mockExportEventsToIcs).toHaveBeenCalledWith(
      expect.any(Array),
      '2026-05-01',
      '2026-05-29',
    );
  });
});
