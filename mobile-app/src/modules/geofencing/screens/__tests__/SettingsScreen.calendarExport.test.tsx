import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import SettingsScreen from '../SettingsScreen';

const mockSignOut = jest.fn();
const mockGetState = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/lib/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const ReactLocal = require('react');
    const { View: NativeView } = require('react-native');
    return ReactLocal.createElement(NativeView, null, children);
  },
}));

jest.mock('lucide-react-native', () => {
  const ReactLocal = require('react');
  const { View: NativeView } = require('react-native');
  const Icon = () => ReactLocal.createElement(NativeView);
  return {
    MapPin: Icon,
    Bell: Icon,
    Calendar: Icon,
    Lock: Icon,
    Trash2: Icon,
    Bug: Icon,
    LogOut: Icon,
    Database: Icon,
    FileText: Icon,
    Shield: Icon,
    Fingerprint: Icon,
  };
});

jest.mock('@/components/ui', () => ({
  Button: ({ children, onPress, testID }: any) => {
    const ReactLocal = require('react');
    const { Pressable: NativePressable, Text: NativeText } = require('react-native');
    return ReactLocal.createElement(
      NativePressable,
      { onPress, testID },
      ReactLocal.createElement(NativeText, null, children),
    );
  },
  ListItem: ({ title }: any) => {
    const ReactLocal = require('react');
    const { Text: NativeText } = require('react-native');
    return ReactLocal.createElement(NativeText, null, title);
  },
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    state: {
      user: {
        email: 'test@example.com',
      },
    },
  }),
}));

jest.mock('@/lib/auth/BiometricService', () => ({
  BiometricService: {
    isAvailable: jest.fn().mockResolvedValue(false),
    isEnrolled: jest.fn().mockResolvedValue(false),
    isEnabled: jest.fn().mockResolvedValue(false),
    getBiometricType: jest.fn().mockResolvedValue('Biometrics'),
    authenticate: jest.fn().mockResolvedValue(true),
    setEnabled: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/utils/reportIssue', () => ({
  reportIssue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/legalUrls', () => ({
  openTermsUrl: jest.fn(),
  openPrivacyUrl: jest.fn(),
}));

jest.mock('@/test-utils/seedDashboardData', () => ({
  seedDashboardTestData: jest.fn(),
  clearDashboardTestData: jest.fn(),
}));

jest.mock('@/modules/calendar/services/CalendarExportManager', () => ({
  getCalendarExportManager: () => Promise.resolve({
    getState: mockGetState,
    deleteExportedCalendarData: jest.fn(),
    markDisabledKeepingEvents: jest.fn(),
  }),
}));

describe('SettingsScreen calendar export sign-out flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockResolvedValue({
      enabled: true,
      lastSyncError: null,
    });
  });

  it('checks calendar export state at sign-out time before deciding which dialog to show', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<SettingsScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(screen.getByTestId('sign-out-button'));

    const initialButtons = alertSpy.mock.calls[0]?.[2] as Array<{ onPress?: () => Promise<void> | void }>;
    await initialButtons[1]?.onPress?.();

    expect(mockGetState).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenNthCalledWith(
      2,
      'settings.signOutCalendarTitle',
      'settings.signOutCalendarMessage',
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });
});
