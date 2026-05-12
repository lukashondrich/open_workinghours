import { getDatabase } from './Database';
import { getGeofenceService } from './GeofenceService';

export interface GeofenceRegistrationResult {
  registeredCount: number;
  skippedReason?: 'background-permission-missing';
}

export class GeofenceRegistrationService {
  static async ensureRegisteredGeofences(): Promise<GeofenceRegistrationResult> {
    const geofenceService = getGeofenceService();
    const hasBackgroundPermission = await geofenceService.hasBackgroundPermissions();

    if (!hasBackgroundPermission) {
      return {
        registeredCount: 0,
        skippedReason: 'background-permission-missing',
      };
    }

    const db = await getDatabase();
    const locations = await db.getActiveLocations();

    await geofenceService.stopAll();

    let registeredCount = 0;
    for (const location of locations) {
      try {
        await geofenceService.registerGeofence(location);
        registeredCount += 1;
      } catch (error) {
        console.warn('[GeofenceRegistrationService] Failed to register geofence:', location.name, error);
      }
    }

    return { registeredCount };
  }
}
