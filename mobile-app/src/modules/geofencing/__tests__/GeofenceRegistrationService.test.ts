import { GeofenceRegistrationService } from '../services/GeofenceRegistrationService';
import { getDatabase } from '../services/Database';
import { getGeofenceService } from '../services/GeofenceService';
import type { UserLocation } from '../types';

jest.mock('../services/Database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../services/GeofenceService', () => ({
  getGeofenceService: jest.fn(),
}));

describe('GeofenceRegistrationService', () => {
  const locationA: UserLocation = {
    id: 'loc-a',
    name: 'Hospital A',
    latitude: 52.52,
    longitude: 13.405,
    radiusMeters: 200,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const locationB: UserLocation = {
    id: 'loc-b',
    name: 'Hospital B',
    latitude: 48.137,
    longitude: 11.575,
    radiusMeters: 250,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const geofenceService = {
    hasBackgroundPermissions: jest.fn(),
    stopAll: jest.fn(),
    registerGeofence: jest.fn(),
  };

  const db = {
    getActiveLocations: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGeofenceService as jest.Mock).mockReturnValue(geofenceService);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    geofenceService.hasBackgroundPermissions.mockResolvedValue(true);
    geofenceService.stopAll.mockResolvedValue(undefined);
    geofenceService.registerGeofence.mockResolvedValue(undefined);
    db.getActiveLocations.mockResolvedValue([locationA, locationB]);
  });

  it('skips registration when background permission is missing', async () => {
    geofenceService.hasBackgroundPermissions.mockResolvedValue(false);

    const result = await GeofenceRegistrationService.ensureRegisteredGeofences();

    expect(result).toEqual({
      registeredCount: 0,
      skippedReason: 'background-permission-missing',
    });
    expect(getDatabase).not.toHaveBeenCalled();
    expect(geofenceService.stopAll).not.toHaveBeenCalled();
    expect(geofenceService.registerGeofence).not.toHaveBeenCalled();
  });

  it('clears and registers every active location when permission is granted', async () => {
    const result = await GeofenceRegistrationService.ensureRegisteredGeofences();

    expect(result).toEqual({ registeredCount: 2 });
    expect(db.getActiveLocations).toHaveBeenCalled();
    expect(geofenceService.stopAll).toHaveBeenCalledTimes(1);
    expect(geofenceService.registerGeofence).toHaveBeenNthCalledWith(1, locationA);
    expect(geofenceService.registerGeofence).toHaveBeenNthCalledWith(2, locationB);
  });

  it('continues registering remaining locations after one location fails', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    geofenceService.registerGeofence
      .mockRejectedValueOnce(new Error('register failed'))
      .mockResolvedValueOnce(undefined);

    const result = await GeofenceRegistrationService.ensureRegisteredGeofences();

    expect(result).toEqual({ registeredCount: 1 });
    expect(geofenceService.registerGeofence).toHaveBeenNthCalledWith(1, locationA);
    expect(geofenceService.registerGeofence).toHaveBeenNthCalledWith(2, locationB);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[GeofenceRegistrationService] Failed to register geofence:',
      locationA.name,
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });
});
