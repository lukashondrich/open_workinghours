import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { UserLocation } from '../types';
import { GEOFENCE_TASK_NAME } from '../constants';

export interface GeofenceEventData {
  eventType: 'enter' | 'exit';
  locationId: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
}

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

        const event: GeofenceEventData = {
          eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
          locationId: region.identifier,
          timestamp: new Date().toISOString(),
          latitude: region.latitude,
          longitude: region.longitude,
        };

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
