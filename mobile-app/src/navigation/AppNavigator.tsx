import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarChart3, Calendar, Settings } from 'lucide-react-native';

import { colors, fontSize, fontWeight } from '@/theme';
import { t } from '@/lib/i18n';

// Screens
import SetupScreen from '@/modules/geofencing/screens/SetupScreen';
import StatusScreen from '@/modules/geofencing/screens/StatusScreen';
import CalendarScreen from '@/modules/calendar/screens/CalendarScreen';
import SettingsScreen from '@/modules/geofencing/screens/SettingsScreen';
import TrackingScreen from '@/modules/geofencing/screens/TrackingScreen';
import LogScreen from '@/modules/geofencing/screens/LogScreen';
import LocationsListScreen from '@/modules/geofencing/screens/LocationsListScreen';
import NotificationsScreen from '@/modules/geofencing/screens/NotificationsScreen';
import PermissionsScreen from '@/modules/geofencing/screens/PermissionsScreen';
import DataPrivacyScreen from '@/modules/geofencing/screens/DataPrivacyScreen';

// Auth screens
import EmailVerificationScreen from '@/modules/auth/screens/EmailVerificationScreen';
import RegisterScreen from '@/modules/auth/screens/RegisterScreen';
import LoginScreen from '@/modules/auth/screens/LoginScreen';

import { getDatabase } from '@/modules/geofencing/services/Database';
import { useAuth } from '@/lib/auth/auth-context';

export type RootStackParamList = {
  // Auth stack
  EmailVerification: undefined;
  Register: { email: string };
  Login: { email: string };
  // Main app stack
  MainTabs: undefined;
  Setup: undefined;
  Tracking: { locationId: string };
  Log: { locationId: string };
  LocationsList: undefined;
  Notifications: undefined;
  Permissions: undefined;
  DataPrivacy: undefined;
};

export type MainTabParamList = {
  Status: undefined;
  Calendar: { targetDate?: string } | undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.grey[500],
        tabBarStyle: {
          backgroundColor: colors.background.paper,
          borderTopWidth: 1,
          borderTopColor: colors.border.default,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Status"
        component={StatusScreen}
        options={{
          tabBarLabel: t('navigation.status'),
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size || 24} color={color} />
          ),
          tabBarTestID: 'tab-status',
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarLabel: t('navigation.calendar'),
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size || 24} color={color} />
          ),
          tabBarTestID: 'tab-calendar',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('navigation.settings'),
          tabBarIcon: ({ color, size }) => (
            <Settings size={size || 24} color={color} />
          ),
          tabBarTestID: 'tab-settings',
        }}
      />
    </Tab.Navigator>
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

/**
 * Auth Stack - For unauthenticated users
 */
function AuthStack() {
  const Stack = createNativeStackNavigator<RootStackParamList>();
  const [mode, setMode] = useState<'verify' | 'register' | 'login'>('verify');
  const [email, setEmail] = useState('');

  return (
    <Stack.Navigator
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
      {mode === 'verify' && (
        <Stack.Screen name="EmailVerification" options={{ title: t('navigation.verifyEmail') }}>
          {() => (
            <EmailVerificationScreen
              onVerified={(verifiedEmail) => {
                setEmail(verifiedEmail);
                setMode('register');
              }}
            />
          )}
        </Stack.Screen>
      )}
      {mode === 'register' && (
        <Stack.Screen name="Register" options={{ title: t('navigation.createAccount') }}>
          {() => (
            <RegisterScreen
              email={email}
              onLoginPress={() => setMode('login')}
            />
          )}
        </Stack.Screen>
      )}
      {mode === 'login' && (
        <Stack.Screen name="Login" options={{ title: t('navigation.logIn') }}>
          {() => (
            <LoginScreen
              email={email}
              onRegisterPress={() => setMode('register')}
            />
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { state: authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Just check if auth is loaded, don't wait for location check
    if (authState.status === 'authenticated' || authState.status === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [authState.status]);

  // Show loading while auth state is being restored
  if (authState.status === 'idle' || authState.status === 'loading' || isLoading) {
    return (
      <NavigationContainer>
        <LoadingScreen />
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

  // Show main app if user is authenticated - ALWAYS show tabs
  return (
    <NavigationContainer>
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
          name="Setup"
          component={SetupScreen}
          options={{ title: t('navigation.addLocation') }}
        />
        <Stack.Screen
          name="Tracking"
          component={TrackingScreen}
          options={{ title: t('navigation.workTracking') }}
        />
        <Stack.Screen
          name="Log"
          component={LogScreen}
          options={{ title: t('navigation.workHistory') }}
        />
        <Stack.Screen
          name="LocationsList"
          component={LocationsListScreen}
          options={{ title: t('navigation.workLocations'), headerBackTitle: t('navigation.settings') }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: t('navigation.notifications'), headerBackTitle: t('navigation.settings') }}
        />
        <Stack.Screen
          name="Permissions"
          component={PermissionsScreen}
          options={{ title: t('navigation.permissions'), headerBackTitle: t('navigation.settings') }}
        />
        <Stack.Screen
          name="DataPrivacy"
          component={DataPrivacyScreen}
          options={{ title: t('navigation.dataPrivacy'), headerBackTitle: t('navigation.settings') }}
        />
      </Stack.Navigator>
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
