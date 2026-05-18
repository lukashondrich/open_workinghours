import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useCalendar } from '@/lib/calendar/calendar-context';
import { formatDateKey } from '@/lib/calendar/calendar-utils';
import InlinePicker from '../InlinePicker';

jest.mock('@/lib/calendar/calendar-context', () => ({
  useCalendar: jest.fn(),
}));

jest.mock('@/lib/i18n', () => ({
  t: (key: string, values?: Record<string, string>) => values?.date ? `${key}:${values.date}` : key,
  getDateLocale: () => 'en',
}));

jest.mock('lucide-react-native', () => {
  const ReactLocal = require('react');
  const { View: NativeView } = require('react-native');
  const Icon = () => ReactLocal.createElement(NativeView);
  return {
    TreePalm: Icon,
    Thermometer: Icon,
    Clock: Icon,
    Plus: Icon,
    Pencil: Icon,
  };
});

jest.mock('@/lib/calendar/calendar-utils', () => ({
  formatDuration: jest.fn((minutes: number) => `${minutes}m`),
  formatDateKey: jest.fn(() => '2026-05-16'),
  getColorPalette: jest.fn(() => ({
    bg: '#E6F5F1',
    border: '#96D6C8',
    text: '#134532',
    dot: '#2E8B6B',
  })),
  findOverlappingShift: jest.fn(() => null),
}));

const mockUseCalendar = useCalendar as jest.MockedFunction<typeof useCalendar>;
const mockFormatDateKey = formatDateKey as jest.MockedFunction<typeof formatDateKey>;

function mockCalendarState(dispatch = jest.fn()) {
  mockUseCalendar.mockReturnValue({
    state: {
      inlinePickerTab: 'shifts',
      templates: {},
      absenceTemplates: {},
      instances: {},
      lastUsedTemplateId: null,
      lastUsedAbsenceTemplateId: null,
    } as any,
    dispatch,
  });
  return dispatch;
}

describe('InlinePicker notes tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens notes for the targeted day when a target date is provided', () => {
    const dispatch = mockCalendarState();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <InlinePicker visible targetDate="2026-05-20" onClose={onClose} />
    );

    fireEvent.press(getByTestId('inline-picker-tab-notes'));

    expect(mockFormatDateKey).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'OPEN_NOTE_EDITOR', date: '2026-05-20' });
  });

  it('opens notes for the local current day when no target date is provided', () => {
    const dispatch = mockCalendarState();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <InlinePicker visible targetDate={null} onClose={onClose} />
    );

    fireEvent.press(getByTestId('inline-picker-tab-notes'));

    expect(mockFormatDateKey).toHaveBeenCalledWith(expect.any(Date));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'OPEN_NOTE_EDITOR', date: '2026-05-16' });
  });
});
