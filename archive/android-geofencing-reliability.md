# Android Geofencing Reliability — Planning Document

**Date:** 2026-04-09
**Branch:** `fix/android-bugs-2026-03-31`
**Status:** Planning
**Device:** Samsung Galaxy A14 (SM-A145F), Android 15, One UI
**Expo SDK:** 54, expo-location 19.0.8

---

## Problem Statement

### What happened

On 2026-04-03, the Android app auto-clocked-in at the "Home" geofence via `geofence_auto`. The user left the geofence but was never clocked out. The session remained in `state='active'` for 5+ days (120+ hours).

### Evidence from on-device SQLite database

**Active session (never clocked out):**
```
id:                ddf9ce9b-a70c-4001-a067-452b21780edc
location:          Home (a5378c26-9f7c-4dea-9549-ccbc0de67443)
clock_in:          2026-04-03T15:55:38.490Z
clock_out:         NULL
state:             active
checkin_accuracy:  200m
tracking_method:   geofence_auto
```

**Geofence events timeline:**
- Last geofence events recorded: **2026-04-04 ~15:00 UTC**
- Events after that: **zero** — complete silence for 5 days
- Many exit events on April 4 logged as `ignored: true, ignore_reason: 'no_session'` (exits for locations without active sessions)
- No exit event was ever received for the Home location after clock-in

**Conclusion:** Samsung's battery optimization killed the app process after April 4. The OS stopped delivering geofence PendingIntents entirely. The geofence exit was never detected, so the session never reached `pending_exit` state, so the `processPendingExits()` foreground fallback couldn't help either.

### Root cause: Android OEM battery optimization

Android OEMs (Samsung, Xiaomi, Huawei) aggressively kill background processes beyond stock Android's Doze mode. Samsung is rated **5/5 severity** on dontkillmyapp.com.

The current architecture uses `expo-location`'s `startGeofencingAsync`, which registers geofences with Android's `GeofencingClient` and handles events via `expo-task-manager`. This does **not** run a foreground service, meaning:

1. The app process has no elevated priority
2. The OS considers it expendable and kills it
3. Geofence PendingIntents may be suppressed or delayed by OEM battery management
4. Once the process is dead, no geofence events are received — neither enter nor exit

This affects both directions:
- **Exit detection** (the observed bug): user leaves but no clock-out
- **Enter detection** (same risk): user arrives at work but no clock-in

### Why the existing fallbacks didn't help

The app has a multi-layer defense for exit detection:

| Layer | What it does | Why it didn't help |
|-------|-------------|-------------------|
| GPS accuracy filtering | Ignores exits with poor accuracy | No exit event was received at all |
| Signal degradation check | Compares exit vs check-in accuracy | No exit event was received at all |
| Exit hysteresis (5 min) | Schedules verification checks | Never triggered — no exit event |
| `processPendingExits()` on foreground | Confirms stale pending exits | Session was `active`, not `pending_exit` |
| `confirmStalePendingExits(24h)` | Auto-confirms old pending exits | Session was `active`, not `pending_exit` |

All fallbacks assume the OS delivers the initial geofence event. When the OS doesn't deliver it, every layer fails silently.

---

## Solution: Foreground Service Keep-Alive

### Overview

Run an always-on Android foreground service via `expo-location`'s `startLocationUpdatesAsync` with the `foregroundService` option. This creates a persistent notification, which gives the app process elevated priority that Samsung/OEMs respect. The foreground service acts purely as a keep-alive — the actual geofence detection continues to use `startGeofencingAsync`.

Samsung One UI 6+ explicitly guarantees that apps with foreground services following Android 14's API policy will not be killed.

### How it works

```
App starts (or device reboots)
  │
  ├─ startGeofencingAsync(regions)           ← existing, unchanged
  │    Registers geofences with Android's GeofencingClient
  │
  └─ startLocationUpdatesAsync(...)          ← NEW
       Starts foreground service with persistent notification:
       "Open Working Hours — Monitoring work locations"
       │
       │  Config: Accuracy.Low, distanceInterval=1000m, interval=5min
       │  Minimal battery impact — cell/WiFi only, no GPS
       │  The callback is a no-op (or periodic health check, TBD)
       │
  ┌────┴── Process is ALIVE — Samsung won't kill it ──────────────┐
  │                                                                │
  │  User goes to work:                                            │
  │    OS detects geofence ENTER → PendingIntent delivered         │
  │    → Process is alive, event handled immediately               │
  │    → TrackingManager.handleGeofenceEnter() → clock in          │
  │    → Transient notification: "Clocked In at Hospital"          │
  │                                                                │
  │  User leaves work:                                             │
  │    OS detects geofence EXIT → PendingIntent delivered          │
  │    → Process is alive, event handled immediately               │
  │    → TrackingManager.handleGeofenceExit() → hysteresis check   │
  │    → ExitVerificationService runs verification                 │
  │    → Transient notification: "Clocked Out. Worked 8h 15m."    │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

### What changes, what doesn't

| Component | Change |
|-----------|--------|
| `startLocationUpdatesAsync` with foreground service | **NEW** — keep-alive mechanism |
| `startGeofencingAsync` | Unchanged — still handles geofence registration |
| `TrackingManager` | Unchanged — still handles enter/exit events |
| `ExitVerificationService` | Unchanged — still handles hysteresis verification |
| `GeofenceService` | Minor change — starts/stops foreground service alongside geofencing |
| Transient notifications (clock-in/out/short session) | Unchanged |
| `BOOT_COMPLETED` receiver | **NEW** — restarts service after reboot |
| Battery optimization prompt | **NEW** — guides user to exempt app |
| OEM-specific guidance | **NEW** — Samsung/Xiaomi/Huawei instructions |
| iOS code | No changes |

---

## Implementation Details (initial draft — SUPERSEDED)

> **Note:** This section contains the initial implementation draft from before source-code research
> and two review rounds. It is kept for historical context only.
> **For the current implementation plan, see "Phase 1 — Detailed Implementation Plan" below.**
>
> Key differences from this draft:
> - iOS-only options (`pausesUpdatesAutomatically`, `showsBackgroundLocationIndicator`) removed
> - `Accuracy.Low` → `Accuracy.Lowest`
> - Notification text changed to German ("Automatische Zeiterfassung aktiv")
> - Start/stop decoupled from GeofenceService lifecycle (foreground-only constraint)
> - `hasStartedLocationUpdatesAsync` guard removed (idempotent start)
> - Permission check added before starting
> - `syncKeepaliveState()` policy function replaces scattered start/stop logic

### 2. BOOT_COMPLETED Receiver

**Problem:** After device reboot, the foreground service is dead and geofences are de-registered. The user would need to open the app to restore monitoring.

**Solution:** Register a `BOOT_COMPLETED` broadcast receiver that restarts the app's background services.

**Implementation approach:** Expo config plugin that:
1. Adds `RECEIVE_BOOT_COMPLETED` permission to AndroidManifest.xml
2. Registers a `BroadcastReceiver` for `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED` intents
3. The receiver starts the expo-task-manager headless JS task, which re-registers geofences and starts the foreground service

**Files to create:**
- `mobile-app/plugins/withBootReceiver.js` — Expo config plugin
- `mobile-app/android/app/src/main/java/.../BootReceiver.java` (or generated by plugin)

**Complexity note:** This is the most complex part of the implementation because it requires native Android code via an Expo config plugin. The receiver needs to:
1. Start the React Native runtime in headless mode
2. Wait for the database to initialize
3. Load active locations
4. Register geofences
5. Start the foreground service

Alternative (simpler but less reliable): Skip the boot receiver and accept that the user must open the app once after reboot. The app already re-registers geofences on startup (`App.tsx:143-155`). The foreground service would start at the same time.

**Recommendation:** Start with the simpler approach (no boot receiver). Add it later if users report issues after reboots. The foreground service is the high-impact fix; the boot receiver is incremental.

### 3. Battery Optimization Prompt

**When:** During initial setup flow (after location permissions are granted), and on app foreground if battery optimization was re-enabled (OTA updates can reset it).

**How:** Use `expo-intent-launcher` to open the system battery optimization settings page:

```typescript
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

// Check current status
import { NativeModules } from 'react-native';
// Note: expo-location doesn't expose PowerManager.isIgnoringBatteryOptimizations()
// We may need a small native module or config plugin for this check.

// Open settings (Play Store safe — uses ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
if (Platform.OS === 'android') {
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
  );
}
```

**Play Store policy:** `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` (opens settings page) is safe. `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (shows direct dialog) may trigger review. We use the settings page approach.

**Files to modify:**
- `PermissionsScreen.tsx` or `SetupScreen.tsx` — add battery optimization step
- Possibly a new `BatteryOptimizationService.ts` for the check/prompt logic

**Open question:** Checking `isIgnoringBatteryOptimizations()` requires either:
- A small Expo config plugin / native module that exposes `PowerManager.isIgnoringBatteryOptimizations()`
- Or a third-party library like `react-native-battery-optimization-check`

Need to evaluate which approach is simpler and more maintainable.

### 4. OEM-Specific Guidance

**Detection:** Use `expo-device` or `Platform.constants` to detect the device manufacturer.

**UI:** Show a one-time guidance screen (dismissable, with "don't show again" option) specific to the detected OEM:

| Manufacturer | Guidance |
|-------------|----------|
| Samsung | Settings > Battery > Background usage limits > Never sleeping apps > Add Open Working Hours |
| Xiaomi | Settings > Apps > Manage apps > Open Working Hours > Autostart > Enable |
| Huawei | Settings > Battery > App Launch > Open Working Hours > Manage manually > Enable all toggles |
| Others | Link to dontkillmyapp.com/{manufacturer} |

**Files to create:**
- `mobile-app/src/modules/geofencing/components/BatteryOptimizationGuide.tsx`
- Or integrate into existing `PermissionsScreen.tsx`

**Storage:** Use AsyncStorage to track whether the user has dismissed the guidance.

---

## Risks and Mitigations

### R1: `startLocationUpdatesAsync` behavior on Android 12+ background start restriction

**Risk:** Android 12+ prohibits starting foreground services from the background. If the app process is killed (despite the foreground service) and restarted by a geofence PendingIntent, calling `startLocationUpdatesAsync` from that background context will throw a `SecurityException`.

**Mitigation:** The foreground service is started during app initialization (foreground context), not from the geofence callback. If the process is killed and the geofence fires, the geofence task runs in a limited background context — it can handle the event but cannot restart the foreground service. The foreground service resumes next time the user opens the app. This is acceptable because: (a) the foreground service makes process kills very unlikely, and (b) Samsung One UI 6+ guarantees foreground services survive.

**Severity:** Medium. Affects edge case where the foreground service itself is killed.

### R2: Expo SDK upgrade compatibility

**Risk:** expo-location's foreground service API could change in future SDK versions. The `foregroundService` option in `startLocationUpdatesAsync` is stable but not guaranteed across major SDK bumps.

**Mitigation:** Pin expo-location version. Test foreground service behavior on each SDK upgrade before merging. The API has been stable since Expo SDK 49.

**Severity:** Low. Expo's location API is mature and well-documented.

### R3: Play Store review for FOREGROUND_SERVICE_LOCATION

**Risk:** Google Play scrutinizes apps using `FOREGROUND_SERVICE_LOCATION`. The app must justify why always-on background location is needed.

**Mitigation:** The app.json already declares `isAndroidForegroundServiceEnabled: true` and `isAndroidBackgroundLocationEnabled: true`, which add the required manifest permissions. The Play Store listing must explain that the app uses geofencing for automatic work time tracking (legitimate use case per Google's policy). Include a clear privacy policy explaining what location data is collected and that it stays on-device.

**Severity:** Medium. Requires attention during Play Store submission but is a standard pattern for time-tracking apps.

### R4: User perception — "always tracking me"

**Risk:** Healthcare workers who chose this app for privacy may be concerned by a persistent "location" notification. This could undermine the app's privacy-first positioning.

**Mitigation:**
- Notification text emphasizes monitoring, not tracking: "Monitoring work locations" (not "Tracking your location")
- The Settings/Permissions screen should explain why the notification exists and that location data stays on-device
- The notification is Android-only; iOS users are unaffected
- Consider adding a "Why this notification?" link in the notification that opens an in-app explanation

**Severity:** Medium. Important to get the messaging right.

### R5: Battery drain perception

**Risk:** Users may blame the persistent location notification for battery drain, even though `Accuracy.Low` with large intervals uses negligible power.

**Mitigation:** Use the lowest possible accuracy (`Accuracy.Low` — cell/WiFi triangulation, no GPS). Set large `distanceInterval` (1000m) and `deferredUpdatesInterval` (300s). This makes the foreground service essentially a no-op in terms of power consumption. If users report battery concerns, provide data from Android's battery usage screen showing minimal impact.

**Severity:** Low. `Accuracy.Low` with large intervals is documented to have negligible battery impact.

### R6: Notification channel disabled by user

**Risk:** On Android 13+, users can long-press a notification to disable the channel. If the foreground service notification channel is disabled, the notification becomes invisible. On some Android versions, this can cause the system to demote the service priority, potentially leading to it being killed.

**Mitigation:** Check notification channel status on app foreground. If the channel is disabled, show an in-app warning explaining that the notification is required for reliable tracking. This is a rare edge case since most users won't disable the notification they were just guided to accept.

**Severity:** Low.

### R7: Expo config plugin complexity for BOOT_COMPLETED receiver

**Risk:** The boot receiver requires native Android code (Java/Kotlin BroadcastReceiver) injected via an Expo config plugin. This adds maintenance burden and must be tested across Expo SDK upgrades.

**Mitigation:** **Defer the boot receiver to a later iteration.** The foreground service alone solves 90%+ of the problem. After reboot, the user opens the app once and monitoring resumes. Only implement the boot receiver if users report frequent issues after reboots.

**Severity:** Low (if deferred).

---

## Implementation Order

### Phase 1: Foreground service (highest impact)

1. Define `LOCATION_KEEPALIVE_TASK_NAME` in constants
2. Define the keepalive task at module top level (alongside geofence task)
3. Add `startForegroundService()` / `stopForegroundService()` methods to `GeofenceService.ts`
4. Call `startForegroundService()` in `App.tsx` after geofence registration, gated by `Platform.OS === 'android'`
5. Build a debug APK and test on Samsung Galaxy A14
6. Verify: kill app from recents, wait, cross geofence boundary → event should still be delivered

### Phase 2: Battery optimization prompt

1. Add battery optimization check (research: native module vs. library)
2. Add prompt to setup/permissions flow
3. Add foreground health check (re-prompt if optimization was re-enabled)

### Phase 3: OEM guidance

1. Detect manufacturer via `expo-device`
2. Create guidance component with OEM-specific instructions
3. Show on first setup, with "don't show again" option

### Phase 4: Boot receiver (deferred)

1. Only implement if Phase 1-3 prove insufficient
2. Expo config plugin + native BroadcastReceiver
3. Headless JS task for re-registration

---

## Testing Plan

### Manual testing on Samsung Galaxy A14

1. **Basic foreground service:**
   - Start app → verify persistent notification appears
   - Swipe app from recents → verify notification persists
   - Wait 30 minutes → verify notification still visible
   - Check `adb logcat -s ReactNativeJS` for keepalive task logs

2. **Geofence enter with foreground service:**
   - Be outside a geofence
   - Walk/drive into the geofence
   - Verify clock-in notification and session creation
   - Check `geofence_events` table for enter event

3. **Geofence exit with foreground service:**
   - Be inside a geofence with active session
   - Walk/drive out of the geofence
   - Verify hysteresis check runs (logcat)
   - Verify clock-out notification after 5 minutes

4. **Overnight survival:**
   - Start app with foreground service at end of day
   - Leave phone on charger overnight
   - Next morning: verify notification is still present
   - Trigger a geofence event → verify it's received

5. **Battery impact:**
   - Run foreground service for 24 hours
   - Check Android battery usage screen for the app
   - Document mAh consumption

### Regression testing

- Existing E2E tests (48/48 iOS, 45/48 Android) should still pass — no changes to UI or geofence logic
- TrackingManager unit tests should still pass — no changes to enter/exit handling
- Manual test: iOS app should be completely unaffected

---

## Appendix: Current Architecture Reference

### Files involved in geofencing

| File | Role |
|------|------|
| `App.tsx` | Initialization: defines background task, registers geofences, processes pending exits |
| `GeofenceService.ts` | Singleton: register/unregister geofences, define background task, permission checks |
| `TrackingManager.ts` | Handles enter/exit events: clock-in/out, hysteresis, notifications |
| `ExitVerificationService.ts` | Schedules silent GPS checks at 1/3/5 min after exit, confirms or cancels |
| `Database.ts` | SQLite: sessions, events, locations, pending exit state management |
| `constants.ts` | `GEOFENCE_TASK_NAME` |

### Current notification channels

| Channel ID | Name | Sound | Used for |
|-----------|------|-------|----------|
| `alerts` | Clock In/Out Alerts | Default + vibration | Clock-in, clock-out, short session notifications |
| `tracking` | Work Tracking | Silent | Exit verification checks (invisible to user) |
| (new) | expo-location internal | Silent | Foreground service notification |

### Current permissions in app.json

```json
"plugins": [
  ["expo-location", {
    "locationAlwaysAndWhenInUsePermission": "...",
    "isAndroidBackgroundLocationEnabled": true,       // ← adds ACCESS_BACKGROUND_LOCATION
    "isAndroidForegroundServiceEnabled": true          // ← adds FOREGROUND_SERVICE + FOREGROUND_SERVICE_LOCATION
  }]
]
```

Both required permissions are already declared. No app.json changes needed for the foreground service.

### Key constants (TrackingManager.ts)

```
EXIT_HYSTERESIS_MINUTES = 5
IMMEDIATE_EXIT_ACCURACY_THRESHOLD = 50m
GPS_ACCURACY_THRESHOLD = 100m
DEGRADATION_FACTOR = 3
EVENT_COOLDOWN_MS = 10000
STALE_PENDING_EXIT_MINUTES = 10
```

---

## Review Addendum (2026-04-09): Plan Corrections and Recommended Trade-offs

This addendum captures post-review adjustments before implementation begins. It does not change the core goal (Android geofencing reliability), but it tightens sequencing and reduces technical risk.

### A. Add a new Phase 0 before Phase 1

**Fix:** Add a prerequisite phase to harden task wiring and test baseline.

1. Move `TaskManager.defineTask(...)` definitions to module/global scope (not inside app initialization flow).
2. Ensure task handlers remain available for headless/background launches.
3. Fix current failing geofencing unit test baseline before layering foreground service logic.

**Reasoning (trade-off):**
- Slight upfront delay.
- Large reliability gain and lower debugging cost.
- Without this, the app can still miss events in killed-process/headless scenarios even after adding a foreground service.

### B. Keep foreground service as highest-impact fix, with implementation corrections

**Fix:** Keep the foreground-service strategy, but update details:

1. Use `startLocationUpdatesAsync` only as keepalive, Android only.
2. Configure `foregroundService.killServiceOnDestroy: false` for recents-removal resilience.
3. Do not rely on iOS-only options (`pausesUpdatesAutomatically`, `showsBackgroundLocationIndicator`) for Android behavior.

**Reasoning (trade-off):**
- Strong reliability improvement on Samsung/OEM devices.
- Cost is persistent notification and some user perception risk.
- Best reliability-per-complexity option available in the current stack.

### C. Keep battery prompt and OEM guidance as soft reliability multipliers

**Fix:** Keep P2 and P3, but ensure they remain optional, one-time, and non-blocking.

1. Battery optimization: guide user to settings page, do not hard-block onboarding.
2. OEM guidance: show only for aggressive OEMs (Samsung/Xiaomi/Huawei), dismissable, remember dismissal.

**Reasoning (trade-off):**
- Small UI complexity increase.
- Meaningful reduction in real-world support cases.
- Avoids harming onboarding conversion with mandatory extra steps.

### D. Keep boot receiver deferred with stricter criteria

**Fix:** Continue deferring Phase 4; treat as conditional native work.

1. Only pursue if post-Phase-3 telemetry/support data shows reboot-related misses are significant.
2. Assume Expo headless JS alone may not be enough for reliable restart of Android location foreground service from background context.
3. If implemented, plan for native Android ownership and maintenance.

**Reasoning (trade-off):**
- Boot receiver path has highest complexity and maintenance burden.
- Premature implementation risks slow iteration and brittle platform behavior.
- Deferring preserves momentum while addressing the highest-value fixes first.

### E. Revised implementation order (recommended)

0. **Phase 0 (new):** task-definition hardening + geofencing test baseline cleanup.
1. **Phase 1:** foreground service keepalive.
2. **Phase 2:** battery optimization guidance prompt.
3. **Phase 3:** OEM-specific guidance UI.
4. **Phase 4 (deferred):** boot receiver only if production evidence justifies it.

### F. Decision policy for first release of this fix

1. Prioritize reliability-per-complexity over completeness.
2. Prefer reversible app-layer changes before native lifecycle changes.
3. Ship P0+P1 first, validate on Samsung overnight and boundary-crossing tests, then decide whether P2/P3 need iteration before broader rollout.

---

## Phase 0 — Completed (2026-04-09)

### Changes made

**Task 1 — Fix 10 failing geofencing unit tests:**
- `src/lib/test-db-mock.ts`: `runAsync()` now returns `{ changes: number }` instead of `void`, matching real expo-sqlite behavior. Also handles bulk UPDATE for `confirmStalePendingExits`.
- `src/modules/geofencing/__tests__/TrackingManager.test.ts`: Fixed "leaving notification" test (was expecting a "Leaving work area" notification that the code never sends — replaced with assertion that hysteresis path marks pending exit without user notification). Fixed "cancel pending exit on re-enter" test (exit event timestamp now >10s old to avoid the `EVENT_COOLDOWN_MS` debounce window).

**Task 2 — Move TaskManager.defineTask to module scope:**
- `App.tsx`: Geofence background task (`GEOFENCE_TASK_NAME`) now defined at module scope via `TaskManager.defineTask(...)`, outside the React component. GPS active-fetch logic moved from `GeofenceService.defineBackgroundTask()` into the module-scope handler. Handler lazily creates a `TrackingManager` for headless launches, or reuses `globalTrackingManager` when the app is running in the foreground.

**Test results:** 50/50 geofencing tests pass. 5/5 unit test suites pass (9 E2E suites fail as expected — they require a device).

---

## Phase 1 — Detailed Implementation Plan: Foreground Service Keepalive

### Research findings (expo-location v19.0.8 source code analysis)

The following was verified by reading the native Kotlin/Java source in `node_modules/expo-location/android/`:

| Question | Answer |
|----------|--------|
| `defineTask` placement | Must be at module scope. Multiple calls OK (Map-backed). |
| `killServiceOnDestroy: false` | Default is `false`. Service survives swipe-from-recents (`onTaskRemoved` becomes no-op). Service returns `START_REDELIVER_INTENT` so Android re-delivers intent if killed for memory. |
| Multiple `startLocationUpdatesAsync` calls | Safe. Updates options in-place, restarts location provider + notification. Does not throw. |
| Permission revoked at runtime | Service keeps running (no crash), but no location data delivered. No auto-cleanup or listener. |
| Battery: `Accuracy.Low` + 1000m | Maps to `PRIORITY_BALANCED_POWER_ACCURACY` — cell/WiFi only, no GPS activation. Minimal battery impact. |
| Notification | `IMPORTANCE_LOW` channel (no sound/vibration), non-dismissible while service runs. Channel ID is `"appScope:taskName"`. Cannot customize channel from JS. |
| `hasStartedLocationUpdatesAsync` | Exists. Returns boolean. Checks if task has a `LocationTaskConsumer`. |
| Android 14/15 | Must declare `FOREGROUND_SERVICE_LOCATION` (already in app.json config). **Must call `startLocationUpdatesAsync` from foreground context** — background start throws `ForegroundServiceStartNotAllowedException`. |

### Critical constraint: foreground-only start

`startLocationUpdatesAsync` with `foregroundService` **cannot be called from a background/headless context** on Android 12+. The native code checks `AppForegroundedSingleton.isForegrounded` and throws if false.

This means:
- The service starts when the user opens the app (foreground)
- If the process is killed and restarted headlessly (geofence PendingIntent), we **cannot restart the foreground service** from that context
- The geofence event will still be handled (the module-scope task handler from Phase 0 handles it), but the keepalive service won't be running until the user opens the app again
- With `killServiceOnDestroy: false` + `START_REDELIVER_INTENT`, the OS will try to restart the service itself, but this is not guaranteed on aggressive OEMs

**Implication:** The foreground service is a best-effort keepalive. It prevents most process kills, but cannot guarantee restart from background. This is acceptable — it's a major improvement over the current situation (zero protection).

### Implementation plan

#### 1. New constant: `LOCATION_KEEPALIVE_TASK_NAME`

**File:** `src/modules/geofencing/constants.ts`

```typescript
export const LOCATION_KEEPALIVE_TASK_NAME = 'LOCATION_KEEPALIVE';
```

#### 2. Define keepalive task at module scope

**File:** `App.tsx` (alongside the existing geofence task definition)

The keepalive task callback is a no-op. It exists only to give the foreground service a reason to run. We don't need to process the location updates.

```typescript
TaskManager.defineTask(LOCATION_KEEPALIVE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[LocationKeepalive] Task error:', error);
    return;
  }
  // No-op: this task exists only to keep the foreground service alive.
  // Geofence detection is handled by GEOFENCE_TASK_NAME.
});
```

#### 3. New service module: `ForegroundKeepaliveService.ts`

**File:** `src/modules/geofencing/services/ForegroundKeepaliveService.ts`

Encapsulates start/stop/status logic for the foreground service. Android-only.

```typescript
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { LOCATION_KEEPALIVE_TASK_NAME } from '../constants';
import { getGeofenceService } from './GeofenceService';
import { getDatabase } from './Database';

/**
 * Single policy function that ensures the keepalive service state matches
 * the app's current conditions. Call from any foreground context.
 *
 * Policy: service should run IFF all of:
 *   1. Platform is Android
 *   2. Background location permission is granted
 *   3. At least one active location exists
 *
 * If conditions are met → start (idempotent).
 * If conditions are NOT met → stop (if running).
 *
 * MUST be called from foreground context (Android 12+ restriction).
 */
export async function syncKeepaliveState(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const shouldRun = await shouldKeepaliveRun();

  if (shouldRun) {
    await startKeepalive();
  } else {
    await stopKeepalive();
  }
}

/**
 * Evaluate whether the keepalive service should be running.
 */
async function shouldKeepaliveRun(): Promise<boolean> {
  const geofenceService = getGeofenceService();
  const hasBackgroundPerm = await geofenceService.hasBackgroundPermissions();
  if (!hasBackgroundPerm) return false;

  const db = await getDatabase();
  const locations = await db.getActiveLocations();
  return locations.length > 0;
}

/**
 * Start the foreground keepalive service.
 * Safe to call multiple times — updates options in-place (idempotent).
 *
 * IMPORTANT: Does NOT guard on hasStartedLocationUpdatesAsync().
 * That API reflects task *registration* (persisted in SharedPreferences),
 * not whether the foreground service process is actually alive.
 * Always calling startLocationUpdatesAsync ensures the service is genuinely running.
 */
async function startKeepalive(): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_KEEPALIVE_TASK_NAME, {
    accuracy: Location.Accuracy.Lowest,     // PRIORITY_LOW_POWER — passive, cell/WiFi
    distanceInterval: 5000,                 // Only callback if moved 5km (effectively never)
    deferredUpdatesInterval: 600000,        // Max once per 10 minutes
    foregroundService: {
      notificationTitle: 'Open Working Hours',
      notificationBody: 'Automatische Zeiterfassung aktiv',  // "Automatic time tracking active"
      notificationColor: '#2E7D32',
      killServiceOnDestroy: false,
    },
  });

  console.log('[ForegroundKeepalive] Service started');
}

/**
 * Stop the foreground keepalive service.
 */
async function stopKeepalive(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_KEEPALIVE_TASK_NAME);
  if (!isRunning) return;

  await Location.stopLocationUpdatesAsync(LOCATION_KEEPALIVE_TASK_NAME);
  console.log('[ForegroundKeepalive] Service stopped');
}
```

**Design decisions in this module:**
- **`syncKeepaliveState()` is the only public API.** Single policy function evaluates conditions and starts or stops accordingly. All callers use this — no scattered start/stop logic.
- `Accuracy.Lowest` — absolute minimum battery impact, no GPS, passive cell/WiFi only
- `distanceInterval: 5000` (5km) — callback almost never fires
- `deferredUpdatesInterval: 600000` (10 min) — very infrequent
- Notification text: "Automatische Zeiterfassung aktiv" — positive trust framing
- **No `hasStartedLocationUpdatesAsync` guard on start** — `startLocationUpdatesAsync` is idempotent. The has-started API reflects task registration, not running service state.
- `killServiceOnDestroy: false` — survives swipe from recents
- **Handles permission revocation:** if background permission is revoked, `syncKeepaliveState()` calls `stopKeepalive()`, removing the stale notification

#### 4. Integration into App.tsx initialization

**File:** `App.tsx`, inside `initializeApp()`

After geofences are re-registered, sync the keepalive state. The policy function handles all conditions (platform, permission, locations):

```typescript
// Sync foreground keepalive service state (Android only, non-fatal)
try {
  await syncKeepaliveState();
} catch (error) {
  console.warn('[App] Failed to sync keepalive state:', error);
}
```

#### 5. Keepalive lifecycle — `syncKeepaliveState()` everywhere

**Key design decision:** All keepalive start/stop decisions go through `syncKeepaliveState()`. This single policy function evaluates the current conditions (platform, permission, locations) and starts or stops the service accordingly. No caller needs to know the conditions — they just call sync.

**Why not couple to `registerGeofence()`/`unregisterGeofence()`?**
Those methods can be called from any context, including headless/background (e.g., the geofence task handler re-registering after a kill). On Android 12+, starting a foreground service from background context throws `ForegroundServiceStartNotAllowedException`. `syncKeepaliveState()` is only called from known-foreground contexts.

**Call sites:**

| Where | When | What happens |
|-------|------|-------------|
| `App.tsx` `initializeApp()` | App startup | Starts if locations + permission; stops if not |
| `App.tsx` AppState listener | App returns to foreground | Restarts if killed; stops if permission revoked |
| `LocationsListScreen` after delete | User deletes a location | Stops if last location removed |
| `SetupScreen` after save | User adds a location | Starts if first location + permission granted |
| `GeofenceService.stopAll()` | User disables all tracking | Stops |
| `PermissionsScreen` after grant | User grants background permission | Starts if locations exist |

**File:** `App.tsx` — AppState foreground listener becomes simple:

```typescript
if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
  console.log('[App] App came to foreground');
  if (globalTrackingManager) {
    await globalTrackingManager.processPendingExits();
  }
  // Sync keepalive: restarts if killed, stops if permission revoked
  try {
    await syncKeepaliveState();
  } catch (error) {
    console.warn('[App] Failed to sync keepalive on foreground:', error);
  }
}
```

**File:** `LocationsListScreen.tsx` — after location delete:

```typescript
// After successful location deletion:
await syncKeepaliveState(); // Stops service if last location was deleted
```

**File:** `SetupScreen.tsx` — after location save:

```typescript
// After successful location save:
await syncKeepaliveState(); // Starts service if first location was added
```

This handles all lifecycle transitions including the previously-missed "delete last location" case. The policy function is idempotent, so calling it too often is harmless.

#### 6. No changes needed

- **app.json** — `isAndroidForegroundServiceEnabled: true` already adds `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION` permissions
- **Existing notifications** — untouched. The keepalive uses its own `IMPORTANCE_LOW` channel (auto-created by expo-location)
- **iOS** — all gated behind `Platform.OS === 'android'`
- **TrackingManager** — no changes
- **ExitVerificationService** — no changes
- **E2E tests** — foreground service is invisible to UI tests

### Resolved design decisions (post-review)

**Q1: `Accuracy.Lowest`.** No GPS, passive cell/WiFi only. The callback is a no-op — we don't need location data. Switch to `Low` later if health checks are added.

**Q2: `"Automatische Zeiterfassung aktiv"`.** ("Automatic time tracking active") — positive trust framing. Avoids "überwacht" (monitored/surveilled) which has surveillance connotations inappropriate for a privacy-first app.

**Q3: No-op callback for Phase 1.** Health checks (verify geofencing registration, process pending exits) deferred to follow-up if monitoring shows issues.

**Q4: Failure is non-fatal.** `startLocationUpdatesAsync` failure in init is caught + warned. Geofencing still works without keepalive, just less reliably against OEM kills.

**Q5: Yes — forced restart on every foreground resume.** No `hasStartedLocationUpdatesAsync` guard (that API reflects registration, not running state). `startLocationUpdatesAsync` is idempotent, so always calling it ensures the service is genuinely alive. This is the primary recovery mechanism for killed services.

### Files to create/modify

| File | Action | What changes |
|------|--------|--------------|
| `src/modules/geofencing/constants.ts` | Modify | Add `LOCATION_KEEPALIVE_TASK_NAME` |
| `src/modules/geofencing/services/ForegroundKeepaliveService.ts` | Create | New module: `syncKeepaliveState()` policy function + private start/stop |
| `App.tsx` | Modify | Add keepalive task definition at module scope; `syncKeepaliveState()` in init + foreground listener |
| `src/modules/geofencing/services/GeofenceService.ts` | Modify | `syncKeepaliveState()` in `stopAll()` |
| `src/modules/geofencing/screens/LocationsListScreen.tsx` | Modify | `syncKeepaliveState()` after location delete |
| `src/modules/geofencing/screens/SetupScreen.tsx` | Modify | `syncKeepaliveState()` after location save |
| `src/modules/geofencing/screens/PermissionsScreen.tsx` | Modify | `syncKeepaliveState()` after background permission grant |

### Testing plan

**1. Basic foreground service lifecycle:**
- Start app with locations configured → verify persistent notification appears ("Automatische Zeiterfassung aktiv")
- Check `adb logcat -s ReactNativeJS` for `[ForegroundKeepalive] Service started`
- Verify notification has green color accent and app icon

**2. Swipe-from-recents survival:**
- Swipe app from recents
- Verify notification persists (not dismissed)
- Wait 5 minutes → verify notification still visible
- Open app → verify no error, `[ForegroundKeepalive] Service started` logged again (forced restart on foreground)

**3. Geofence event delivery after background:**
- Start app (service running)
- Put phone in pocket, leave the house (exit Home geofence)
- Verify exit event logged in `geofence_events` table
- Return home → verify enter event logged

**4. Overnight survival (key test):**
- Start app at end of day, inside Home geofence
- Leave phone on charger overnight (screen off, Samsung battery optimization active)
- Next morning: verify notification still present
- Leave home → verify geofence exit event fires and session clocks out

**5. No-locations edge case:**
- Delete all locations → verify service stops (notification disappears)
- Add a location → open app again → verify service starts (notification appears)

**6. Permission-revoked behavior:**
- With service running, go to Android Settings → Apps → Open Working Hours → Permissions → Location → revoke background permission
- Return to app → `syncKeepaliveState()` runs on foreground resume → evaluates `shouldRun=false` (no background permission) → calls `stopKeepalive()`
- Verify: notification disappears, no crash
- Re-grant background permission → open app → `syncKeepaliveState()` evaluates `shouldRun=true` → starts service → notification reappears

**7. No-permission edge case:**
- Fresh install, save locations but deny background location permission
- Verify: no persistent notification appears (keepalive not started)
- Grant background permission later → open app → verify keepalive starts

**8. Regression:**
- iOS app: verify no changes (no notification, no new behavior)
- Android: verify existing clock-in/out transient notifications still work alongside persistent notification
- Run 50 geofencing unit tests → all pass

---

## Phase 1 Review Corrections

### Round 1 (2026-04-09)

| Severity | Finding | Correction |
|----------|---------|------------|
| **High** | `startKeepalive()` guarded on `hasStartedLocationUpdatesAsync` which reflects task *registration*, not running service state. Blocks foreground-restart recovery. | Removed the guard. `startLocationUpdatesAsync` is idempotent — always call it unconditionally. |
| **Medium** | Keepalive started when `locations.length > 0` without checking background permission. Could show persistent notification while geofencing is disabled. | Added `hasBackgroundPermissions()` check before starting keepalive in both init and foreground-resume paths. |
| **Medium** | Notification text "Arbeitsorte werden überwacht" — "überwacht" has surveillance connotation, inappropriate for privacy-first app. | Changed to "Automatische Zeiterfassung aktiv" (positive trust framing). |
| **Medium** | Keepalive start/stop coupled to `GeofenceService.registerGeofence()`/`unregisterGeofence()`. These can be called from background context, which throws on Android 12+. | Decoupled. Keepalive only started from known-foreground contexts (app init, AppState foreground listener). Only `stopKeepalive()` in `stopAll()` (always foreground). |
| **Low** | Test plan missing permission-revoked scenario. | Added test cases 6 (permission revoked at runtime) and 7 (no permission from start). |

### Round 2 (2026-04-09)

| Severity | Finding | Correction |
|----------|---------|------------|
| **High** | Stop conditions incomplete. Normal "delete location" flow uses `unregisterGeofence()` + DB delete, not `stopAll()`. Deleting the last location leaves keepalive running with stale notification. | Introduced `syncKeepaliveState()` policy function. Called after location CRUD (delete in LocationsListScreen, save in SetupScreen), after permission grant, on init, and on foreground resume. Single policy evaluates conditions and starts or stops. |
| **Medium** | Permission-revoked test case expects "no stale notification" but plan only skipped restart — did not explicitly stop. Research confirmed service keeps running after permission revoke. | `syncKeepaliveState()` on foreground resume now evaluates `shouldRun=false` when permission is missing → calls `stopKeepalive()` → notification removed. Test expectation is now consistent with implementation. |
| **Medium** | Doc has two Phase 1 instruction sets (initial draft + detailed plan) with conflicting guidance (iOS-only options, earlier coupling). | Marked initial "Implementation Details" section as SUPERSEDED with summary of key differences. |
