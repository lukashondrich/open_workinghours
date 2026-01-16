import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { UserLocation, GeofenceEventData } from '../types';
import { GEOFENCE_TASK_NAME } from '../constants';

export type GeofenceCallback = (event: GeofenceEventData) => void;

export class GeofenceService {
  private registeredGeofences: Map<string, Location.LocationRegion> = new Map();

  /**
   * Request foreground location permissions
   */
  async requestForegroundPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Request background location permissions (required for geofencing)
   */
  async requestBackgroundPermissions(): Promise<boolean> {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Check if app has background permissions
   */
  async hasBackgroundPermissions(): Promise<boolean> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Check if app has foreground permissions
   */
  async hasForegroundPermissions(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Register a geofence for a user location
   */
  async registerGeofence(location: UserLocation): Promise<void> {
    // Check if background permission is granted
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[GeofenceService] Background permission not granted, skipping geofence registration');
      return;
    }

    const region: Location.LocationRegion = {
      identifier: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radiusMeters,
      notifyOnEnter: true,
      notifyOnExit: true,
    };

    this.registeredGeofences.set(location.id, region);

    // If geofencing already started, need to restart with updated list
    const isActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (isActive) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }

    // Start with all registered geofences
    await Location.startGeofencingAsync(
      GEOFENCE_TASK_NAME,
      Array.from(this.registeredGeofences.values())
    );
  }

  /**
   * Unregister a geofence
   */
  async unregisterGeofence(locationId: string): Promise<void> {
    this.registeredGeofences.delete(locationId);

    // Restart with remaining geofences
    const isActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (isActive) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }

    if (this.registeredGeofences.size > 0) {
      await Location.startGeofencingAsync(
        GEOFENCE_TASK_NAME,
        Array.from(this.registeredGeofences.values())
      );
    }
  }

  /**
   * Stop all geofencing
   */
  async stopAll(): Promise<void> {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    this.registeredGeofences.clear();
  }

  /**
   * Check if geofencing is currently active
   */
  async isGeofencingActive(): Promise<boolean> {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  }

  /**
   * Get list of registered geofences
   */
  getRegisteredGeofences(): Location.LocationRegion[] {
    return Array.from(this.registeredGeofences.values());
  }

  /**
   * Define the background task that handles geofence events
   * This should be called once at app startup
   */
  defineBackgroundTask(callback: GeofenceCallback): void {
    TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('[GeofenceService] Task error:', error);
        return;
      }

      if (data) {
        const { eventType, region } = data as {
          eventType: Location.GeofencingEventType;
          region: Location.LocationRegion;
        };

        // Extract location data with accuracy if available
        // expo-location may include a location object with the current GPS reading
        const locationData = (data as any).location as Location.LocationObject | undefined;

        const event: GeofenceEventData = {
          eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
          locationId: region.identifier ?? '',
          timestamp: new Date().toISOString(),
          latitude: locationData?.coords?.latitude ?? region.latitude,
          longitude: locationData?.coords?.longitude ?? region.longitude,
          accuracy: locationData?.coords?.accuracy ?? undefined,
        };

        console.log(`[GeofenceService] Geofence ${event.eventType} event for ${event.locationId}, accuracy: ${event.accuracy ?? 'unknown'}m`);

        callback(event);
      }
    });
  }
}

// Singleton instance
let serviceInstance: GeofenceService | null = null;

export function getGeofenceService(): GeofenceService {
  if (!serviceInstance) {
    serviceInstance = new GeofenceService();
  }
  return serviceInstance;
}
