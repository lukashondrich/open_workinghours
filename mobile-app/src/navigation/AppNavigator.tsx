import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

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

import { getDatabase } from '@/modules/geofencing/services/Database';

export type RootStackParamList = {
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
  Calendar: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Status"
        component={StatusScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📊</Text>,
          tabBarTestID: 'tab-status',
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📅</Text>,
          tabBarTestID: 'tab-calendar',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>⚙️</Text>,
          tabBarTestID: 'tab-settings',
        }}
      />
    </Tab.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocations, setHasLocations] = useState(false);

  useEffect(() => {
    async function checkForLocations() {
      try {
        const db = await getDatabase();
        const locations = await db.getActiveLocations();
        setHasLocations(locations.length > 0);
      } catch (error) {
        console.error('[AppNavigator] Failed to check for locations:', error);
      } finally {
        setIsLoading(false);
      }
    }
    checkForLocations();
  }, []);

  if (isLoading) {
    return (
      <NavigationContainer>
        <LoadingScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={hasLocations ? 'MainTabs' : 'Setup'}
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#007AFF',
          headerTitleStyle: {
            fontWeight: '600',
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
          options={{ title: 'Add Location' }}
        />
        <Stack.Screen
          name="Tracking"
          component={TrackingScreen}
          options={{ title: 'Work Tracking' }}
        />
        <Stack.Screen
          name="Log"
          component={LogScreen}
          options={{ title: 'Work History' }}
        />
        <Stack.Screen
          name="LocationsList"
          component={LocationsListScreen}
          options={{ title: 'Work Locations', headerBackTitle: 'Settings' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notifications', headerBackTitle: 'Settings' }}
        />
        <Stack.Screen
          name="Permissions"
          component={PermissionsScreen}
          options={{ title: 'Permissions', headerBackTitle: 'Settings' }}
        />
        <Stack.Screen
          name="DataPrivacy"
          component={DataPrivacyScreen}
          options={{ title: 'Data & Privacy', headerBackTitle: 'Settings' }}
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
