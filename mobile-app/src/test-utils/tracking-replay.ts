/**
 * Replay helper for realistic tracking scenarios.
 *
 * A timeline is written the way events appear in a bug report's geofence log
 * (source, where the fix was, its accuracy, the time) plus what the app does in
 * between (verification checks, foreground passes, keepalive fixes, manual
 * taps). The clock is FAKED and advanced per step (`jest.setSystemTime`), so
 * hysteresis, freshness, debouncing and the expiry pass all see the timeline's
 * time — the test must call `jest.useFakeTimers()` before `replay()`.
 *
 * The same timeline can be replayed against either tracking core:
 *   - TrackingManagerIOS (iOS production) — no keepalive on iOS, and verification
 *     notifications do not run the app in the background there, so an iOS
 *     profile normally uses only `os`, `foreground` and `manual` steps.
 *   - TrackingManagerAndroid (Android) — all step kinds.
 *
 * Turn a real report into a test by transcribing its rows; shift the dates and
 * drop the location name — reports are personal data.
 */
import * as Location from 'expo-location';
import { Database } from '@/modules/geofencing/services/Database';
import type { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import * as ExitVerificationService from '@/modules/geofencing/services/ExitVerificationService';
import { handleKeepaliveTaskPayload } from '@/modules/geofencing/services/KeepaliveHealthCheckService';
import { TrackingManagerIOS } from '@/modules/geofencing/services/TrackingManagerIOS';
import type { GeofenceEventData } from '@/modules/geofencing/types';

/**
 * Where the phone was. 'near' = just outside the fence edge (place.near), so
 * that the classification depends on the accuracy: with a tight fix it is
 * 'outside', with a loose one 'uncertain' — real GPS jitter at the boundary.
 */
export type Where = 'inside' | 'outside' | 'near' | 'uncertain';

/** A fix as the report shows it: where the phone was, and how good the fix was. 'none' = N/A. */
export type Fix = { where: Where; accuracy: number } | 'none';

export type ReplayStep =
  // OS geofence callback with the fix the app fetched for it. `fixAt` (minutes,
  // same scale as `at`) backdates the fix's own timestamp: a cached / batched
  // fix delivered late.
  | { at: number; os: 'enter' | 'exit'; fix: Fix; fixAt?: number }
  // Keepalive fix delivered live (Android only); `fixAt` as above
  | { at: number; keepalive: Where; accuracy: number; fixAt?: number }
  // A batched keepalive delivery: several fixes, each with its own time, in one payload
  | { at: number; batch: Array<{ where: Where; accuracy: number; fixAt: number }> }
  // Scheduled verification check fires; what GPS says at that moment
  | { at: number; verify: number; gps: Where }
  // App comes to the foreground; what GPS would say if the expiry pass asks
  | { at: number; foreground: true; gps?: Where }
  // The user taps the manual button
  | { at: number; manual: 'in' | 'out' }
  // The app is opened: foreground pass with this fix, then Android's initial-trigger
  // callback from the fence re-registration (enter if inside, exit otherwise)
  | { at: number; appOpen: { where: Where; accuracy: number } }
  // Two keepalive payloads delivered at the same moment (must be chained, never dropped)
  | { at: number; concurrentBatches: Array<Array<{ where: Where; accuracy: number; fixAt: number }>> }
  // The same fix delivered as ENTER and EXIT at once (OS callback + keepalive)
  | { at: number; raceEnterExit: Fix };

export interface ReplayPlace {
  locationId: string;
  inside: { lat: number; lon: number };
  outside: { lat: number; lon: number };
  /** Just past the fence edge; defaults to `outside`. */
  near?: { lat: number; lon: number };
  radiusMeters: number;
}

const MIN = 60 * 1000;

export async function replay(
  db: Database,
  manager: TrackingManager,
  place: ReplayPlace,
  baseMs: number,
  steps: ReplayStep[]
): Promise<void> {
  const gps = Location.getCurrentPositionAsync as jest.Mock;
  const coordsFor = (where: Where) =>
    where === 'outside'
      ? place.outside
      : where === 'near'
        ? place.near ?? place.outside
        : place.inside; // 'uncertain' sits at the centre with a useless accuracy
  const locationObject = (where: Where, accuracy: number, timestampMs: number): Location.LocationObject => ({
    coords: {
      latitude: coordsFor(where).lat,
      longitude: coordsFor(where).lon,
      // 'uncertain' = a fix so coarse it says nothing
      accuracy: where === 'uncertain' ? 10_000 : accuracy,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      speed: 0,
    },
    timestamp: timestampMs,
  });
  const osEvent = (type: 'enter' | 'exit', fix: Fix, fixAtMin?: number): GeofenceEventData => {
    // No fix: the task falls back to the region's own coordinates, accuracy unknown
    const where: Where = fix === 'none' ? 'inside' : fix.where;
    return {
      eventType: type,
      locationId: place.locationId,
      timestamp: new Date(fixAtMin === undefined ? Date.now() : baseMs + fixAtMin * MIN).toISOString(),
      latitude: coordsFor(where).lat,
      longitude: coordsFor(where).lon,
      accuracy: fix === 'none' ? undefined : fix.where === 'uncertain' ? 10_000 : fix.accuracy,
      accuracySource: fix === 'none' ? null : 'active_fetch',
    };
  };

  // The iOS core runs on a platform without a heartbeat, without fence
  // re-registration triggers, and without background verification checks:
  // those steps never happen there and are skipped.
  const isIOS = manager instanceof TrackingManagerIOS;

  for (const step of steps) {
    jest.setSystemTime(baseMs + step.at * MIN);
    gps.mockReset();
    if (isIOS && ('keepalive' in step || 'batch' in step || 'concurrentBatches' in step || 'verify' in step)) continue;
    if (isIOS && 'appOpen' in step) {
      await manager.processPendingExits();
      continue;
    }

    if ('os' in step) {
      if (step.os === 'enter') await manager.handleGeofenceEnter(osEvent('enter', step.fix, step.fixAt));
      else await manager.handleGeofenceExit(osEvent('exit', step.fix, step.fixAt));
    } else if ('keepalive' in step) {
      const fixMs = step.fixAt === undefined ? Date.now() : baseMs + step.fixAt * MIN;
      await handleKeepaliveTaskPayload({ locations: [locationObject(step.keepalive, step.accuracy, fixMs)] });
    } else if ('batch' in step) {
      await handleKeepaliveTaskPayload({
        locations: step.batch.map((f) => locationObject(f.where, f.accuracy, baseMs + f.fixAt * MIN)),
      });
    } else if ('verify' in step) {
      const owner = await ExitVerificationService.getActiveVerificationSessionId();
      if (!owner) throw new Error(`replay: verify step at ${step.at} min but no verification is scheduled`);
      gps.mockResolvedValueOnce(locationObject(step.gps, 15, Date.now()));
      await ExitVerificationService.handleVerificationCheck(step.verify);
      if (gps.mock.calls.length !== 1) throw new Error(`replay: verify step at ${step.at} min did not consult GPS`);
    } else if ('foreground' in step) {
      gps.mockResolvedValue(locationObject(step.gps ?? 'uncertain', 15, Date.now()));
      await manager.processPendingExits();
    } else if ('appOpen' in step) {
      gps.mockResolvedValue(locationObject(step.appOpen.where, step.appOpen.accuracy, Date.now()));
      await manager.processPendingExits();
      await db.setPreference('geofences_registered_at', new Date().toISOString());
      const fix: Fix = { where: step.appOpen.where, accuracy: step.appOpen.accuracy };
      if (step.appOpen.where === 'inside') await manager.handleGeofenceEnter(osEvent('enter', fix));
      else await manager.handleGeofenceExit(osEvent('exit', fix));
    } else if ('concurrentBatches' in step) {
      await Promise.all(
        step.concurrentBatches.map((batch) =>
          handleKeepaliveTaskPayload({
            locations: batch.map((f) => locationObject(f.where, f.accuracy, baseMs + f.fixAt * MIN)),
          })
        )
      );
    } else if ('manual' in step) {
      if (step.manual === 'in') await manager.clockIn(place.locationId);
      else await manager.clockOut(place.locationId);
    } else if ('raceEnterExit' in step) {
      const enter = osEvent('enter', step.raceEnterExit);
      const exit: GeofenceEventData = { ...enter, eventType: 'exit' };
      await Promise.all([manager.handleGeofenceEnter(enter), manager.handleGeofenceExit(exit)]);
    }
  }
  gps.mockReset();
}
