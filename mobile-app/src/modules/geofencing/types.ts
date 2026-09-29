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

export type ExitEvidence = 'outside' | 'uncertain';

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
  /** Rule 5: 'outside' = a fix placed the phone confidently outside the fence
   *  (the exit may be confirmed); 'uncertain' = no usable fix yet (confirm only
   *  after positive evidence, else cancel). null on legacy/non-pending rows. */
  exitEvidence: ExitEvidence | null;
  /** Android core: the latest fix time that placed the phone inside the fence
   *  (clock-in, inside pings, OS enters). Drives the gap rule. null on legacy rows. */
  lastInsideAt: string | null;
  checkinAccuracy: number | null; // GPS accuracy at check-in (meters)
  createdAt: string;
  updatedAt: string;
}

export type IgnoreReason =
  | 'poor_accuracy'
  | 'signal_degradation'
  | 'no_session'
  | 'debounced'
  | 'manual_session' // location signal ignored: session is user-owned
  | 'stale_timestamp' // fix predates the latest session boundary
  | 'phantom_exit' // OS said exit, but the fetched fix is confidently inside the fence
  | 'auto_enter_suppressed' // initial-trigger enter after a manual clock-out (rule 7)
  | null;

// 'event': fix delivered with the OS callback; 'active_fetch': fetched by the app
// after an OS callback; 'keepalive': a background location ping (a SINGLE signal —
// no OS transition behind it — so exits from it always take the hysteresis path).
export type AccuracySource = 'event' | 'active_fetch' | 'keepalive' | null;

export interface GeofenceEvent {
  id: string;
  locationId: string;
  eventType: 'enter' | 'exit';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  accuracySource?: AccuracySource;
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
  accuracySource?: AccuracySource;
}

export interface GeofenceConfig {
  minRadius: number;            // 50m
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

export type ReportsWeekQueueStatus = 'queued' | 'sent';

export interface ReportsWeekQueueRecord {
  weekStart: string; // YYYY-MM-DD (Monday)
  status: ReportsWeekQueueStatus;
  queuedAt: string | null;
  sentAt: string | null;
  lastError: string | null;
  sendAfter: string | null; // ISO8601 timestamp — jitter for load spreading
  updatedAt: string;
}
