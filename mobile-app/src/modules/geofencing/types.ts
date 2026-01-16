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

export type SessionState = 'active' | 'pending_exit' | 'completed';

export interface TrackingSession {
  id: string;
  locationId: string;
  clockIn: string;              // ISO8601
  clockOut: string | null;
  durationMinutes: number | null;
  trackingMethod: 'geofence_auto' | 'manual';
  state: SessionState;
  pendingExitAt: string | null; // ISO8601 - when exit was triggered
  exitAccuracy: number | null;  // GPS accuracy at exit event (meters)
  checkinAccuracy: number | null; // GPS accuracy at check-in (meters)
  createdAt: string;
  updatedAt: string;
}

export type IgnoreReason = 'poor_accuracy' | 'signal_degradation' | 'no_session' | null;

export interface GeofenceEvent {
  id: string;
  locationId: string;
  eventType: 'enter' | 'exit';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  ignored: boolean;
  ignoreReason: IgnoreReason;
}

/**
 * Event data passed from GeofenceService to TrackingManager
 * (before being stored in the database)
 */
export interface GeofenceEventData {
  eventType: 'enter' | 'exit';
  locationId: string;
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
