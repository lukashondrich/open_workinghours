import * as Location from 'expo-location';

import { GeofenceEventData, UserLocation } from '../types';
import { getDatabase } from './Database';
import { TrackingManager } from './TrackingManager';

// Skip very frequent callbacks; we only need coarse state correction.
const MIN_HEALTH_CHECK_INTERVAL_MS = 30_000;
const DEFAULT_ACCURACY_METERS = 100;
const ACTIVE_FETCH_FALLBACK_INTERVAL_MS = 120_000;
const ACTIVE_FETCH_TIMEOUT_MS = 8_000;

let isHealthCheckRunning = false;
let lastHealthCheckAtMs = 0;
let lastProcessedLocationTimestampMs = 0;
let lastFallbackFetchAtMs = 0;

function toIsoTimestamp(locationTimestampMs?: number): string {
  if (locationTimestampMs && Number.isFinite(locationTimestampMs)) {
    return new Date(locationTimestampMs).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMeters = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function getConfidenceState(
  location: Location.LocationObject,
  geofence: UserLocation
): 'inside' | 'outside' | 'uncertain' {
  const distanceMeters = calculateDistanceMeters(
    location.coords.latitude,
    location.coords.longitude,
    geofence.latitude,
    geofence.longitude
  );
  const accuracyMeters = location.coords.accuracy ?? DEFAULT_ACCURACY_METERS;
  const radiusMeters = geofence.radiusMeters;

  // Use confidence bounds to avoid flapping on low-quality GPS.
  const confidentlyInside = distanceMeters + accuracyMeters < radiusMeters;
  const confidentlyOutside = distanceMeters - accuracyMeters > radiusMeters;

  if (confidentlyInside) return 'inside';
  if (confidentlyOutside) return 'outside';
  return 'uncertain';
}

function buildEvent(
  eventType: 'enter' | 'exit',
  locationId: string,
  location: Location.LocationObject,
  options?: { omitAccuracy?: boolean }
): GeofenceEventData {
  return {
    eventType,
    locationId,
    timestamp: toIsoTimestamp(location.timestamp),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: options?.omitAccuracy ? undefined : location.coords.accuracy ?? undefined,
    accuracySource: 'active_fetch',
  };
}

async function fetchFallbackLocation(): Promise<Location.LocationObject | null> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('active fetch timed out')),
        ACTIVE_FETCH_TIMEOUT_MS
      );
    });

    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      }),
      timeoutPromise,
    ]) as Location.LocationObject;

    return location;
  } catch (error) {
    console.warn('[LocationKeepalive] Fallback active GPS fetch failed:', error);
    return null;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Fallback transition detector driven by keepalive location updates.
 * This runs only when Android foreground keepalive is active.
 */
export async function runKeepaliveHealthCheck(
  location: Location.LocationObject,
  options?: { bypassRateLimit?: boolean }
): Promise<void> {
  const now = Date.now();

  if (isHealthCheckRunning) {
    return;
  }
  // The 30s rate limit guards against high-frequency LIVE callbacks. When replaying
  // a delayed/batched delivery (see handleKeepaliveTaskPayload) we bypass it so every
  // historical fix is evaluated in order; the monotonic timestamp guard below still
  // prevents reprocessing the same point twice.
  if (!options?.bypassRateLimit && now - lastHealthCheckAtMs < MIN_HEALTH_CHECK_INTERVAL_MS) {
    return;
  }

  const locationTimestampMs =
    typeof location.timestamp === 'number' ? location.timestamp : 0;
  if (
    locationTimestampMs > 0 &&
    locationTimestampMs <= lastProcessedLocationTimestampMs
  ) {
    return;
  }

  isHealthCheckRunning = true;
  lastHealthCheckAtMs = now;
  if (locationTimestampMs > 0) {
    lastProcessedLocationTimestampMs = locationTimestampMs;
  }

  try {
    const db = await getDatabase();
    const trackingManager = new TrackingManager(db);
    const activeLocations = await db.getActiveLocations();

    if (activeLocations.length === 0) {
      return;
    }

    for (const geofence of activeLocations) {
      const confidenceState = getConfidenceState(location, geofence);
      if (confidenceState === 'uncertain') {
        continue;
      }

      const activeSession = await db.getActiveSession(geofence.id);

      if (confidenceState === 'inside') {
        // Enter fallback only when it can change state:
        // 1) no active session -> should clock in
        // 2) pending exit -> should cancel/resolve pending state
        if (!activeSession || activeSession.state === 'pending_exit') {
          await trackingManager.handleGeofenceEnter(
            buildEvent('enter', geofence.id, location)
          );
          console.log(
            `[LocationKeepalive] Fallback enter for ${geofence.id} (${geofence.name})`
          );
        }
        continue;
      }

      // Outside fallback only when an active session exists and can transition to exit.
      if (activeSession && activeSession.state === 'active') {
        // Accuracy-based degradation checks in TrackingManager are tuned for noisy
        // raw geofence callbacks. This path is already "confidently outside"
        // (distance - accuracy > radius), so omit accuracy to avoid false ignore.
        await trackingManager.handleGeofenceExit(
          buildEvent('exit', geofence.id, location, { omitAccuracy: true })
        );
        console.log(
          `[LocationKeepalive] Fallback exit for ${geofence.id} (${geofence.name})`
        );
      }
    }

    // Keep pending-exit lifecycle moving even when geofence transitions are sparse.
    await trackingManager.processPendingExits();
  } catch (error) {
    console.error('[LocationKeepalive] Health check failed:', error);
  } finally {
    isHealthCheckRunning = false;
  }
}

export async function handleKeepaliveTaskPayload(
  data: unknown
): Promise<void> {
  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  const locations = payload?.locations;

  if (locations && locations.length > 0) {
    // Reconstruct the true transition time from a delayed/batched delivery.
    // Android delivers deferred location updates as a batch, each fix carrying its
    // ORIGINAL timestamp. Replaying them in chronological order means the EARLIEST
    // state-changing fix drives the transition (e.g. clock-in stamped at the first
    // "inside" ping), instead of the previous behaviour which used only the latest
    // fix and therefore stamped the transition at delivery time (≈ now). This is what
    // makes a late/throttled re-entry still record the correct clock-in time without
    // relying on the user disabling battery optimization.
    const ordered = [...locations].sort(
      (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
    );
    for (const location of ordered) {
      await runKeepaliveHealthCheck(location, { bypassRateLimit: true });
    }
    return;
  }

  // Some Android devices invoke keepalive tasks without attaching location updates.
  // In that case, perform a throttled active GPS fetch only if there is an open session.
  const now = Date.now();
  if (now - lastFallbackFetchAtMs < ACTIVE_FETCH_FALLBACK_INTERVAL_MS) {
    return;
  }

  try {
    const db = await getDatabase();
    const hasOpenSession = await db.hasOpenSession();
    if (!hasOpenSession) {
      return;
    }

    lastFallbackFetchAtMs = now;

    const fallbackLocation = await fetchFallbackLocation();
    if (!fallbackLocation) {
      return;
    }

    console.log('[LocationKeepalive] No payload locations, running fallback active GPS check');
    await runKeepaliveHealthCheck(fallbackLocation);
  } catch (error) {
    console.error('[LocationKeepalive] Fallback payload handling failed:', error);
  }
}

/**
 * Test-only: reset the module-level throttle / dedup state between tests.
 */
export function __resetKeepaliveStateForTests(): void {
  isHealthCheckRunning = false;
  lastHealthCheckAtMs = 0;
  lastProcessedLocationTimestampMs = 0;
  lastFallbackFetchAtMs = 0;
}
