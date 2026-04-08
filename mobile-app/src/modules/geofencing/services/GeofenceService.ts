import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { UserLocation, GeofenceEventData, AccuracySource } from '../types';
import { GEOFENCE_TASK_NAME } from '../constants';
import { getDatabase } from './Database';

export type GeofenceCallback = (event: GeofenceEventData) => void;

export class GeofenceService {
  private registeredGeofences: Map<string, Location.LocationRegion> = new Map();

  private createRegion(location: UserLocation): Location.LocationRegion | null {
    const { id, latitude, longitude, radiusMeters } = location;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(radiusMeters) ||
      radiusMeters <= 0
    ) {
      console.warn('[GeofenceService] Skipping invalid geofence region:', {
        id,
        latitude,
        longitude,
        radiusMeters,
      });
      return null;
    }

    return {
      identifier: id,
      latitude,
      longitude,
      radius: radiusMeters,
      notifyOnEnter: true,
      notifyOnExit: true,
    };
  }

  private async syncRegisteredGeofencesFromDatabase(): Promise<void> {
    const db = await getDatabase();
    const locations = await db.getActiveLocations();
    const regions = new Map<string, Location.LocationRegion>();

    for (const location of locations) {
      const region = this.createRegion(location);
      if (region) {
        regions.set(location.id, region);
      }
    }

    this.registeredGeofences = regions;
  }

  private async restartGeofencing(): Promise<void> {
    const isActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (isActive) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }

    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[GeofenceService] Background permission not granted, skipping geofence restart');
      return;
    }

    const regions = Array.from(this.registeredGeofences.values());
    if (regions.length === 0) {
      return;
    }

    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  }

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
    const region = this.createRegion(location);
    if (!region) {
      return;
    }

    this.registeredGeofences.set(location.id, region);
    await this.restartGeofencing();
  }

  /**
   * Unregister a geofence
   */
  async unregisterGeofence(locationId: string): Promise<void> {
    await this.syncRegisteredGeofencesFromDatabase();
    this.registeredGeofences.delete(locationId);
    await this.restartGeofencing();
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

        // Active GPS fetch if no location data came with the event
        // This is common because geofencing APIs are battery-optimized and
        // often fire without a fresh GPS reading
        let gpsReading = locationData;
        let accuracySource: AccuracySource = locationData ? 'event' : null;

        if (!gpsReading) {
          try {
            gpsReading = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            accuracySource = 'active_fetch';
            console.log(`[GeofenceService] Active GPS fetch: accuracy=${gpsReading.coords.accuracy}m`);
          } catch (fetchError) {
            console.warn('[GeofenceService] Active GPS fetch failed:', fetchError);
          }
        }

        const event: GeofenceEventData = {
          eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
          locationId: region.identifier ?? '',
          timestamp: new Date().toISOString(),
          latitude: gpsReading?.coords?.latitude ?? region.latitude,
          longitude: gpsReading?.coords?.longitude ?? region.longitude,
          accuracy: gpsReading?.coords?.accuracy ?? undefined,
          accuracySource,
        };

        console.log(`[GeofenceService] Geofence ${event.eventType} event for ${event.locationId}, accuracy: ${event.accuracy ?? 'unknown'}m (${accuracySource ?? 'none'})`);

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
