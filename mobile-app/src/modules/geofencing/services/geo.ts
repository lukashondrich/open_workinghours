/**
 * Geometry shared by every place that judges a location fix against a fence
 * (TrackingManager, keepalive, exit verification, the app-level enter guard,
 * SetupScreen). One classification, one set of defaults — earlier copies
 * disagreed on what an N/A accuracy meant.
 */

export type FixClass = 'inside' | 'outside' | 'uncertain';

export interface FixLike {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
}

export interface FenceLike {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/** Great-circle distance in metres (Haversine). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Where a fix puts the phone relative to a fence, honouring its accuracy:
 * 'inside' when the whole error circle lies inside, 'outside' when it lies
 * entirely outside, otherwise 'uncertain'. A fix without coordinates or
 * without an accuracy is 'uncertain' — no fix is no evidence.
 */
export function classifyFix(fix: FixLike, fence: FenceLike): FixClass {
  if (fix.latitude === undefined || fix.longitude === undefined) return 'uncertain';
  if (fix.accuracy === undefined || fix.accuracy === null || !Number.isFinite(fix.accuracy)) return 'uncertain';
  const distance = distanceMeters(fix.latitude, fix.longitude, fence.latitude, fence.longitude);
  if (distance + fix.accuracy < fence.radiusMeters) return 'inside';
  if (distance - fix.accuracy > fence.radiusMeters) return 'outside';
  return 'uncertain';
}
