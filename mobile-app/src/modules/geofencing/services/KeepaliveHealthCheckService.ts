/**
 * Android heartbeat → tracking core.
 *
 * The foreground keepalive service (ForegroundKeepaliveService.ts) delivers a
 * location fix about every 5 minutes, batched in the background. Every fix is
 * handed to `TrackingManagerAndroid.handleFix` for every active location, in
 * fix-time order. All decisions live in the core; this file only orders,
 * de-duplicates and chains deliveries.
 */
import * as Location from 'expo-location';

import { getDatabase } from './Database';
import { TrackingManagerAndroid, type TrackingFix } from './TrackingManagerAndroid';

const ACTIVE_FETCH_FALLBACK_INTERVAL_MS = 120_000;
const ACTIVE_FETCH_TIMEOUT_MS = 8_000;

let chain: Promise<void> = Promise.resolve();
let lastProcessedFixMs = 0;
let lastFallbackFetchAtMs = 0;

function toFix(location: Location.LocationObject): TrackingFix {
  const ts = typeof location.timestamp === 'number' && Number.isFinite(location.timestamp) && location.timestamp > 0
    ? location.timestamp
    : Date.now();
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: new Date(ts).toISOString(),
  };
}

async function fetchFallbackLocation(): Promise<Location.LocationObject | null> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('active fetch timed out')), ACTIVE_FETCH_TIMEOUT_MS);
    });
    return (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutPromise,
    ])) as Location.LocationObject;
  } catch (error) {
    console.warn('[LocationKeepalive] Fallback active GPS fetch failed:', error);
    return null;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function handleImpl(data: unknown): Promise<void> {
  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  let locations = payload?.locations ?? [];

  if (locations.length === 0) {
    // Some devices invoke the task without fixes. Fetch one ourselves, throttled,
    // only while a session is open (nothing to decide otherwise).
    const now = Date.now();
    if (now - lastFallbackFetchAtMs < ACTIVE_FETCH_FALLBACK_INTERVAL_MS) return;
    const db = await getDatabase();
    if (!(await db.hasOpenSession())) return;
    lastFallbackFetchAtMs = now;
    const fallback = await fetchFallbackLocation();
    if (!fallback) return;
    console.log('[LocationKeepalive] No payload locations, using a fallback active fix');
    locations = [fallback];
  }

  // Batched deliveries carry each fix's ORIGINAL time: replay them in order so
  // the earliest state-changing fix dates the transition, not the delivery.
  const ordered = [...locations].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  const db = await getDatabase();
  const manager = new TrackingManagerAndroid(db);
  const fences = await db.getActiveLocations();
  if (fences.length === 0) return;

  for (const location of ordered) {
    const fixMs = typeof location.timestamp === 'number' ? location.timestamp : 0;
    if (fixMs > 0 && fixMs <= lastProcessedFixMs) continue; // already seen
    const fix = toFix(location);
    for (const fence of fences) {
      await manager.handleFix(fence.id, fix, 'keepalive');
    }
    // Liveness is recorded AFTER every fence judged this fix, once per fix, so
    // "was the stream alive through (a, b)" never counts the fix being judged.
    await manager.noteHeartbeat(fix.timestamp);
    if (fixMs > 0) lastProcessedFixMs = fixMs;
  }
}

/**
 * Entry point for the keepalive task. Deliveries are chained, never dropped:
 * two payloads arriving together are processed one after the other.
 */
export function handleKeepaliveTaskPayload(data: unknown): Promise<void> {
  const run = chain.then(() => handleImpl(data));
  chain = run.catch((error) => {
    console.error('[LocationKeepalive] Payload handling failed:', error);
  });
  return chain;
}

/** Test-only: reset the module-level state between tests. */
export function __resetKeepaliveStateForTests(): void {
  chain = Promise.resolve();
  lastProcessedFixMs = 0;
  lastFallbackFetchAtMs = 0;
}
