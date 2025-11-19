import { GeofenceConfig } from './types';

export const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

export const GEOFENCE_CONFIG: GeofenceConfig = {
  minRadius: 100,         // Minimum 100 meters
  maxRadius: 1000,        // Maximum 1 kilometer
  defaultRadius: 200,     // Default 200 meters
  notifyOnEnter: true,
  notifyOnExit: true,
};

export const DATABASE_NAME = 'workinghours.db';
