import { GeofenceService } from '../services/GeofenceService';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// Mock expo modules
jest.mock('expo-location');
jest.mock('expo-task-manager');

describe('GeofenceService', () => {
  let service: GeofenceService;

  beforeEach(() => {
    service = new GeofenceService();
    jest.clearAllMocks();
  });

  describe('Permission Handling', () => {
    it('should request foreground permissions', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.requestForegroundPermissions();

      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false if foreground permission denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await service.requestForegroundPermissions();

      expect(result).toBe(false);
    });

    it('should request background permissions', async () => {
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.requestBackgroundPermissions();

      expect(result).toBe(true);
    });

    it('should check if has background permissions', async () => {
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.hasBackgroundPermissions();

      expect(result).toBe(true);
    });

    it('should check if has foreground permissions', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.hasForegroundPermissions();

      expect(result).toBe(true);
    });
  });

  describe('Geofence Registration', () => {
    const testLocation = {
      id: 'loc-123',
      name: 'Test Hospital',
      latitude: 37.7625,
      longitude: -122.4577,
      radiusMeters: 200,
      isActive: true,
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
    };

    beforeEach(() => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(false);
    });

    it('should register a geofence', async () => {
      await service.registerGeofence(testLocation);

      expect(Location.startGeofencingAsync).toHaveBeenCalledWith(
        'GEOFENCE_TASK',
        [
          {
            identifier: 'loc-123',
            latitude: 37.7625,
            longitude: -122.4577,
            radius: 200,
            notifyOnEnter: true,
            notifyOnExit: true,
          },
        ]
      );
    });

    it('should add to existing geofences if already started', async () => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(true);

      await service.registerGeofence(testLocation);

      expect(Location.stopGeofencingAsync).toHaveBeenCalledWith('GEOFENCE_TASK');
      expect(Location.startGeofencingAsync).toHaveBeenCalled();
    });

    it('should unregister a geofence', async () => {
      // Register first
      await service.registerGeofence(testLocation);

      // Clear mocks
      jest.clearAllMocks();
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(true);

      // Then unregister
      await service.unregisterGeofence('loc-123');

      // Should stop geofencing
      expect(Location.stopGeofencingAsync).toHaveBeenCalled();
    });

    it('should get all registered geofences', async () => {
      await service.registerGeofence(testLocation);

      const geofences = service.getRegisteredGeofences();

      expect(geofences).toHaveLength(1);
      expect(geofences[0].identifier).toBe('loc-123');
    });

    it('should stop all geofencing', async () => {
      await service.registerGeofence(testLocation);

      await service.stopAll();

      expect(Location.stopGeofencingAsync).toHaveBeenCalledWith('GEOFENCE_TASK');
      expect(service.getRegisteredGeofences()).toHaveLength(0);
    });
  });

  describe('Geofence Status', () => {
    it('should check if geofencing is active', async () => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(true);

      const isActive = await service.isGeofencingActive();

      expect(isActive).toBe(true);
    });
  });

  describe('Task Definition', () => {
    it('should define background task', () => {
      const mockCallback = jest.fn();

      service.defineBackgroundTask(mockCallback);

      expect(TaskManager.defineTask).toHaveBeenCalledWith(
        'GEOFENCE_TASK',
        expect.any(Function)
      );
    });

    it('should handle task callback for enter event', async () => {
      let taskHandler: any;
      (TaskManager.defineTask as jest.Mock).mockImplementation((name, handler) => {
        taskHandler = handler;
      });

      const mockCallback = jest.fn();
      service.defineBackgroundTask(mockCallback);

      // Simulate geofence enter event
      const eventData = {
        eventType: Location.GeofencingEventType.Enter,
        region: {
          identifier: 'loc-123',
          latitude: 37.7625,
          longitude: -122.4577,
          radius: 200,
        },
      };

      await taskHandler({ data: eventData, error: null });

      expect(mockCallback).toHaveBeenCalledWith({
        eventType: 'enter',
        locationId: 'loc-123',
        timestamp: expect.any(String),
        latitude: 37.7625,
        longitude: -122.4577,
      });
    });

    it('should handle task callback for exit event', async () => {
      let taskHandler: any;
      (TaskManager.defineTask as jest.Mock).mockImplementation((name, handler) => {
        taskHandler = handler;
      });

      const mockCallback = jest.fn();
      service.defineBackgroundTask(mockCallback);

      // Simulate geofence exit event
      const eventData = {
        eventType: Location.GeofencingEventType.Exit,
        region: {
          identifier: 'loc-123',
          latitude: 37.7625,
          longitude: -122.4577,
          radius: 200,
        },
      };

      await taskHandler({ data: eventData, error: null });

      expect(mockCallback).toHaveBeenCalledWith({
        eventType: 'exit',
        locationId: 'loc-123',
        timestamp: expect.any(String),
        latitude: 37.7625,
        longitude: -122.4577,
      });
    });

    it('should handle task error', async () => {
      let taskHandler: any;
      (TaskManager.defineTask as jest.Mock).mockImplementation((name, handler) => {
        taskHandler = handler;
      });

      const mockCallback = jest.fn();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      service.defineBackgroundTask(mockCallback);

      await taskHandler({ data: null, error: new Error('Test error') });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
