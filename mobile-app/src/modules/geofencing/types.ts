// Core domain types for geofencing module

export interface UserLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingSession {
  id: string;
  locationId: string;
  clockIn: string;              // ISO8601
  clockOut: string | null;
  durationMinutes: number | null;
  trackingMethod: 'geofence_auto' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceEvent {
  id: string;
  locationId: string;
  eventType: 'enter' | 'exit';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface GeofenceConfig {
  minRadius: number;            // 100m
  maxRadius: number;            // 1000m
  defaultRadius: number;        // 200m
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

export interface DailyActual {
  id: string;
  date: string; // YYYY-MM-DD
  plannedMinutes: number;
  actualMinutes: number;
  source: 'geofence' | 'manual' | 'mixed';
  confirmedAt: string;
  updatedAt: string;
}

export type SubmissionStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface WeeklySubmissionRecord {
  id: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
  plannedMinutesTrue: number;
  actualMinutesTrue: number;
  plannedMinutesNoisy: number;
  actualMinutesNoisy: number;
  epsilon: number;
  status: SubmissionStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailySubmissionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  plannedHours: number;
  actualHours: number;
  source: 'geofence' | 'manual' | 'mixed';
  status: SubmissionStatus;
  createdAt: string;
  submittedAt: string | null;
  errorMessage: string | null;
}
