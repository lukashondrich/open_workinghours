# Android Bug Report — Samsung Real Device (2026-03-31)

**Device:** Samsung Galaxy A14 (SM-A145F), Android 15, API 35
**Build:** Current main branch
**Branch:** `fix/android-bugs-2026-03-31`
**ADB ID:** `R58W910C8QD`

---

## Summary

5 bugs found during Samsung real-device testing. 4 fixed and verified on device, 1 could not be reproduced on retest. Additional Android visual polish was verified on Samsung and regression-checked on iOS on 2026-04-08.

| Bug | Description | Root Cause | Status |
|-----|-------------|------------|--------|
| 1 | Map tap inside geofence circle ignored | `Circle` intercepts touches on Android | FIXED (2026-04-02) |
| 2 | Location list map flickers between locations | Controlled `region` prop feedback loop | FIXED (2026-04-04) |
| 4 | Search result doesn't update map | Same as Bug 2 | FIXED (2026-04-04) |
| 5 | Tab bar grey gradient artifact | `borderTopWidth` + `elevation` on Samsung | FIXED (2026-04-08) |
| 3 | Saving new location kills active check-in | Original hypothesis: GeofenceService re-registration | Could not reproduce (2026-04-04) |

### Files Changed (this session — 2026-04-04)

| File | Bugs Fixed | What Changed |
|------|-----------|--------------|
| `AppNavigator.tsx` | 5 | `borderTopWidth: 0`, `elevation: 0` on tab bar (Android only — iOS keeps its border) |
| `LocationsListScreen.tsx` | 2 | Controlled `region` → uncontrolled `initialRegion`; removed `onRegionChangeComplete` feedback loop; all map movement via `animateToRegion` only |
| `SetupScreen.tsx` | 4 | Same pattern: controlled `region` state → `regionRef` (useRef); `initialRegion={regionRef.current}` so step transitions start at correct position; search proximity uses ref |

### Review-pass refinements (2026-04-04)

A review agent made two additional improvements on the same branch:

| File | Refinement |
|------|-----------|
| `LocationsListScreen.tsx` | Wrapped handlers in `useCallback` with proper deps; added `locationsRef` + `selectedLocationIdRef` to prevent stale closures in `useFocusEffect`; sequential focus flow (load locations first, GPS fallback only if empty); selection preserved when returning to screen |
| `AppNavigator.tsx` | Made `borderTopWidth: 0` / `elevation: 0` Android-only via `Platform.OS` check — iOS keeps its normal 1px top border |

### Follow-up visual polish and cross-device verification (2026-04-08)

After the original five bugs were closed out, several Android-specific spacing issues were fixed and re-verified:

| File | What Changed |
|------|--------------|
| `SettingsDetailLayout.tsx` | Added a shared Android-only safe-area header used by settings detail screens and related stack screens; iOS continues to use the native stack header |
| `AppNavigator.tsx` | Android detail screens (`LocationsList`, `Notifications`, `Permissions`, `DataPrivacy`, `Profile`, `Tracking`, `Log`) now hide the native stack header and use the shared in-app header; Android tab icons were rebalanced vertically; a subtle hairline divider was restored directly on the Android tab bar |
| `StatusScreen.tsx` | Replaced fixed `paddingTop: 60` with a real top `SafeAreaView` so the "Open Working Hours" title uses device insets instead of a guessed pixel value |
| `TrackingScreen.tsx` | Switched Android to the shared in-app header to avoid native header/status bar spacing inconsistencies |
| `LogScreen.tsx` | Same as `TrackingScreen.tsx` — Android now uses the shared in-app header |

**Cross-device check (2026-04-08):**
- Samsung Galaxy A14: verified the Android detail-screen headers, Status top spacing, Work Tracking / Work History top spacing, and final tab bar appearance
- iOS simulator: verified no duplicate custom headers on iOS, native iOS headers still appear normally, and the iOS tab bar keeps its expected divider

### Files Changed (prior session — 2026-04-02)

| File | Bug Fixed | What Changed |
|------|----------|--------------|
| `SetupScreen.tsx` | 1 | `tappable={false}` on Circle components (step 2, step 3) |
| `LocationsListScreen.tsx` | 1 | `tappable={false}` on Circle component |

---

## Root Cause Analysis

### Bugs 2 & 4: Controlled `region` prop fights `animateToRegion` on Android

**The pattern that breaks on Android:**
```tsx
// BAD — causes flicker on Android
<MapView
  region={region}                        // controlled prop
  onRegionChangeComplete={setRegion}     // feeds back into state
/>

// When animateToRegion is called:
// 1. Animation starts moving map
// 2. onRegionChangeComplete fires with intermediate position
// 3. setRegion(intermediate) triggers re-render
// 4. Controlled region prop snaps map to intermediate position
// 5. Animation tries to continue → goto 2 (loop for ~5 seconds)
```

**The fix:**
```tsx
// GOOD — uncontrolled, no feedback loop
const regionRef = useRef(defaultRegion);

<MapView
  initialRegion={regionRef.current}                    // only used on mount
  onRegionChangeComplete={(r) => { regionRef.current = r; }}  // ref, not state — no re-render
/>

// animateToRegion now runs uncontested — no state/re-render cycle fighting it
```

**Why `regionRef.current` instead of a static `initialRegion`:**
SetupScreen has a multi-step wizard where Step 1 and Step 2 each mount their own MapView. When Step 2 mounts, `initialRegion` must reflect the location the user selected in Step 1 — so we use `regionRef.current` (which was updated during the step transition in `handleContinue`).

**iOS vs Android:** This bug is Android-only. iOS's `react-native-maps` implementation handles the controlled `region` + animation combination gracefully. Android's Google Maps SDK does not.

### Bug 5: Tab bar gradient on Samsung

**Root cause:** The combination of `borderTopWidth: 1` and Android's default tab bar `elevation` rendered as a visible gradient/shadow on Samsung One UI, but appeared normal on the Pixel emulator. Samsung's rendering engine amplifies thin borders into gradient-like artifacts.

**Fix:** Remove Android shadow/elevation from the tab bar. In the final verified version, keep the shadow off but restore only a very subtle hairline divider directly on the Android tab bar, which preserves separation without recreating the Samsung gradient artifact.

### Bug 1: Circle touch interception (fixed prior session)

**Root cause:** `react-native-maps` `Circle` component on Android intercepts touch events by default (unlike iOS which passes them through). Adding `tappable={false}` makes the circle transparent to touches.

---

## Testing Methodology & Lessons Learned

### Key discovery: previous fixes were never actually tested

The 2026-04-02 session attempted fixes for bugs 2, 4, and 5 but all "failed on Samsung." Investigation on 2026-04-04 revealed **none of those fixes were actually running on the device**:

1. `expo run:android` built a debug APK but installed it on the **emulator** (not Samsung), because `--device R58W910C8QD` wasn't recognized by Expo's device picker
2. The Samsung was still running a **release build** (from an earlier EAS build) which bundles JS at build time and doesn't connect to Metro
3. A release build has no `DEBUGGABLE` flag — `run-as` fails, no ReactNativeJS logcat output, no hot reload

This means the "failed attempts" documented for bugs 2, 4, 5 on 2026-04-02 were testing against **unchanged code**. The controlled→uncontrolled fix for bugs 2 & 4 may have been correct all along.

### How we verified the fix (2026-04-04)

1. **Uninstalled the release build** from Samsung: `adb -s R58W910C8QD uninstall com.openworkinghours.mobileapp`
2. **Installed the debug APK**: `adb -s R58W910C8QD install android/app/build/outputs/apk/debug/app-debug.apk`
3. **Set up port forwarding**: `adb -s R58W910C8QD reverse tcp:8081 tcp:8081`
4. **Launched app** → Expo Dev Client launcher appeared → tapped `http://localhost:8081` to connect to Metro
5. **Confirmed Metro connection** via `adb logcat -s ReactNativeJS` — saw app initialization logs
6. **Tested each fix manually** on the physical Samsung device:
   - Bug 5: Tab bar gradient gone across all tabs
   - Bug 4: Search result correctly moves map; step 1→2 transition keeps position
   - Bug 2: Tapping between locations in the list — smooth animation, no flicker

### Checklist for future Android real-device testing

- [ ] Verify device has a **debug build** (not release): `adb shell dumpsys package <pkg> | grep flags` should show `DEBUGGABLE`
- [ ] Verify **Metro is connected**: `adb logcat -s ReactNativeJS` should show JS logs
- [ ] If using Expo Dev Client: launch app → select the Metro dev server URL
- [ ] Add a `console.log('PATCHED')` to verify your specific code change is running
- [ ] **Kill emulator** if it's running — `expo run:android` may target it instead of the physical device
- [ ] Port forwarding: `adb -s <DEVICE_ID> reverse tcp:8081 tcp:8081`

---

## Bug 1: Map tap inside geofence circle doesn't move pin — FIXED

**Steps:** Setup wizard → step 2 ("at location") → tap inside the geofence circle
**Expected:** Pin moves to tap location
**Actual:** Nothing happens. Tapping *outside* the circle works fine.

**Root cause:** `react-native-maps` `Circle` on Android intercepts touches by default. iOS passes them through.

**Fix:** `tappable={false}` on all Circle components.

**Verified:** Samsung real device (2026-04-02).

**Files:** `SetupScreen.tsx` (3 Circles), `LocationsListScreen.tsx` (1 Circle)

---

## Bug 2: Location list map flickers between locations — FIXED

**Steps:** Locations list → have 2+ locations → tap a different location name
**Expected:** Map smoothly animates to the new location
**Actual:** Map rapidly jumps between old and new location for ~5 seconds

**Root cause:** Controlled `region` prop + `onRegionChangeComplete={setRegion}` feedback loop on Android. See Root Cause Analysis above.

**Fix:** Replaced controlled `region` with uncontrolled `initialRegion`. Removed `onRegionChangeComplete` state setter. All map movement via `animateToRegion` only.

**Verified:** Samsung real device (2026-04-04) — smooth animation when tapping between 2 locations.

**File:** `LocationsListScreen.tsx`

---

## Bug 3: Saving new location locks out of currently checked-in location — COULD NOT REPRODUCE

**Original report:** Manually check in at Location A → add a new Location B → save → can no longer access Location A; "clocked out" notification fires.

**Retest (2026-04-04):** Tried the flow on both Android and iOS and could not reproduce the issue. The active session remained accessible after saving the new location, and the false clock-out notification did not appear.

**Status:** Not currently reproducible. Keep monitoring, but do not treat as an active blocker unless it reappears with a reliable repro.

**Files:** `GeofenceService.ts`, `TrackingManager.ts`

---

## Bug 4: Address search sometimes doesn't update map — FIXED

**Steps:** Setup wizard step 1 → type address → tap search result
**Expected:** Map animates to the selected address
**Actual:** Map stays at previous position or snaps back

**Root cause:** Same as Bug 2 — controlled `region` prop feedback loop on Android.

**Fix:** Same pattern — uncontrolled `initialRegion` with `regionRef`. Additionally, `initialRegion={regionRef.current}` ensures that when the Step 2 MapView mounts (after step transition), it starts centered on the selected location instead of the default US coordinates.

**Verified:** Samsung real device (2026-04-04) — search result correctly centers map, step transitions preserve position.

**File:** `SetupScreen.tsx`

---

## Bug 5: Tab bar grey gradient/border artifact — FIXED

**Steps:** Visible on all screens — grey gradient/shadow area above tab bar icons
**Expected:** Clean tab bar
**Actual:** Broad grey gradient visible on Samsung (not on Pixel emulator)

**Root cause:** `borderTopWidth: 1` + default Android `elevation` rendered as a gradient on Samsung One UI. Emulator doesn't reproduce this.

**Fix:** Remove Android tab bar elevation/shadow. After later visual regression checks, restore only a subtle hairline divider on the Android tab bar itself and slightly rebalance the Android tab item vertical padding so the icons/labels sit more centrally in the white area.

**Verified:** Samsung real device (2026-04-08) — no Samsung gradient artifact, thin divider visible, and tab icons feel visually centered.

**File:** `AppNavigator.tsx`

---

## Verification Matrix

| Bug | Status | Real Device Verified | Date |
|-----|--------|---------------------|------|
| 1 | FIXED | Samsung Galaxy A14 | 2026-04-02 |
| 2 | FIXED | Samsung Galaxy A14 | 2026-04-04 |
| 3 | COULD NOT REPRODUCE | Android + iOS retest | 2026-04-04 |
| 4 | FIXED | Samsung Galaxy A14 | 2026-04-04 |
| 5 | FIXED | Samsung Galaxy A14 | 2026-04-08 |
