# Geofencing Robustness Plan (Build #42)

**Created:** 2026-01-22
**Updated:** 2026-01-24
**Status:** Implemented
**Platforms:** iOS + Android

---

## Context

This plan consolidates three related planning efforts:

| Document | Status | What It Covers |
|----------|--------|----------------|
| `GEOFENCE_VERIFICATION_PLAN.md` | ✅ Done | Exit verification via scheduled GPS checks (1/3/5 min) |
| `ANDROID_BACKGROUND_TRACKING_PLAN.md` | 🟡 Partial | Android-specific background execution issues |
| This document | 🟢 Active | Unified implementation plan for Build #41 |

---

## Problem Summary

Test user data (Sana Lichtenberg, Build #37, iOS 18.6.2) reveals:

| Issue | Evidence | Impact |
|-------|----------|--------|
| **No GPS accuracy data** | 26 events, all show N/A | Filtering logic never runs |
| **Rapid oscillation** | 4 events in 1 second | False clock-in/out triggers |
| **Silent permission failures** | Warning banner disabled | Users don't know tracking is broken |

### Raw Data

```
GPS Telemetry (26 events)
├─ Avg Accuracy: N/A
├─ Min Accuracy: N/A
├─ Max Accuracy: N/A
├─ Ignored Events: 3 (all "no_session")
└─ Signal Degradation: 0

Sample oscillation (18.1.2026, 09:01:04):
  EXIT  @ Sana              N/A
  ENTER @ Sana              N/A
  EXIT  @ Sana (no_session) N/A
  ENTER @ Sana              N/A
```

---

## Root Cause

**Why accuracy is always N/A:**

iOS/Android geofencing APIs are battery-optimized. They signal "boundary crossed" but rarely include GPS data. Our code tries to extract `data.location` from the event, but it's almost always `undefined`.

```typescript
// GeofenceService.ts:139 - locationData is usually undefined
const locationData = (data as any).location as Location.LocationObject | undefined;
```

**Why filtering doesn't work:**

TrackingManager's accuracy checks require data that doesn't exist:

```typescript
// Both conditions fail because accuracy is undefined
if (event.accuracy !== undefined && event.accuracy > 100) { ... }
if (checkinAccuracy !== null && event.accuracy !== undefined) { ... }
```

---

## Solution Overview

### Build #41 Changes (Telemetry)

| # | Change | Purpose |
|---|--------|---------|
| 1 | Active GPS fetch | Get accuracy data when geofence events fire |
| 2 | Event debouncing | Prevent rapid oscillation (10s cooldown) |
| 3 | Telemetry enhancement | Track GPS data source for debugging |
| 4 | Permission warning | Tell users when tracking isn't working |
| 5 | Notification channels | Better Android notification delivery |
| 6 | Stale exit cleanup | Auto-confirm pending exits >24h old |

### Build #42 Changes (Clock-out Reliability)

Based on testing feedback where exits weren't being confirmed (verification notifications not firing):

| # | Change | Purpose |
|---|--------|---------|
| 7 | Immediate clock-out for good GPS | If accuracy < 50m, clock out immediately without hysteresis |
| 8 | Fix ENTER handler | If pending_exit is expired (>5min), confirm it instead of cancelling |
| 9 | App foreground trigger | Process pending exits when app comes to foreground |
| 10 | Reduce stale cleanup | From 24h to 10min (faster fallback) |

**Philosophy change:** "Bias toward logging out" - if verification doesn't run, act on the EXIT event we received.

```
EXIT event fires
│
├─ Accuracy < 50m?
│   └─ YES → Immediate clock-out ✓ (high confidence)
│
└─ NO (accuracy > 50m or N/A)
    │
    └─ Create pending_exit, try verification
        │
        ├─ Verification says INSIDE → Cancel (false exit)
        ├─ Verification says OUTSIDE → Clock-out ✓
        └─ Verification fails/doesn't run (5+ min passes)
            └─ Clock-out anyway ✓ (act on Stage 1 info)
```

---

## Detailed Design

### 1. Active GPS Fetch

**File:** `GeofenceService.ts`

When a geofence event fires without GPS data, actively request a position:

```typescript
// After extracting locationData from event:
let gpsReading = locationData;
let accuracySource: 'event' | 'active_fetch' | null = locationData ? 'event' : null;

if (!gpsReading) {
  try {
    gpsReading = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    accuracySource = 'active_fetch';
  } catch (error) {
    console.warn('[GeofenceService] Active GPS fetch failed:', error);
  }
}

// Pass accuracySource to callback along with coordinates/accuracy
```

**Why `Balanced` accuracy:** Returns in 1-3 seconds with ~20-50m accuracy. `High` can take 10+ seconds.

### 2. Event Debouncing

**Files:** `TrackingManager.ts`, `Database.ts`

Add 10-second cooldown between events per location. Query database (not in-memory) since background tasks recreate TrackingManager.

```typescript
// TrackingManager.ts - at start of handleGeofenceEnter/Exit
const EVENT_COOLDOWN_MS = 10000;

const recentEvent = await this.db.getLastEventForLocation(event.locationId);
if (recentEvent) {
  const elapsed = Date.now() - new Date(recentEvent.timestamp).getTime();
  if (elapsed < EVENT_COOLDOWN_MS) {
    await this.db.logGeofenceEvent({ ...event, ignored: true, ignoreReason: 'debounced' });
    return;
  }
}
```

```typescript
// Database.ts - new method
async getLastEventForLocation(locationId: string): Promise<GeofenceEvent | null> {
  const result = await this.db.getFirstAsync<any>(
    `SELECT * FROM geofence_events WHERE location_id = ? ORDER BY timestamp DESC LIMIT 1`,
    locationId
  );
  return result ? this.mapGeofenceEvent(result) : null;
}
```

### 3. Telemetry Enhancement

**Files:** `Database.ts`, `types.ts`, `reportIssue.ts`

Add `accuracy_source` field to track where GPS data came from:

| Value | Meaning |
|-------|---------|
| `'event'` | GPS data came with geofence event (rare) |
| `'active_fetch'` | GPS data was actively requested (common) |
| `null` | No GPS data available (fetch failed) |

**Database migration (v4 → v5):**

```typescript
if (version < 5) {
  await this.db.execAsync(`
    ALTER TABLE geofence_events ADD COLUMN accuracy_source TEXT;
  `).catch(() => {});

  await this.db.runAsync(
    `INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, datetime('now'))`,
    5
  );
}
```

### 4. Permission Warning Banner

**File:** `StatusScreen.tsx`

Re-enable the disabled warning banner:

```typescript
// Current (line ~300):
<PermissionWarningBanner visible={false /* !hasBackgroundPermission */} />

// Change to:
<PermissionWarningBanner visible={!hasBackgroundPermission} />
```

### 5. Android Notification Channels

**File:** `App.tsx` (or notification setup)

Create proper channels for Android:

```typescript
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('tracking', {
    name: 'Work Tracking',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
  });

  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Clock In/Out Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}
```

**Important:** Also update notification calls to use these channels:

```typescript
// ExitVerificationService.ts - verification notifications (silent)
await Notifications.scheduleNotificationAsync({
  content: { title: '', body: '', data: { ... } },
  trigger: { seconds: ... },
  ...(Platform.OS === 'android' && { channelId: 'tracking' }),
});

// TrackingManager.ts - clock-in/out notifications (audible)
await Notifications.scheduleNotificationAsync({
  content: { title: 'Clocked In', body: '...' },
  trigger: null,
  ...(Platform.OS === 'android' && { channelId: 'alerts' }),
});
```

### 6. Stale Exit Cleanup

**Files:** `Database.ts`, `TrackingManager.ts`

Auto-confirm pending exits older than 24 hours:

```typescript
// Database.ts
async confirmStalePendingExits(maxAgeHours: number = 24): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const result = await this.db.runAsync(
    `UPDATE tracking_sessions
     SET state = 'completed',
         clock_out = pending_exit_at,
         duration_minutes = ROUND((julianday(pending_exit_at) - julianday(clock_in)) * 24 * 60),
         updated_at = datetime('now')
     WHERE state = 'pending_exit' AND pending_exit_at < ?`,
    cutoff
  );

  return result.changes;
}

// TrackingManager.ts - in processPendingExits()
await this.db.confirmStalePendingExits(24);
```

---

## Implementation Checklist

### Mobile App - Types & Core

| File | Changes |
|------|---------|
| `types.ts` | Add `'debounced'` to `IgnoreReason`; add `accuracySource` to `GeofenceEvent` and `GeofenceEventData` |
| `GeofenceService.ts` | Active GPS fetch; pass `accuracySource` to callback |
| `Database.ts` | Migration v5; `getLastEventForLocation()`; `confirmStalePendingExits()`; update `logGeofenceEvent()` and `mapGeofenceEvent()` |
| `TrackingManager.ts` | Debouncing logic in both handlers; call stale cleanup |
| `reportIssue.ts` | Include `accuracy_source` in telemetry |
| `app.json` | Increment `buildNumber` (40 → 41) |

### Mobile App - Android Robustness

| File | Changes |
|------|---------|
| `StatusScreen.tsx` | Enable `PermissionWarningBanner` |
| `App.tsx` | Android notification channels |
| `ExitVerificationService.ts` | Add `channelId: 'tracking'` to verification notifications |
| `TrackingManager.ts` | Add `channelId: 'alerts'` to clock-in/out notifications |

### Backend

| File | Changes |
|------|---------|
| `schemas.py` | Add `accuracy_source: str \| None` to `GpsTelemetryEvent` |
| `admin.py` | Display accuracy with source (e.g., "32.5m (fetch)") |

---

## File Change Summary

```
mobile-app/
├── src/modules/geofencing/
│   ├── types.ts                    [edit] Add debounced, accuracySource
│   └── services/
│       ├── GeofenceService.ts      [edit] Active GPS fetch
│       ├── Database.ts             [edit] Migration, new methods
│       ├── TrackingManager.ts      [edit] Debouncing, stale cleanup, channelId
│       └── ExitVerificationService.ts [edit] Add channelId to notifications
├── src/lib/utils/
│   └── reportIssue.ts              [edit] Include accuracy_source
├── src/screens/
│   └── StatusScreen.tsx            [edit] Enable warning banner
├── App.tsx                         [edit] Notification channels
└── app.json                        [edit] buildNumber 40→41

backend/
└── app/
    ├── schemas.py                  [edit] accuracy_source field
    └── routers/admin.py            [edit] Display accuracy_source
```

**Total: 11 files**

---

## Testing Plan

### What Can't Be Tested in Simulator

- Geofencing (requires real device)
- Background GPS fetch
- Notification delivery timing

### Device Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Clock in/out at real location | Accuracy shows actual value (not N/A) |
| Walk boundary repeatedly | Events show "debounced" in telemetry |
| Submit bug report | Admin sees accuracy_source column |
| Deny background permission | Warning banner appears on StatusScreen |
| Leave pending exit for 24h+ | Auto-confirmed on next app open |

### Expected Telemetry After Fix

```
GPS Telemetry (26 events)
├─ Avg Accuracy: 28.3m
├─ Min Accuracy: 12.1m
├─ Max Accuracy: 67.4m
├─ Ignored Events: 6 (3 debounced, 3 no_session)
└─ Signal Degradation: 1

Sample (with fix):
  ENTER @ Sana  28.3m (fetch)  09:01:04
  EXIT  @ Sana  [debounced]    09:01:04  ← prevented
  ENTER @ Sana  [debounced]    09:01:04  ← prevented
  EXIT  @ Sana  [debounced]    09:01:04  ← prevented
```

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GPS fetch fails in background | Low | Graceful fallback (proceed without accuracy) |
| Battery drain from active fetch | Low | Using `Balanced` accuracy, not `High` |
| 10s debounce too aggressive | Medium | Can tune; 10s is conservative |
| Platform differences | Low | expo-location abstracts both platforms |

---

## Deferred Items

These items from `ANDROID_BACKGROUND_TRACKING_PLAN.md` require more effort and are deferred to a future build:

| Item | Reason for Deferral |
|------|---------------------|
| WorkManager for Android verification | Needs native module, high effort |
| Battery optimization guidance | Nice to have, not critical |
| Extend geofence task | Medium effort, partial benefit |

---

## Post-Implementation

1. **Update `mobile-app/ARCHITECTURE.md`:**
   - Add "GPS Telemetry" section documenting accuracy_source
   - Add "Event Debouncing" section with cooldown parameter

2. **Update `CLAUDE.md`:**
   - Brief mention in "Recent Updates"

3. **Archive:**
   - Move this file to `archive/GPS_TELEMETRY_PLAN.md`
   - Consider archiving `ANDROID_BACKGROUND_TRACKING_PLAN.md` (partially addressed)
