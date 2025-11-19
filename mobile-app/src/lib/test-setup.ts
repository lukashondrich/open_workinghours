// Mock expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  startGeofencingAsync: jest.fn(),
  stopGeofencingAsync: jest.fn(),
  hasStartedGeofencingAsync: jest.fn(),
  GeofencingEventType: {
    Enter: 1,
    Exit: 2,
  },
}));

jest.mock('expo-sqlite', () => {
  const { createMockDatabase } = require('./test-db-mock');
  return {
    openDatabaseAsync: jest.fn().mockImplementation(() => {
      return Promise.resolve(createMockDatabase());
    }),
  };
});

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));
