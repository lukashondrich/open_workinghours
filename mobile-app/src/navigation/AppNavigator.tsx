import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SetupScreen from '@/modules/geofencing/screens/SetupScreen';
import TrackingScreen from '@/modules/geofencing/screens/TrackingScreen';
import LogScreen from '@/modules/geofencing/screens/LogScreen';

export type RootStackParamList = {
  Setup: undefined;
  Tracking: { locationId: string };
  Log: { locationId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Setup"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Setup"
          component={SetupScreen}
          options={{ title: 'Setup Geofence' }}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
