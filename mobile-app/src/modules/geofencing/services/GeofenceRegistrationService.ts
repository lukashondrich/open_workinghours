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

    // Android fires an INITIAL-TRIGGER enter/exit for every fence right after
    // registration (expo-location sets INITIAL_TRIGGER_ENTER | EXIT). The Android
    // tracking core reads this timestamp to treat those callbacks as a fix, not
    // as a transition (TrackingManagerAndroid rule 6/7).
    if (registeredCount > 0) {
      try {
        await db.setPreference('geofences_registered_at', new Date().toISOString());
      } catch (error) {
        console.warn('[GeofenceRegistrationService] Failed to record registration time:', error);
      }
    }

    return { registeredCount };
  }
}
