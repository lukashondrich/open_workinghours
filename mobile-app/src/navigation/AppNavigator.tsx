import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  AppState,
  TouchableOpacity,
  Keyboard,
  Alert,
  type AppStateStatus,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, Calendar, ChevronLeft, FileText } from 'lucide-react-native';

import { SettingsDetailLayout } from '@/components/ui';
import { colors, fontSize, fontWeight } from '@/theme';
import { t } from '@/lib/i18n';

// Screens
import SetupScreen from '@/modules/geofencing/screens/SetupScreen';
import StatusScreen from '@/modules/geofencing/screens/StatusScreen';
import CalendarScreen from '@/modules/calendar/screens/CalendarScreen';
import { CalendarExportOrchestrator } from '@/modules/calendar/services/CalendarExportOrchestrator';
import SettingsScreen from '@/modules/geofencing/screens/SettingsScreen';
import ReportsScreen from '@/modules/reports/screens/ReportsScreen';
import TrackingScreen from '@/modules/geofencing/screens/TrackingScreen';
import LogScreen from '@/modules/geofencing/screens/LogScreen';
import LocationsListScreen from '@/modules/geofencing/screens/LocationsListScreen';
import NotificationsScreen from '@/modules/geofencing/screens/NotificationsScreen';
import PermissionsScreen from '@/modules/geofencing/screens/PermissionsScreen';
import DataPrivacyScreen from '@/modules/geofencing/screens/DataPrivacyScreen';
import CalendarExportScreen from '@/modules/calendar/screens/CalendarExportScreen';

// Auth screens
import WelcomeScreen from '@/modules/auth/screens/WelcomeScreen';
import EmailVerificationScreen from '@/modules/auth/screens/EmailVerificationScreen';
import RegisterScreen from '@/modules/auth/screens/RegisterScreen';
import LoginScreen from '@/modules/auth/screens/LoginScreen';
import LockScreen from '@/modules/auth/screens/LockScreen';
import SocialRegistrationScreen from '@/modules/auth/screens/SocialRegistrationScreen';
import ProfileScreen from '@/modules/auth/screens/ProfileScreen';
import { ConsentBottomSheet } from '@/modules/auth/components/ConsentBottomSheet';

import { useAuth } from '@/lib/auth/auth-context';
import { userNeedsConsentUpdate } from '@/lib/auth/consent-types';
import { AuthService } from '@/modules/auth/services/AuthService';
import { WeekFinalizationService } from '@/modules/reports/services/WeekFinalizationService';
import { WeekStateService } from '@/modules/reports/services/WeekStateService';
import { SundayNotificationService } from '@/modules/reports/services/SundayNotificationService';

export type RootStackParamList = {
  // Auth stack
  Welcome: undefined;
  EmailVerification: undefined;
  Register: { email: string };
  SocialRegister: undefined;
  Login: { email: string };
  // Main app stack
  MainTabs: undefined;
  Settings: undefined;
  Setup: {
    editLocation?: { id: string; name: string; latitude: number; longitude: number; radiusMeters: number };
    viewOnly?: boolean; // Show location details without editing
  } | undefined;
  Tracking: { locationId: string };
  Log: { locationId: string };
  LocationsList: undefined;
  Notifications: undefined;
  Permissions: undefined;
  DataPrivacy: undefined;
  CalendarExport: undefined;
  Profile: undefined;
};

export type MainTabParamList = {
  Status: undefined;
  Calendar: { targetDate?: string } | undefined;
  Reports: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Android 15+ enforces edge-to-edge: app draws behind system nav bar.
  // Use safe area insets (adapts to 3-button, gesture, or no nav bar).
  // Fallback to 48dp if insets report 0 (some Android versions/configurations).
  // Disable the fallback while the keyboard is visible so it cannot lift the tabs above the keyboard.
  const androidBottomPadding = Platform.OS === 'android' && !keyboardVisible
    ? Math.max(insets.bottom, 48)
    : 0;

  return (
    <View style={{
      flex: 1,
      backgroundColor: androidBottomPadding > 0 ? colors.background.paper : undefined,
      paddingBottom: androidBottomPadding,
    }}>
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.grey[500],
        tabBarAllowFontScaling: false,
        tabBarHideOnKeyboard: Platform.OS === 'android',
        tabBarStyle: {
          backgroundColor: colors.background.paper,
          ...(Platform.OS === 'android'
            ? {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border.default,
                elevation: 0,
              }
            : {
                borderTopWidth: 1,
                borderTopColor: colors.border.default,
              }),
        },
        tabBarItemStyle: {
          paddingTop: Platform.OS === 'android' ? 12 : 8,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Status"
        component={StatusScreen}
        options={{
          tabBarLabel: t('navigation.status'),
          tabBarAccessibilityLabel: 'Status',
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size || 24} color={color} />
          ),
          tabBarButtonTestID: 'tab-status',
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarLabel: t('navigation.calendar'),
          tabBarAccessibilityLabel: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size || 24} color={color} />
          ),
          tabBarButtonTestID: 'tab-calendar',
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: t('navigation.reports'),
          tabBarAccessibilityLabel: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <FileText size={size || 24} color={color} />
          ),
          tabBarButtonTestID: 'tab-reports',
        }}
      />
    </Tab.Navigator>
    </View>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary[500]} />
      <Text style={styles.loadingText}>{t('common.loading')}</Text>
    </View>
  );
}

interface AuthDetailScreenProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}

function AuthDetailScreen({ title, onBack, children }: AuthDetailScreenProps) {
  if (Platform.OS !== 'android') {
    return <>{children}</>;
  }

  return (
    <SettingsDetailLayout title={title} onBack={onBack}>
      {children}
    </SettingsDetailLayout>
  );
}

/**
 * Auth Stack - For unauthenticated users
 *
 * Flow:
 * - WelcomeScreen: Entry point with "Log In" / "Create Account" choice
 * - "Log In" → LoginScreen (single code flow for returning users)
 * - "Create Account" → EmailVerificationScreen → RegisterScreen (new users)
 */
function AuthStack() {
  const Stack = createNativeStackNavigator<RootStackParamList>();
  const [mode, setMode] = useState<'welcome' | 'verify' | 'register' | 'login' | 'socialRegister'>('welcome');
  const [email, setEmail] = useState('');
  const [socialRegistrationToken, setSocialRegistrationToken] = useState('');

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: Platform.OS !== 'android',
        headerStyle: {
          backgroundColor: colors.background.paper,
        },
        headerTintColor: colors.primary[500],
        headerTitleStyle: {
          fontWeight: fontWeight.semibold,
        },
      }}
    >
      {mode === 'welcome' && (
        <Stack.Screen name="Welcome" options={{ headerShown: false }}>
          {() => (
            <WelcomeScreen
              onLoginPress={() => setMode('login')}
              onRegisterPress={() => setMode('verify')}
              onSocialRegistrationRequired={(token) => {
                setSocialRegistrationToken(token);
                setMode('socialRegister');
              }}
            />
          )}
        </Stack.Screen>
      )}
      {mode === 'verify' && (
        <Stack.Screen name="EmailVerification" options={{
          title: t('navigation.verifyEmail'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => setMode('welcome')} hitSlop={8}>
              <ChevronLeft size={24} color={colors.primary[500]} />
            </TouchableOpacity>
          ),
        }}>
          {() => (
            <AuthDetailScreen
              title={t('navigation.verifyEmail')}
              onBack={() => setMode('welcome')}
            >
              <EmailVerificationScreen
                onVerified={(verifiedEmail) => {
                  setEmail(verifiedEmail);
                  setMode('register');
                }}
              />
            </AuthDetailScreen>
          )}
        </Stack.Screen>
      )}
      {mode === 'register' && (
        <Stack.Screen name="Register" options={{
          title: t('navigation.createAccount'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => setMode('welcome')} hitSlop={8}>
              <ChevronLeft size={24} color={colors.primary[500]} />
            </TouchableOpacity>
          ),
        }}>
          {() => (
            <AuthDetailScreen
              title={t('navigation.createAccount')}
              onBack={() => setMode('welcome')}
            >
              <RegisterScreen
                email={email}
                onLoginPress={() => setMode('login')}
              />
            </AuthDetailScreen>
          )}
        </Stack.Screen>
      )}
      {mode === 'socialRegister' && (
        <Stack.Screen name="SocialRegister" options={{
          title: t('navigation.completeSetup') || 'Complete Setup',
          headerLeft: () => (
            <TouchableOpacity onPress={() => setMode('welcome')} hitSlop={8}>
              <ChevronLeft size={24} color={colors.primary[500]} />
            </TouchableOpacity>
          ),
        }}>
          {() => (
            <AuthDetailScreen
              title={t('navigation.completeSetup') || 'Complete Setup'}
              onBack={() => setMode('welcome')}
            >
              <SocialRegistrationScreen
                socialRegistrationToken={socialRegistrationToken}
              />
            </AuthDetailScreen>
          )}
        </Stack.Screen>
      )}
      {mode === 'login' && (
        <Stack.Screen name="Login" options={{
          title: t('navigation.logIn'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => setMode('welcome')} hitSlop={8}>
              <ChevronLeft size={24} color={colors.primary[500]} />
            </TouchableOpacity>
          ),
        }}>
          {() => (
            <AuthDetailScreen
              title={t('navigation.logIn')}
              onBack={() => setMode('welcome')}
            >
              <LoginScreen
                email={email}
                onRegisterPress={() => setMode('verify')}
              />
            </AuthDetailScreen>
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

// Must stay well below the server token lifetime (SECURITY__TOKEN_EXP_HOURS,
// 90 days): if the server ever issues tokens shorter than this threshold,
// every refresh immediately re-qualifies and the app would re-refresh on each
// foreground until rate-limited.
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export default function AppNavigator() {
  const { state: authState, unlock, signIn, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const finalizationInFlightRef = useRef(false);
  const requiresConsentUpdate = authState.status === 'authenticated' && userNeedsConsentUpdate(authState.user);

  // Sliding session renewal: swap the token for a fresh full-lifetime one when
  // less than 7 days remain, so an active user's token never expires. Failure
  // is non-fatal — the current token is still valid until its original expiry.
  const maybeRefreshToken = useCallback(async () => {
    if (authState.status !== 'authenticated' || !authState.token || !authState.expiresAt || !authState.user) {
      return;
    }
    const msLeft = authState.expiresAt.getTime() - Date.now();
    if (msLeft <= 0 || msLeft > REFRESH_THRESHOLD_MS) {
      return;
    }
    try {
      const { token, expiresAt } = await AuthService.refreshToken(authState.token);
      await signIn(authState.user, token, expiresAt);
    } catch (error) {
      console.error('[AppNavigator] Token refresh failed (keeping current token):', error);
    }
  }, [authState.status, authState.token, authState.expiresAt, authState.user, signIn]);

  const runQueuedFinalization = useCallback(async () => {
    if (finalizationInFlightRef.current) {
      return;
    }

    finalizationInFlightRef.current = true;
    try {
      // Renew the token first so queued sends never go out with one that is
      // about to (or did) expire.
      await maybeRefreshToken();
      // Reconcile auto-send queue first (may queue current week on Sunday evening)
      const autoSend = await WeekStateService.getAutoSend();
      if (autoSend) {
        await WeekStateService.reconcileAutoSendQueue();
      }
      // Then send eligible queued weeks
      await WeekFinalizationService.sendEligibleQueuedWeeks();
      // Reschedule Sunday notifications
      await SundayNotificationService.scheduleWeeklyNotifications();
    } catch (error) {
      console.error('[AppNavigator] Failed to finalize queued weeks:', error);
    } finally {
      finalizationInFlightRef.current = false;
    }
  }, [maybeRefreshToken]);

  const handleConsentUpdateAccepted = useCallback(async () => {
    if (authState.status !== 'authenticated' || !authState.token || !authState.expiresAt) {
      return;
    }

    try {
      setIsUpdatingConsent(true);
      const updatedUser = await AuthService.updateConsent(authState.token, authState.user?.email);
      await signIn(updatedUser, authState.token, authState.expiresAt);
    } catch (error) {
      console.error('[AppNavigator] Failed to update consent:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('consent.updateFailed')
      );
    } finally {
      setIsUpdatingConsent(false);
    }
  }, [
    authState.status,
    authState.token,
    authState.expiresAt,
    authState.user?.email,
    signIn,
  ]);

  useEffect(() => {
    // Just check if auth is loaded, don't wait for location check
    if (authState.status === 'authenticated' || authState.status === 'unauthenticated' || authState.status === 'locked') {
      setIsLoading(false);
    }
  }, [authState.status]);

  useEffect(() => {
    if (authState.status !== 'authenticated' || requiresConsentUpdate) {
      return;
    }
    void runQueuedFinalization();
  }, [authState.status, requiresConsentUpdate, runQueuedFinalization]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/background|inactive/) &&
        nextState === 'active' &&
        authState.status === 'authenticated' &&
        !requiresConsentUpdate
      ) {
        void runQueuedFinalization();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [authState.status, requiresConsentUpdate, runQueuedFinalization]);

  // Show loading while auth state is being restored
  if (authState.status === 'idle' || authState.status === 'loading' || isLoading) {
    return (
      <NavigationContainer>
        <LoadingScreen />
      </NavigationContainer>
    );
  }

  // Show Lock Screen if user has biometric enabled and needs to unlock
  if (authState.status === 'locked') {
    return (
      <NavigationContainer>
        <LockScreen
          onUnlock={unlock}
          onSignInWithEmail={signOut}
        />
      </NavigationContainer>
    );
  }

  // Show auth stack if user is not authenticated
  if (authState.status === 'unauthenticated') {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  if (requiresConsentUpdate) {
    return (
      <NavigationContainer>
        <>
          <LoadingScreen />
          <ConsentBottomSheet
            visible
            onAccept={handleConsentUpdateAccepted}
            onCancel={signOut}
            mode="update"
            loading={isUpdatingConsent}
          />
        </>
      </NavigationContainer>
    );
  }

  // Show main app if user is authenticated - ALWAYS show tabs
  return (
    <NavigationContainer>
      <>
        <CalendarExportOrchestrator />
        <Stack.Navigator
          initialRouteName="MainTabs"
          screenOptions={{
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background.paper,
            },
            headerTintColor: colors.primary[500],
            headerTitleStyle: {
              fontWeight: fontWeight.semibold,
            },
          }}
        >
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.settings'), headerBackTitle: t('navigation.back') }}
          />
          <Stack.Screen
            name="Setup"
            component={SetupScreen}
            options={{ title: t('navigation.addLocation') }}
          />
          <Stack.Screen
            name="Tracking"
            component={TrackingScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.workTracking'), headerBackTitle: t('navigation.back') }}
          />
          <Stack.Screen
            name="Log"
            component={LogScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.workHistory') }}
          />
          <Stack.Screen
            name="LocationsList"
            component={LocationsListScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.workLocations'), headerBackTitle: t('navigation.settings') }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.notifications'), headerBackTitle: t('navigation.settings') }}
          />
          <Stack.Screen
            name="Permissions"
            component={PermissionsScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.permissions'), headerBackTitle: t('navigation.settings') }}
          />
          <Stack.Screen
            name="DataPrivacy"
            component={DataPrivacyScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.dataPrivacy'), headerBackTitle: t('navigation.settings') }}
          />
          <Stack.Screen
            name="CalendarExport"
            component={CalendarExportScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('settings.calendarExport'), headerBackTitle: t('navigation.settings') }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={Platform.OS === 'android'
              ? { headerShown: false }
              : { title: t('navigation.profile'), headerBackTitle: t('navigation.settings') }}
          />
        </Stack.Navigator>
      </>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
  },
  loadingText: {
    marginTop: 16,
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
});
