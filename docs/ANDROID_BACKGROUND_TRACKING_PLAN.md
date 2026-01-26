# Android Background Tracking Reliability Plan

**Created:** 2026-01-22
**Status:** Planning

---

## Problem Statement

The geofencing and exit verification system was primarily designed and tested on iOS. Android has fundamentally different background execution constraints that may cause:

1. **Silent geofencing failures** if background location permission isn't properly obtained
2. **Missed verification checks** when app is killed or device enters Doze mode
3. **Delayed/missing clock-outs** due to notification delivery issues

These issues are largely invisible to users - tracking appears enabled but doesn't work reliably.

---

## Research Findings

### What's Working Well

| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| Two-step permission flow | ✅ | ✅ | Foreground first, then background |
| Settings guidance text | ✅ | ✅ | "Settings → Location → Always Allow" |
| Graceful degradation | ✅ | ✅ | App works in manual mode if denied |
| Geofence registration | ✅ | ✅ | expo-location handles both platforms |
| Foreground service config | N/A | ✅ | `isAndroidForegroundServiceEnabled: true` |

### Critical Gaps

| Issue | Severity | Platform | Root Cause |
|-------|----------|----------|------------|
| Verification when app killed | 🔴 Critical | Android | `addNotificationReceivedListener` requires app running |
| Doze mode delays | 🟠 High | Android | `TIME_INTERVAL` notifications subject to batching |
| No notification channel config | 🟡 Medium | Android | Default channel may lack proper priority |
| PermissionWarningBanner disabled | 🟡 Medium | Both | Users unaware tracking isn't working |
| Stale pending exits | 🟡 Medium | Both | No timeout for pending exits older than 24h |

---

## Risk Triage

### 🔴 Critical: Verification Fails When App Killed

**Current behavior:**
```
1. User exits geofence → pending exit created
2. Verification notifications scheduled (1, 3, 5 min)
3. Android kills app (normal behavior)
4. Notification fires, but no listener active
5. GPS check never runs
6. Clock-out stuck until user opens app
```

**Impact:** Defeats the entire verification system on Android. Users may have incorrect hours logged.

**iOS comparison:** iOS relaunches app briefly to handle scheduled notifications. Android does not for `TIME_INTERVAL` triggers.

### 🟠 High: Doze Mode Delays Notifications

**Current behavior:** Notifications scheduled with `TIME_INTERVAL` trigger type, which Android's Doze mode can delay by 15+ minutes.

**Impact:** The 5-minute hysteresis window becomes meaningless. User could return at minute 3, but notification fires at minute 20 → incorrect clock-out.

**Mitigation:** Geofence re-entry events have Play Services exemptions and should still cancel pending exits. Verification is a secondary safety net.

### 🟡 Medium: Missing Notification Channel

**Current behavior:** No explicit `setNotificationChannelAsync()` call. Uses expo-notifications defaults.

**Impact:** Notifications may be:
- Silenced by Do Not Disturb
- Delivered without waking device
- Lower priority than intended

### 🟡 Medium: Permission Warning Disabled

**Current behavior:** `StatusScreen.tsx` line 300:
```typescript
<PermissionWarningBanner visible={false /* !hasBackgroundPermission */} />
```

**Impact:** Users with denied background permission don't know automatic tracking isn't working.

### 🟡 Medium: Stale Pending Exits

**Current behavior:** Pending exits with no timeout. If user never opens app, pending exit stays forever.

**Impact:** Data integrity issues, confusing session history.

---

## Proposed Solutions

### Solution 1: Android WorkManager for Verification (Critical)

Replace scheduled notifications with WorkManager for Android verification checks. WorkManager is designed for deferrable background work and has better Doze exemptions.

**Approach:**
- Keep current notification-based system for iOS (works well)
- Add WorkManager-based verification for Android
- Platform-conditional in `ExitVerificationService.ts`

**Implementation:**
```typescript
// ExitVerificationService.ts
import { Platform } from 'react-native';

export async function scheduleVerificationChecks(params: ScheduleParams) {
  if (Platform.OS === 'android') {
    await scheduleAndroidWorkManager(params);
  } else {
    await scheduleIOSNotifications(params);
  }
}
```

**Android WorkManager approach:**
- Use `react-native-background-fetch` or `@react-native-async-storage/async-storage` + native WorkManager
- Schedule OneTimeWorkRequest with initial delay
- Chain 3 work requests (1, 3, 5 minutes)
- WorkManager survives app termination
- Has better Doze exemptions for location work

**Alternative:** expo-background-fetch with minimum interval (15 min on Android - too long for our use case).

**Recommended package:** `react-native-background-actions` or direct WorkManager via `react-native-workmanager`.

### Solution 2: Extend Geofence Task for Pending Exit Processing

The geofence background task (`expo-task-manager`) is already always running and has OS exemptions. Extend it to also check for expired pending exits.

**Implementation:**
```typescript
// GeofenceService.ts - defineBackgroundTask
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  // Existing geofence handling...

  // Additionally, check for expired pending exits
  // This runs whenever ANY geofence event fires
  const trackingManager = new TrackingManager(await getDatabase());
  await trackingManager.processPendingExits();
});
```

**Limitation:** Only runs on geofence events, not on a timer. Better than nothing, but doesn't solve the core issue.

### Solution 3: High-Priority Notification Channel (Medium)

Create explicit Android notification channel with high importance.

**Implementation:**
```typescript
// In App.tsx initialization
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('tracking', {
    name: 'Work Tracking',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null, // Silent for verification
    vibrationPattern: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false, // Don't be too aggressive
  });

  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Clock In/Out Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250],
  });
}
```

Use `channelId: 'tracking'` for verification notifications, `channelId: 'alerts'` for clock-in/out notifications.

### Solution 4: Enable Permission Warning Banner (Medium)

Re-enable the disabled warning banner to inform users when tracking isn't working.

**Implementation:**
```typescript
// StatusScreen.tsx line 300
<PermissionWarningBanner visible={!hasBackgroundPermission} />
```

Consider adding a link to PermissionsScreen for easy remediation.

### Solution 5: Pending Exit Timeout (Medium)

Auto-confirm pending exits older than 24 hours with a flag for review.

**Implementation:**
```typescript
// Database.ts
async confirmStalePendingExits(maxAgeHours: number = 24): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const stale = await this.db.getAllAsync(
    `SELECT * FROM tracking_sessions WHERE state = 'pending_exit' AND pending_exit_at < ?`,
    cutoff
  );

  for (const session of stale) {
    await this.db.runAsync(
      `UPDATE tracking_sessions
       SET state = 'completed', clock_out = pending_exit_at,
           duration_minutes = ?, notes = 'Auto-confirmed (stale)', updated_at = ?
       WHERE id = ?`,
      /* calculate duration */,
      new Date().toISOString(),
      session.id
    );
  }

  return stale.length;
}
```

Call from `processPendingExits()` or on app startup.

### Solution 6: Request Battery Optimization Exemption (Optional)

Guide users to exempt the app from battery optimization on Android.

**Implementation:**
- Add info in PermissionsScreen explaining battery optimization
- Provide button to open battery settings: `Linking.openSettings()` or `IntentLauncher.startActivityAsync(IntentLauncher.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)`
- Don't require it - just inform and offer

**Caution:** Google Play policy restricts requesting `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission. Only guide users to settings manually.

---

## Implementation Priority

| Priority | Solution | Effort | Impact |
|----------|----------|--------|--------|
| 1 | Solution 4: Enable permission warning | Low | Immediate UX improvement |
| 2 | Solution 3: Notification channel | Low | Better notification delivery |
| 3 | Solution 5: Pending exit timeout | Low | Data integrity |
| 4 | Solution 2: Extend geofence task | Medium | Partial verification improvement |
| 5 | Solution 1: WorkManager verification | High | Full Android reliability |
| 6 | Solution 6: Battery exemption guidance | Low | User education |

**Recommended approach:** Start with solutions 4, 3, 5 (all low effort), then evaluate if Solution 1 is needed based on real-world Android testing.

---

## Files to Modify

| File | Changes |
|------|---------|
| `screens/StatusScreen.tsx` | Enable PermissionWarningBanner (Solution 4) |
| `App.tsx` | Add notification channel setup (Solution 3) |
| `services/Database.ts` | Add `confirmStalePendingExits()` (Solution 5) |
| `services/TrackingManager.ts` | Call stale exit cleanup (Solution 5) |
| `services/GeofenceService.ts` | Extend background task (Solution 2) |
| `services/ExitVerificationService.ts` | Platform-conditional verification (Solution 1) |
| `screens/PermissionsScreen.tsx` | Battery optimization guidance (Solution 6) |

---

## Testing Plan

### Permission Flow Testing

- [ ] Android 10: Verify two-step permission request works
- [ ] Android 11+: Verify user is guided to Settings for "Allow all the time"
- [ ] Verify warning banner appears when background permission denied
- [ ] Verify geofence doesn't register without background permission

### Notification Testing

- [ ] Verify notification channel created on Android startup
- [ ] Verify verification notifications use correct channel
- [ ] Verify clock-in/out notifications use correct channel
- [ ] Test notification delivery with Do Not Disturb enabled

### Background Execution Testing

- [ ] Kill app during pending exit, verify behavior on next app open
- [ ] Leave phone idle (Doze) during verification window, observe timing
- [ ] Test with battery saver enabled
- [ ] Verify foreground service notification appears during active tracking

### Data Integrity Testing

- [ ] Create pending exit, don't open app for 24h, verify auto-confirmation
- [ ] Verify stale exits are flagged for user review

---

## Open Questions

1. **WorkManager integration:** Which package to use? Options:
   - `react-native-background-actions` - maintained, good docs
   - `react-native-workmanager` - direct WorkManager access
   - Custom native module - most control, most effort

2. **Foreground service notification:** Does expo-location show a visible notification when `isAndroidForegroundServiceEnabled: true`? Need to verify on device.

3. **Geofence reliability on Android:** How reliable is Google Play Services geofencing in practice? May need to adjust radius or add location polling fallback.

4. **Battery impact:** Will WorkManager verification + geofencing + foreground service drain battery noticeably? Need real-world testing.

---

## Success Criteria

1. **Permission clarity:** Users always know if tracking is active or not
2. **Clock-out reliability:** 95%+ of exits result in correct clock-out within 10 minutes
3. **No stale data:** No pending exits older than 24 hours
4. **Battery acceptable:** <5% additional daily battery drain from tracking

---

## Rollback Plan

If Android WorkManager causes issues:
1. Disable WorkManager verification (keep notification-based)
2. Rely on fallback: `processPendingExits()` on app foreground
3. Clearly communicate to users that clock-out may be delayed until app is opened

---

## Related Documents

- `docs/GEOFENCE_VERIFICATION_PLAN.md` - Original verification design (iOS-focused)
- `docs/ANDROID_BUILD_PLAN.md` - Android build configuration
- `docs/ANDROID_GESTURE_FIX_PLAN.md` - Platform-specific gesture handling (pattern reference)
- `mobile-app/ARCHITECTURE.md` - Mobile app architecture
- `archive/GEOFENCE_HYSTERESIS_PLAN.md` - Exit hysteresis design
