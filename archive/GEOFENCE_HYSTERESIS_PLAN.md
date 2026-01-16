# Geofence Hysteresis & GPS Accuracy Filtering

**Created:** 2026-01-15
**Status:** In Progress
**Related:** `mobile-app/ARCHITECTURE.md` (geofencing module)

---

## Problem Statement

Healthcare workers crossing geofence boundaries and entering large buildings experience:
1. GPS signal degradation inside buildings triggers false "exit" events
2. Immediate clock-out (no hysteresis despite docs claiming 5-min)
3. Sessions <5 minutes are **deleted entirely** - nothing to correct
4. GPS accuracy is logged but never used for filtering decisions

## Solution Overview

Implement a **layered defense** with four components:

1. **Pending Exit State** - Don't clock out immediately; track "pending exit" in database
2. **GPS Accuracy Filtering** - Ignore/delay exit events with poor accuracy (>100m)
3. **Signal Degradation Detection** - If accuracy worsens significantly after check-in, treat exits as suspicious
4. **Session Preservation** - Keep short sessions visible instead of deleting

**Plus**: Telemetry logging for real-world parameter tuning via "Report Issue" button.

## Architecture

```
Exit Event Received
        │
        ▼
┌─────────────────────┐
│ Log event to        │
│ telemetry buffer    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check GPS Accuracy  │
│ Is accuracy > 100m? │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │ Yes       │ No
     │ (poor)    │
     ▼           ▼
┌────────┐  ┌─────────────────────┐
│ IGNORE │  │ Check Signal        │
│ event  │  │ Degradation         │
└────────┘  │ (accuracy > 3x      │
            │  check-in accuracy) │
            └──────────┬──────────┘
                       │
                 ┌─────┴─────┐
                 │ Yes       │ No
                 │ (degraded)│
                 ▼           ▼
            ┌────────┐  ┌─────────────────┐
            │ IGNORE │  │ Create Pending  │
            │ event  │  │ Exit record     │
            └────────┘  └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Wait for        │
                        │ confirmation:   │
                        │ - 5 min elapsed │
                        │ - Re-enter      │
                        │ - App resume    │
                        └─────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema Changes

**File:** `mobile-app/src/modules/geofencing/services/Database.ts`

1. Add columns to `tracking_sessions`:
   ```sql
   state TEXT DEFAULT 'active'           -- 'active' | 'pending_exit' | 'completed'
   pending_exit_at TEXT                  -- ISO8601 timestamp when exit was triggered
   exit_accuracy REAL                    -- GPS accuracy at exit event (meters)
   checkin_accuracy REAL                 -- GPS accuracy at check-in (for degradation detection)
   ```

2. Add `ignored` column to `geofence_events` for telemetry:
   ```sql
   ignored INTEGER DEFAULT 0             -- 1 if event was filtered out
   ignore_reason TEXT                    -- 'poor_accuracy' | 'signal_degradation' | null
   ```

3. Create migration for existing sessions (set state='completed' where clock_out IS NOT NULL)

4. Add new database methods:
   - `markPendingExit(sessionId, timestamp, accuracy)`
   - `confirmPendingExit(sessionId)`
   - `cancelPendingExit(sessionId)`
   - `getExpiredPendingExits(thresholdMinutes)`
   - `getPendingExitSession(locationId)`
   - `getRecentGeofenceEvents(limit)` - for telemetry export

---

### Phase 2: Type Updates

**File:** `mobile-app/src/modules/geofencing/types.ts`

1. Update `TrackingSession` interface:
   ```typescript
   export interface TrackingSession {
     // ... existing fields
     state: 'active' | 'pending_exit' | 'completed';
     pendingExitAt: string | null;
     exitAccuracy: number | null;
     checkinAccuracy: number | null;
   }
   ```

2. Update `GeofenceEventData` to include accuracy:
   ```typescript
   export interface GeofenceEventData {
     // ... existing fields
     accuracy?: number;  // GPS accuracy in meters
   }
   ```

3. Update `GeofenceEvent` to include filtering info:
   ```typescript
   export interface GeofenceEvent {
     // ... existing fields
     ignored: boolean;
     ignoreReason: 'poor_accuracy' | 'signal_degradation' | null;
   }
   ```

---

### Phase 3: Pass GPS Accuracy Through Events

**File:** `mobile-app/src/modules/geofencing/services/GeofenceService.ts`

Modify `defineBackgroundTask` to pass accuracy from the location data:
```typescript
const event: GeofenceEventData = {
  eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
  locationId: region.identifier,
  timestamp: new Date().toISOString(),
  latitude: region.latitude,
  longitude: region.longitude,
  accuracy: (data as any).location?.coords?.accuracy,  // Extract accuracy
};
```

---

### Phase 4: TrackingManager Hysteresis Logic

**File:** `mobile-app/src/modules/geofencing/services/TrackingManager.ts`

**Constants:**
```typescript
const EXIT_HYSTERESIS_MINUTES = 5;       // Global setting for all locations
const GPS_ACCURACY_THRESHOLD = 100;      // meters - ignore exits above this
const DEGRADATION_FACTOR = 3;            // Ignore if accuracy is 3x worse than check-in
const MIN_SESSION_MINUTES = 5;           // Keep but show indicator, allow manual expansion
```

**Modified `handleGeofenceEnter()`:**
```typescript
async handleGeofenceEnter(event: GeofenceEventData): Promise<void> {
  // Log event for telemetry (always, before any filtering)
  await this.db.logGeofenceEvent({
    ...event,
    ignored: false,
    ignoreReason: null,
  });

  // Check for pending exit to cancel
  const pendingSession = await this.db.getPendingExitSession(event.locationId);
  if (pendingSession) {
    await this.db.cancelPendingExit(pendingSession.id);
    await this.sendNotification(
      'Welcome back',
      'Clock-out cancelled, you\'re still clocked in'
    );
    return;
  }

  // Existing clock-in logic...
  const activeSession = await this.db.getActiveSession(event.locationId);
  if (activeSession) return;

  // Clock in with accuracy recorded
  const session = await this.db.clockIn(
    event.locationId,
    event.timestamp,
    'geofence_auto',
    event.accuracy ?? null  // Store check-in accuracy
  );
  // ...
}
```

**Modified `handleGeofenceExit()`:**
```typescript
async handleGeofenceExit(event: GeofenceEventData): Promise<void> {
  const activeSession = await this.db.getActiveSession(event.locationId);
  if (!activeSession) {
    // Log orphan exit event for telemetry
    await this.db.logGeofenceEvent({...event, ignored: true, ignoreReason: 'no_session'});
    return;
  }

  // Layer 1: GPS accuracy filtering (absolute threshold)
  if (event.accuracy && event.accuracy > GPS_ACCURACY_THRESHOLD) {
    console.log(`Ignoring exit - poor GPS accuracy: ${event.accuracy}m`);
    await this.db.logGeofenceEvent({...event, ignored: true, ignoreReason: 'poor_accuracy'});
    return;
  }

  // Layer 2: Signal degradation detection (relative to check-in)
  const checkinAccuracy = activeSession.checkinAccuracy;
  if (checkinAccuracy && event.accuracy) {
    if (event.accuracy > checkinAccuracy * DEGRADATION_FACTOR) {
      console.log(`Ignoring exit - signal degradation: ${event.accuracy}m vs ${checkinAccuracy}m at check-in`);
      await this.db.logGeofenceEvent({...event, ignored: true, ignoreReason: 'signal_degradation'});
      return;
    }
  }

  // Log valid exit event
  await this.db.logGeofenceEvent({...event, ignored: false, ignoreReason: null});

  // Layer 3: Check for existing pending exit
  const existingPending = await this.db.getPendingExitSession(event.locationId);
  if (existingPending) {
    console.log('Pending exit already exists');
    return;
  }

  // Layer 4: Create pending exit (don't clock out yet)
  await this.db.markPendingExit(
    activeSession.id,
    event.timestamp,
    event.accuracy ?? null
  );

  await this.sendNotification(
    'Leaving work area',
    'Will clock out in 5 minutes if you don\'t return'
  );
}
```

**New `processPendingExits()` method:**
```typescript
async processPendingExits(): Promise<void> {
  const expiredPending = await this.db.getExpiredPendingExits(EXIT_HYSTERESIS_MINUTES);

  for (const session of expiredPending) {
    await this.db.confirmPendingExit(session.id);
    const duration = this.calculateDuration(session.clockIn, session.pendingExitAt);

    // Don't delete short sessions - keep them visible
    if (duration < MIN_SESSION_MINUTES) {
      await this.sendNotification(
        'Short session recorded',
        `${duration} min session saved - you can adjust it in the calendar`
      );
    } else {
      await this.sendNotification(
        'Clocked Out',
        `Worked ${this.formatDuration(duration)} at ${session.locationName}`
      );
    }
  }
}
```

---

### Phase 5: GPS Telemetry for Report Issue

**File:** `mobile-app/src/lib/utils/reportIssue.ts`

Add GPS accuracy telemetry to the app state snapshot:

```typescript
interface AppStateSnapshot {
  // ... existing fields

  // NEW: GPS telemetry for parameter tuning
  gps_telemetry: {
    recent_events: Array<{
      timestamp: string;
      event_type: 'enter' | 'exit';
      accuracy_meters: number | null;
      ignored: boolean;
      ignore_reason: string | null;
      location_name: string;
    }>;
    accuracy_stats: {
      min: number;
      max: number;
      avg: number;
      count: number;
    };
    ignored_events_count: number;
    signal_degradation_count: number;
  };
}
```

**Implementation:**
```typescript
async function collectGpsTelemetry(db: Database): Promise<GpsTelemetry> {
  // Get last 100 geofence events with accuracy data
  const recentEvents = await db.getRecentGeofenceEvents(100);

  const accuracyValues = recentEvents
    .filter(e => e.accuracy != null)
    .map(e => e.accuracy!);

  return {
    recent_events: recentEvents.map(e => ({
      timestamp: e.timestamp,
      event_type: e.eventType,
      accuracy_meters: e.accuracy ?? null,
      ignored: e.ignored,
      ignore_reason: e.ignoreReason,
      location_name: e.locationName ?? 'Unknown',
    })),
    accuracy_stats: {
      min: Math.min(...accuracyValues) || 0,
      max: Math.max(...accuracyValues) || 0,
      avg: accuracyValues.length > 0
        ? accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length
        : 0,
      count: accuracyValues.length,
    },
    ignored_events_count: recentEvents.filter(e => e.ignored).length,
    signal_degradation_count: recentEvents.filter(e => e.ignoreReason === 'signal_degradation').length,
  };
}
```

This data will be included in every "Report Issue" submission, allowing you to:
- See real GPS accuracy values from the healthcare facility
- Analyze how often events are being ignored
- Tune the 100m threshold and 3x degradation factor based on real data

---

### Phase 6: App Startup Cleanup

**File:** `mobile-app/App.tsx`

Add pending exit processing on app startup:
```typescript
useEffect(() => {
  const processPending = async () => {
    await trackingManager.processPendingExits();
  };
  processPending();
}, []);
```

Also call `processPendingExits()` on every geofence event (both enter and exit).

---

### Phase 7: Calendar/UI Changes (Short Sessions)

**File:** `mobile-app/src/modules/calendar/` (relevant components)

1. Display sessions with duration < 5 min differently (faded, with indicator)
2. Allow manual expansion of short sessions
3. Show "needs review" badge on days with short sessions

---

## File Changes Summary

| File | Changes |
|------|---------|
| `Database.ts` | Schema migration, new columns, telemetry query methods |
| `types.ts` | Update interfaces with state fields, ignored event tracking |
| `GeofenceService.ts` | Pass accuracy through events |
| `TrackingManager.ts` | Hysteresis logic, signal degradation, pending exit processing |
| `reportIssue.ts` | Add GPS telemetry collection to app state snapshot |
| `App.tsx` | Startup cleanup of expired pending exits |
| `constants.ts` | Add threshold constants |

---

## Testing Strategy

1. **Unit tests for TrackingManager:**
   - Exit with good accuracy (<100m) → creates pending exit
   - Exit with poor accuracy (>100m) → ignored, logged with reason
   - Exit with degraded signal (>3x check-in) → ignored, logged with reason
   - Re-enter within 5 min → cancels pending exit
   - No re-enter after 5 min → confirms clock-out
   - Short session → kept with indicator (not deleted)

2. **Integration test:**
   - Simulate: enter → exit (poor accuracy) → should stay clocked in
   - Simulate: enter (10m accuracy) → exit (50m accuracy) → ignored (signal degradation)
   - Simulate: enter → exit (good accuracy) → wait 5 min → clocked out

3. **Device testing:**
   - Test at user's healthcare facility
   - Walk in, enter building, check behavior
   - Verify notifications appear correctly
   - **Use "Report Issue" to send telemetry data back for analysis**

---

## Verification

After implementation:

1. Run existing tests: `cd mobile-app && npm test`
2. Check database migration applies cleanly
3. Test on device:
   - Set up geofence around test location
   - Walk in → should clock in (accuracy recorded)
   - Enter building (GPS degrades) → should NOT clock out (signal degradation detected)
   - Wait inside for 5+ min → should still be clocked in
   - Walk outside with good GPS → should get "leaving" notification
   - Stay outside 5 min → should clock out
   - Walk back in within 5 min → should cancel pending exit
4. **Telemetry verification:**
   - Use "Report Issue" button
   - Check backend received `gps_telemetry` data
   - Analyze accuracy values to tune thresholds

---

## Parameter Tuning Workflow

After deployment to test user:

1. User uses app normally at healthcare facility
2. User presses "Report Issue" (can add note like "for GPS analysis")
3. Backend receives telemetry with:
   - All recent geofence events with accuracy values
   - Which events were ignored and why
   - Min/max/avg accuracy statistics
4. Analyze data to determine:
   - Is 100m threshold appropriate? (adjust if needed)
   - Is 3x degradation factor appropriate? (adjust if needed)
   - Are there patterns in false exits?

---

## Signal Degradation Detection Details

The signal degradation layer works by comparing exit accuracy to check-in accuracy:

| Check-in Accuracy | Exit Accuracy | Ratio | Result |
|-------------------|---------------|-------|--------|
| 10m | 15m | 1.5x | ✅ Allow exit |
| 10m | 25m | 2.5x | ✅ Allow exit |
| 10m | 35m | 3.5x | ❌ Ignore (degradation) |
| 10m | 100m | 10x | ❌ Ignore (degradation) |
| 20m | 50m | 2.5x | ✅ Allow exit |
| 20m | 80m | 4x | ❌ Ignore (degradation) |

This catches the specific scenario of:
- Good GPS at entrance → check-in with ~10m accuracy
- GPS degrades inside building → exit triggered with 50-100m accuracy
- Degradation factor (3x) catches this and ignores the exit
