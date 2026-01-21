# Geofence Exit Verification Plan

**Created:** 2025-01-18
**Status:** Planning

---

## Problem Statement

When a user exits a geofence, the app creates a "pending exit" and waits for another geofence event to confirm the clock-out. However, the clock-out never happens because:

1. `processPendingExits()` only runs when triggered by geofence events
2. Geofencing only fires on boundary crossings - no events occur while user is outside
3. After the exit event, no code runs to confirm the clock-out after 5 minutes

**Result:** Users stay "clocked in" indefinitely after leaving.

---

## Proposed Solution

**Discrete GPS checks via scheduled notifications:** Use battery-efficient geofencing for normal operation, but schedule a few quick GPS checks during the 5-minute uncertainty window to verify the user really left.

### Flow

```
Normal state (geofencing only)
       │
       ▼
   Exit event detected
       │
       ▼
   Create pending exit
   Schedule verification notifications (at 1, 3, 5 minutes)
       │
       ▼
   ┌─────────────────────────────────────┐
   │  Notification fires (1 min)         │
   │       │                             │
   │       ▼                             │
   │  Quick GPS check (1-2 seconds)      │
   │       │                             │
   │  Is user inside geofence?           │
   │     ├─ YES → Cancel pending exit    │
   │     │        Cancel remaining       │
   │     │        notifications          │
   │     │        Back to normal state   │
   │     │                               │
   │     └─ NO → Wait for next           │
   │              notification           │
   └─────────────────────────────────────┘
       │
       ▼ (repeats at 3 min, 5 min)
       │
       ▼
   ┌─────────────────────────────────────┐
   │  Final notification (5 min)         │
   │       │                             │
   │  Quick GPS check                    │
   │       │                             │
   │  Is user inside geofence?           │
   │     ├─ YES → Cancel pending exit    │
   │     │                               │
   │     └─ NO → Confirm clock-out       │
   │              Send "Clocked out"     │
   │              notification           │
   └─────────────────────────────────────┘
```

### Why This Works

- GPS only active for ~1-2 seconds per check (3 checks total)
- Minimal battery impact
- Blue location indicator only flashes briefly, not continuous
- Scheduled notifications are reliable on iOS
- No background location task running continuously

---

## Technical Design

### 1. Verification Service

**File:** `mobile-app/src/modules/geofencing/services/ExitVerificationService.ts` (new)

```typescript
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Notification identifiers for cancellation
const VERIFICATION_NOTIFICATION_IDS = [
  'exit-verify-1',
  'exit-verify-2',
  'exit-verify-3',
];

// Check intervals (minutes after exit)
const CHECK_INTERVALS_MINUTES = [1, 3, 5];

// Storage key for verification state
const VERIFICATION_STATE_KEY = 'EXIT_VERIFICATION_STATE';

interface VerificationState {
  sessionId: string;
  locationId: string;
  geofenceCenter: { latitude: number; longitude: number };
  geofenceRadius: number;
  pendingExitTime: string;  // ISO timestamp
  checkIndex: number;  // Which check we're on (0, 1, 2)
}
```

### 2. Scheduling Verification Checks

**Trigger:** In `TrackingManager.handleGeofenceExit()`, after creating pending exit:

```typescript
// After markPendingExit() - no user-visible notification
await ExitVerificationService.scheduleVerificationChecks({
  sessionId: activeSession.id,
  locationId: event.locationId,
  geofenceCenter: { latitude: location.latitude, longitude: location.longitude },
  geofenceRadius: location.radiusMeters,
  pendingExitTime: event.timestamp,
});
```

**Scheduling logic:**

```typescript
async function scheduleVerificationChecks(state: Omit<VerificationState, 'checkIndex'>) {
  // Save state for when notifications fire
  await AsyncStorage.setItem(VERIFICATION_STATE_KEY, JSON.stringify({
    ...state,
    checkIndex: 0,
  }));

  // Schedule silent notifications at 1, 3, 5 minutes
  for (let i = 0; i < CHECK_INTERVALS_MINUTES.length; i++) {
    await Notifications.scheduleNotificationAsync({
      identifier: VERIFICATION_NOTIFICATION_IDS[i],
      content: {
        // Silent notification - just triggers the handler
        title: '',
        body: '',
        data: { type: 'exit-verification', checkIndex: i },
        sound: false,
      },
      trigger: {
        seconds: CHECK_INTERVALS_MINUTES[i] * 60,
      },
    });
  }
}
```

### 3. Notification Handler

**In app initialization (e.g., App.tsx or geofencing setup):**

```typescript
Notifications.addNotificationReceivedListener(async (notification) => {
  const data = notification.request.content.data;

  if (data?.type === 'exit-verification') {
    await ExitVerificationService.handleVerificationCheck(data.checkIndex);
  }
});
```

### 4. Verification Check Logic

```typescript
async function handleVerificationCheck(checkIndex: number) {
  const stateJson = await AsyncStorage.getItem(VERIFICATION_STATE_KEY);
  if (!stateJson) {
    console.log('[ExitVerification] No pending verification');
    return;
  }

  const state: VerificationState = JSON.parse(stateJson);

  // Quick GPS check
  let location: Location.LocationObject;
  try {
    location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 5000,  // 5 second timeout
    });
  } catch (error) {
    console.error('[ExitVerification] GPS check failed:', error);
    // If GPS fails, continue to next check (don't clock out yet)
    return;
  }

  // Calculate distance from geofence center
  const distance = calculateDistance(
    location.coords.latitude,
    location.coords.longitude,
    state.geofenceCenter.latitude,
    state.geofenceCenter.longitude
  );

  // Confidence-based detection (accounts for GPS accuracy)
  const accuracy = location.coords.accuracy ?? 50;
  const radius = state.geofenceRadius;

  // Must be confident about location before taking action
  const isConfidentlyInside = (distance + accuracy) < radius;
  const isConfidentlyOutside = (distance - accuracy) > radius;
  const isUncertain = !isConfidentlyInside && !isConfidentlyOutside;

  console.log(`[ExitVerification] Check ${checkIndex + 1}: distance=${distance.toFixed(0)}m, accuracy=${accuracy.toFixed(0)}m, radius=${radius}m`);
  console.log(`[ExitVerification] → inside=${isConfidentlyInside}, outside=${isConfidentlyOutside}, uncertain=${isUncertain}`);

  if (isConfidentlyInside) {
    // User definitely returned - cancel pending exit
    console.log('[ExitVerification] User confidently inside geofence');
    await cancelVerification(state.sessionId, 'returned');
    return;
  }

  // Is this the final check (5 minutes)?
  const isFinalCheck = checkIndex === CHECK_INTERVALS_MINUTES.length - 1;

  if (isFinalCheck) {
    if (isConfidentlyOutside) {
      // Confirm clock-out - we're confident user is outside
      console.log('[ExitVerification] Final check - confidently outside, confirming clock-out');
      await confirmClockOut(state);
    } else {
      // Uncertain on final check - don't auto clock-out
      // Clear state and let fallback handle it (manual or app foreground)
      console.log('[ExitVerification] Final check - uncertain, skipping auto clock-out');
      await AsyncStorage.removeItem(VERIFICATION_STATE_KEY);
      // Pending exit remains in database - will be processed on next app foreground
    }
  } else {
    // Not final check - record confidence for potential future use
    await AsyncStorage.setItem(VERIFICATION_STATE_KEY, JSON.stringify({
      ...state,
      checkIndex: checkIndex + 1,
      lastConfidentlyOutside: isConfidentlyOutside,
    }));
  }
}
```

### 4a. Confidence Logic Explained

| Distance | Accuracy | Radius | Confidently Inside? | Confidently Outside? |
|----------|----------|--------|--------------------|--------------------|
| 150m | 20m | 100m | No (170m > 100m) | Yes (130m > 100m) |
| 150m | 100m | 100m | No (250m > 100m) | No (50m < 100m) |
| 50m | 20m | 100m | Yes (70m < 100m) | No (-) |
| 50m | 100m | 100m | No (150m > 100m) | No (-50m < 100m) |

**Rules:**
- `isConfidentlyInside`: Even at worst accuracy, still inside → cancel exit
- `isConfidentlyOutside`: Even at best accuracy, still outside → confirm clock-out
- `isUncertain`: Can't be sure → don't take irreversible action

### 5. Confirm Clock-Out

```typescript
async function confirmClockOut(state: VerificationState) {
  const db = await getDatabase();

  // Confirm the pending exit in database
  await db.confirmPendingExit(state.sessionId);

  // Get session details for notification
  const session = await db.getSession(state.sessionId);
  const location = await db.getLocation(state.locationId);
  const locationName = location?.name ?? 'Work Location';
  const durationMinutes = session?.durationMinutes ?? 0;

  // Clear verification state
  await AsyncStorage.removeItem(VERIFICATION_STATE_KEY);

  // Send clock-out notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Clocked Out',
      body: `Clocked out from ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
    },
    trigger: null,  // Immediate
  });

  // Notify listeners (Calendar refresh)
  trackingEvents.emit('tracking-changed');
}
```

### 6. Cancel Verification

```typescript
async function cancelVerification(sessionId: string, reason: 'returned' | 'manual' | 'geofence-reentry') {
  console.log(`[ExitVerification] Cancelling verification: ${reason}`);

  // Cancel all scheduled notifications
  for (const id of VERIFICATION_NOTIFICATION_IDS) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  // Clear state
  await AsyncStorage.removeItem(VERIFICATION_STATE_KEY);

  // If returned, cancel the pending exit in database
  if (reason === 'returned' || reason === 'geofence-reentry') {
    const db = await getDatabase();
    await db.cancelPendingExit(sessionId);
    trackingEvents.emit('tracking-changed');
  }
}
```

### 7. Geofence Re-entry Coordination

**In `TrackingManager.handleGeofenceEnter()`:**

```typescript
// When cancelling pending exit, also cancel verification
if (pendingSession) {
  await this.db.cancelPendingExit(pendingSession.id);
  await ExitVerificationService.cancelVerification(pendingSession.id, 'geofence-reentry');
  // ... rest of handler
}
```

### 8. Distance Calculation

```typescript
/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
```

---

## Edge Cases

### 1. Multiple Locations

**Scenario:** User exits Location A, pending exit created, then enters Location B.

**Handling:**
- `handleGeofenceEnter()` for Location B is a different location
- It won't cancel the pending exit for Location A
- Verification continues for Location A (checks against A's geofence)
- After 5 min, Location A clocks out
- Location B clocks in normally

**This is correct behavior** - user left A and went to B.

### 2. Rapid Exit/Re-entry

**Scenario:** GPS bounces cause exit, then immediate re-entry geofence event.

**Handling:**
- Exit creates pending exit + schedules verification notifications
- Re-entry (within seconds) triggers `handleGeofenceEnter()`
- Pending exit cancelled, verification notifications cancelled
- **Handled via `cancelVerification('geofence-reentry')`**

### 3. App Termination During Verification

**Scenario:** iOS kills app during the 5-minute verification window.

**Handling:**
- Scheduled notifications survive app termination
- When notification fires, iOS launches app briefly to handle it
- State is in AsyncStorage, survives restart
- Verification continues normally
- **This is a key advantage of using scheduled notifications**

### 4. Permission Revoked

**Scenario:** User revokes location permission during verification.

**Handling:**
- `getCurrentPositionAsync()` will fail
- Error is caught, verification continues to next check
- If all 3 checks fail due to permissions: no clock-out (safe default)
- User will need to manually clock out when they open app

### 5. No GPS Signal

**Scenario:** User is in area with no GPS (underground, airplane mode).

**Handling:**
- `getCurrentPositionAsync()` times out (5 second timeout)
- Error is caught, verification continues to next check
- If all 3 checks fail: no automatic clock-out
- User will need to manually clock out
- **Safe default:** Don't clock out if we can't verify location

### 6. Poor GPS Accuracy on All Checks

**Scenario:** All 3 GPS checks return high error margin (e.g., 100m+ accuracy).

**Handling:**
- Each check evaluates confidence: `isConfidentlyInside`, `isConfidentlyOutside`, `isUncertain`
- If uncertain on all checks: no automatic clock-out at 5 minutes
- Pending exit stays in database
- Processed on next app foreground via fallback
- **Safe default:** Don't take irreversible action without confidence

### 7. Notification Not Delivered

**Scenario:** iOS delays or fails to deliver scheduled notification.

**Handling:**
- Each check is independent - missing one check isn't fatal
- If 1-min check missed, 3-min and 5-min checks can still confirm clock-out
- Worst case: user opened app triggers `processPendingExits()` as fallback
- **Add fallback:** Call `processPendingExits()` on app foreground

### 8. User Manually Clocks Out During Verification

**Scenario:** User opens app and manually taps "Clock Out" while verification is pending.

**Handling:**
- Manual clock-out should cancel verification
- Add `cancelVerification(sessionId, 'manual')` to manual clock-out flow
- Prevents double clock-out notification

---

## Configuration

### Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `CHECK_INTERVALS_MINUTES` | [1, 3, 5] | 3 checks spread over 5 minutes |
| `GPS_TIMEOUT_MS` | 5000 | 5 seconds to get GPS fix |
| `Location.Accuracy.Balanced` | - | Good accuracy without excessive battery |

### GPS Check Settings

```typescript
await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,  // Good enough for geofence check
  timeout: 5000,  // 5 second timeout
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `services/ExitVerificationService.ts` | **NEW** - Verification scheduling and handling |
| `services/TrackingManager.ts` | Start verification on exit, cancel on re-entry/manual clock-out |
| `App.tsx` or notification setup | Add notification received listener |
| `screens/StatusScreen.tsx` | Add `processPendingExits()` call on focus (fallback) |

---

## Testing Plan

### Unit Tests
- [ ] `calculateDistance()` returns correct meters
- [ ] "Inside geofence" logic accounts for GPS accuracy correctly
- [ ] State serialization/deserialization in AsyncStorage works

### Integration Tests
- [ ] Exit → verification notifications scheduled
- [ ] Re-entry via geofence → verification cancelled, notifications cancelled
- [ ] Re-entry via GPS check → verification cancelled
- [ ] 5 minutes elapsed, still outside → confirms clock-out
- [ ] Manual clock-out during verification → verification cancelled
- [ ] GPS timeout → gracefully continues to next check

### Device Tests (Real Device Required)
- [ ] Notifications fire at correct intervals (1, 3, 5 min)
- [ ] GPS check works when notification fires in background
- [ ] Verification continues when app is backgrounded
- [ ] Verification continues when app is terminated
- [ ] Blue location indicator only shows briefly during GPS check
- [ ] Clock-out notification appears after 5 minutes
- [ ] Works in low-signal environment (indoors)

---

## Open Questions

1. **Silent notifications on iOS**
   - Can we schedule truly silent notifications (no banner, just trigger code)?
   - Need to test: `title: '', body: ''` with `sound: false`
   - May need to use background fetch as alternative if notifications can't be silent

2. **Notification permissions**
   - App already requests notification permissions
   - If denied, verification won't work - need fallback
   - Fallback: `processPendingExits()` on app foreground

---

## Implementation Order

1. Create `ExitVerificationService.ts` with scheduling logic
2. Add state storage (AsyncStorage) for verification state
3. Implement `scheduleVerificationChecks()` and `cancelVerification()`
4. Implement `handleVerificationCheck()` with GPS and distance logic
5. Add notification listener in App.tsx
6. Integrate into `TrackingManager` (start on exit, cancel on re-entry)
7. Add cancellation to manual clock-out flow
8. Add `processPendingExits()` fallback to StatusScreen
9. Test on real device
10. Handle edge cases

---

## Fallback Mechanism

Even with verification, add a simple fallback:

**In `StatusScreen.useFocusEffect()`:**
```typescript
useFocusEffect(
  useCallback(() => {
    loadAllData();
    checkBackgroundPermission();

    // Fallback: process any pending exits when user opens app
    processPendingExitsIfNeeded();
  }, [loadAllData])
);
```

This ensures pending exits eventually get processed even if:
- Notifications fail to deliver
- GPS checks all fail
- User denied notification permissions

---

## Rollback Plan

If issues arise:
1. Disable verification service (don't schedule notifications)
2. Keep only the fallback: `processPendingExits()` on app foreground
3. Not perfect (delayed clock-out), but functional as a stopgap

