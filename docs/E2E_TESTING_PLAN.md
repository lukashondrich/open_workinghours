# E2E Testing — Deep Dive

**Updated:** 2026-02-03
**Status:** iOS 48/48 (~200s, ~100% stable), Android 45-48/48 (~130-160s, ~75-80% stable)

> **Quick start?** See [mobile-app/e2e/README.md](../mobile-app/e2e/README.md) for the runbook.
> This document is the deep reference for architecture decisions, robustness helpers, testID reference, and session history.

---

## Stack

- **Appium 3.1.2** (Node 20 or 22 — not 23)
- **XCUITest** driver (iOS), **UiAutomator2** driver (Android)
- **WebdriverIO** client + **Jest** runner
- Tests in `mobile-app/e2e/`

## Quick Start

```bash
cd mobile-app/e2e
npm install

# Build app locally (first time or after native changes)
npm run build:ios

# Start infrastructure (terminal 1) — Appium + Metro + simulator
npm run infra:ios      # or infra:android, infra:both

# Run tests (terminal 2)
npm run test:ios       # or test:android
npm run test:shifts    # single suite: auth, calendar, location, shifts, absences, manual-session
```

See `mobile-app/e2e/README.md` for full setup (driver installation, device auto-detection, env overrides).

---

## Test Coverage

| Suite | Tests | What's covered |
|-------|-------|----------------|
| auth | 5 | Verify authenticated state, tab bar presence (Status/Calendar/Settings), tab navigation |
| calendar | 7 | Tab navigation, FAB menu (with retry), week prev/next, month/week toggle |
| shifts | 9 | FAB → shifts panel, create-or-reuse template, arm template, close panel (overlay testID), **double-tap week-view day column to place shift**, month-view dot verification, close |
| absences | 11 | FAB → absences panel, create absence template, edit name, save, persistence, **arm absence → month-view day tap → verify absence icon**, close |
| manual-session | 5 | FAB → Log Hours, **ensureLocationConfigured**, verify all form fields (location/date/start/end/save), save with validation handling |
| location | 11 | Settings nav, add location wizard (search → radius → name), conditional skip if configured |
| **Total** | **48** | |

### Not yet covered (next priorities)

**High items completed (2026-01-30 session 2):**
- ~~Template arming → week-view day tap~~ → Done: double-tap on `week-day-column-{dateKey}` places shift
- ~~Manual session save~~ → Done: `ensureLocationConfigured()` auto-completes wizard, form fields verified, save with validation handling
- ~~Absence arming → day tap → verify absence icon~~ → Done: arm template, tap month-view day, check vacation icon testID

**Medium — new flows:**
1. Shift/absence deletion + confirm alert
2. Overlap detection (two overlapping shifts → warning)
3. Settings (language toggle, account info)
4. Location management (edit/delete existing)

**Lower — complex to simulate:**
5. Data submission to backend (needs connectivity or mocking)
6. Geofencing dashboard (needs location simulation)
7. 14-day planned/tracked hours chart

---

## Known Issues

### Test-level issues (not app bugs)

| Issue | Root cause | Status |
|-------|-----------|--------|
| ~~Shift arming month-view verification~~ | ~~Tapping month view just navigates, doesn't create shift~~ | **Fixed:** double-tap week-view day column |
| ~~Manual session form fields skip~~ | ~~No location configured → form shows error~~ | **Fixed:** `ensureLocationConfigured()` auto-completes wizard |
| WebDriver WARN logs for `getAlertText()` | WebDriverIO retries `getAlertText()` 3 times before throwing, producing WARN/ERROR logs. | Cosmetic — doesn't affect results |
| Manual session save may be disabled | Default end time (16:00) is in the future before 4 PM → save button disabled | Test handles both paths (save or validation) |
| GPS dialog in location wizard | "Standort nicht verfügbar" native alert blocks search input on simulators | Fixed: `dismissNativeDialog` polling loop in `completeLocationWizard` |
| Stale navigation stack across sessions | Setup wizard left open from previous run → tab bar hidden → auth check fails | Fixed: `ensureAuthenticated` back-tap recovery with dialog dismissal |
| Android `acceptAlert()` silently no-ops | UiAutomator2's `acceptAlert()` returns success without dismissing AlertDialogs | Fixed: `dismissNativeDialog` uses text-based button taps on Android |
| Android app not in foreground after `deleteSession()` | Appium doesn't auto-launch with `noReset: true` after activity destroyed | Fixed: `ensureAuthenticated` calls `activateApp()` on Android |
| `auth.test.js` wiped app state | `noReset: false` cleared data, breaking subsequent suites | Fixed: rewrote auth to use `noReset: true` like all suites |
| Accumulated templates from repeated runs | `template-add` click failed because save button scrolled off-screen | Fixed: shifts test reuses existing templates instead of always creating |

### Flakiness & robustness

| Issue | Frequency | Fix |
|-------|-----------|-----|
| FAB menu items not found on first tap | Occasional (iOS) | `waitForTestIdWithRetry()` with retryAction (implemented) |
| `isDisplayed()` unreliable for inline Animated.Views | Always | Use `isExisting()` instead (documented pattern) |
| Android `getValue()` doesn't work on text inputs | Always | Use `getText()` on Android (platform branch in tests) |
| First iOS run slow (WebDriverAgent build) | First run only | Wait — one-time cost |

---

## Robustness Helpers

### `dismissNativeDialog(driver, buttonTexts)`

Single entry point for dismissing any native dialog on either platform. Returns `true` if a dialog was dismissed.

- **iOS:** Uses `driver.getAlertText()` + `driver.acceptAlert()` for native UIAlertController alerts.
- **Android:** Tries permission controller resource IDs first (`dismissAndroidSystemDialog`), then falls back to tapping buttons by text. This is necessary because `acceptAlert()` silently succeeds on Android without actually dismissing AlertDialogs.
- `buttonTexts` parameter controls which buttons to try (default: `['OK', 'Allow', 'Erlauben']`).

### `dismissSystemDialogs(driver, maxAttempts=5)`

Comprehensive dialog dismissal at startup. Calls `dismissNativeDialog` with a broad set of button texts (`OK`, `Allow`, `Erlauben`, `Dismiss`, `Got it`, `Not Now`, `Don't Allow`). Loops up to `maxAttempts` for stacked dialogs.

### `waitForTestIdWithRetry(driver, testId, options)`

Generic retry helper for elements that may not appear on first attempt (e.g., FAB menu).

```javascript
const element = await waitForTestIdWithRetry(driver, 'fab-shifts-option', {
  retryAction: async () => {        // action to trigger before retrying
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(2000);
  },
  timeout: 10000,    // wait timeout per attempt (ms)
  retries: 2,        // retry count after first failure
  retryDelay: 1000,  // delay after retryAction (ms)
});
```

### `ensureLocationConfigured(driver, returnToTab)`

Checks if a work location exists (via `add-workplace-button` testID on the Status screen). If not, completes the full location wizard: search "Berlin" → select result → continue → continue → name "Test Hospital" → save. Dismisses the GPS "Location not available" native alert that appears on simulators. Falls back gracefully if the wizard fails.

### `ensureCleanCalendarState(driver)`

Recovers from stale app state at the start of calendar-based test suites. Dismisses any open overlay/panel (tap top of screen on iOS, back on Android), navigates to Calendar tab, and switches to week view if needed so the FAB is visible.

### `ensureAuthenticated(driver)` — stale state recovery

Full startup sequence: (1) `activateApp` on Android, (2) dismiss system dialogs, (3) poll up to 15s for app ready (tab bar or login button), (4) if on a stack screen, dismiss blocking dialogs + back-press up to 5 times, (5) if still not authenticated, perform TEST_MODE login. Handles all known stale states: wizard screens, permission dialogs, app not in foreground.

---

## Architecture Decisions

### Why Appium (not Maestro)

Maestro was evaluated first (Jan 24-25, 2026) and works for iOS with some limitations. However:

- **Maestro 2.1.0 cannot connect to Android emulators** — gRPC port 7001 connection failure, no fix available.
- **Appium works reliably on both platforms** with XCUITest (iOS) and UiAutomator2 (Android).
- Maestro MCP tools (`inspect_view_hierarchy`, `run_flow`) are still available in `.mcp.json` for **interactive debugging and exploration** — they're useful for inspecting the accessibility tree, but not part of the test suite.
- Legacy Maestro flows are in `.maestro/` for reference only.

### Why inline Animated.View (not Modal)

React Native's `<Modal>` creates a separate native UIWindow on iOS. XCUITest (used by Appium) only queries the main window's accessibility tree → Modal content is invisible to tests. Inline `Animated.View` with `pointerEvents` and `accessibilityElementsHidden` provides identical UX while keeping elements in the main view tree.

**Pattern:**
```tsx
// All overlays/panels/sheets use this pattern
<View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
  <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
    {/* content — always in native view tree */}
  </Animated.View>
</View>
```

### Accessibility props for testability

XCUITest and UiAutomator2 both aggregate children into a single element when a parent is `accessible={true}` (the default for touchable components). To expose individual elements:

```tsx
// Container: transparent to accessibility tree
<View accessible={false} collapsable={false}>
  // Each interactive child: individually accessible
  <TouchableOpacity testID="my-btn" accessible={true} accessibilityRole="button">
    <Text>Tap me</Text>
  </TouchableOpacity>
</View>
```

**Rules:**
- `TouchableWithoutFeedback` wrappers → `accessible={false}`
- `ScrollView` with interactive children → `accessible={false}`
- Container `View` with multiple children → `accessible={false}` + `collapsable={false}`
- Never put `accessibilityLabel` on a container with interactive children
- Never use `accessibilityRole="menu"` or `accessibilityViewIsModal` on containers

---

## Build Strategy

### Current: EAS Cloud Builds

Every testID or component change requires an EAS build (~15-30 min, costs build credits). The `e2e-testing` profile builds for simulator (iOS) and APK (Android) with `TEST_MODE=true`.

```bash
cd mobile-app
eas build --profile e2e-testing --platform all
```

**Limitation:** EAS builds from the git working tree but at 97% monthly credit usage. Each build cycle costs money and time.

### Local Xcode Builds (Verified 2026-01-30)

Local builds bypass EAS entirely for simulator testing. Use EAS only for device/TestFlight builds.

**Prerequisites:**
- Xcode 26.2, macOS 15.7.3, CocoaPods 1.16.2
- `ios/` native project with Pods installed (already in repo)
- A booted iOS simulator

**Workflow:**
```bash
cd mobile-app/e2e

# 1. Build and install on simulator (first build: ~4 min, incremental: ~1 min)
npm run build:ios

# 2. Start infrastructure — Appium + Metro + simulator (one terminal)
npm run infra:ios

# 3. Run tests (another terminal)
npm run test:ios
```

The local build uses `expo run:ios --configuration Release` with `TEST_MODE=true`. It compiles native code via Xcode and installs the `.app` on the simulator. The app loads its JS bundle from Metro (port 8081), which `start-infra.sh` starts automatically alongside Appium.

**When to rebuild (`npm run build:ios`):**
- Changed native code, added/removed native modules, or modified `app.json`/plugins
- Changed accessibility props (`testID`, `accessible`, etc.) — these are in JS but baked into the native view tree at runtime, so a rebuild ensures they're picked up

**When you DON'T need to rebuild:**
- JS-only logic changes (Metro serves the latest bundle on reload)

**When to still use EAS:**
- TestFlight / production builds (need signing + distribution)
- Android APK builds (unless Android Studio is set up locally)
- CI/CD pipeline builds

**If the native project is stale:**
```bash
cd mobile-app
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
```

---

## Cross-Platform Patterns

### Selectors

```javascript
// helpers/selectors.js
byTestId(driver, 'calendar-fab')    // iOS: ~calendar-fab, Android: UiSelector.resourceId
byI18nFast(driver, 'calendar')      // Matches "Kalender" OR "Calendar"
```

### Platform-specific behaviors

| Behavior | iOS | Android |
|----------|-----|---------|
| testID selector | `~testId` (accessibility id) | `UiSelector().resourceId("testId")` |
| Text input value | `getValue()` | `getText()` |
| Back button | Overlay tap (W3C Actions API) | `driver.pressKeyCode(4)` |
| System permission dialogs | `driver.getAlertText()` + `acceptAlert()` | Resource ID: `com.android.permissioncontroller:id/permission_allow_button` |
| App locale | Follows device | Follows device |

### TEST_MODE builds

E2E tests require `TEST_MODE=true` builds. TEST_MODE enables:

| Feature | Purpose | Implementation |
|---------|---------|----------------|
| Mock auth | Code `123456` works, no email needed | `AuthService.ts` checks `isTestMode()` |
| Mock geocoding | Returns "Charité Berlin" instantly | `GeocodingService.ts` returns `mockGeocodingResult` |
| Skip panel animations | TemplatePanel/ManualSessionForm open instantly | `useEffect` sets `animValue` immediately |
| Skip pulse animations | Tracking badges have stable opacity=1 | `useEffect` skips `Animated.loop()` |

All checks use `isTestMode()` from `src/lib/testing/mockApi.ts`.

```bash
# Local (recommended for iteration)
cd mobile-app/e2e && npm run build:ios

# Cloud (EAS — for CI or device builds)
cd mobile-app && eas build --profile e2e-testing --platform ios
```

**Important:** TEST_MODE is baked in at build time via `app.config.js`. Code changes to `mockApi.ts` or animation `useEffect`s require a rebuild.

---

## testID Reference

### MonthView (`MonthView.tsx`)
```
month-day-YYYY-MM-DD          Day cell (e.g., month-day-2026-01-29)
month-day-YYYY-MM-DD-shifts   Shift dots container (only rendered if shifts exist)
month-day-YYYY-MM-DD-tracked  Tracked dot (only rendered if tracking exists)
month-day-YYYY-MM-DD-vacation Vacation icon (only rendered if vacation absence)
month-day-YYYY-MM-DD-sick     Sick icon (only rendered if sick absence)
```

### CalendarFAB (`CalendarFAB.tsx`)
```
calendar-fab           Main FAB button (visible in week view only)
fab-shifts-option      Menu item: Shifts
fab-absences-option    Menu item: Absences
fab-log-hours-option   Menu item: Log Hours
```

### TemplatePanel (`TemplatePanel.tsx`) — Shifts tab
```
template-panel-overlay            Backdrop overlay (tap to dismiss panel)
template-add                      "+ New" button (shifts tab)
template-name-input               Name text input
template-start-time-input         Start time input
template-duration-hours-input     Duration hours
template-duration-minutes-input   Duration minutes
template-save                     Save button
template-cancel                   Cancel button
template-delete                   Delete button
template-row-{index}              Template list row (tappable to arm)
```

### TemplatePanel — Absences tab
```
absence-add                  "+ New" button (absences tab)
absence-name-input           Name text input
absence-save                 Save button
absence-cancel               Cancel button
absence-delete               Delete button
absence-row-vacation-{index} Vacation template row
absence-row-sick-{index}     Sick template row
```

### ManualSessionForm (`ManualSessionForm.tsx`)
```
manual-session-cancel     Cancel button (always rendered)
manual-session-location   Location picker (requires location configured)
manual-session-date       Date picker (requires location configured)
manual-session-start      Start time picker (requires location configured)
manual-session-end        End time picker (requires location configured)
manual-session-save       Save button (requires location configured)
```

### Navigation
```
tab-status     Status tab
tab-calendar   Calendar tab
tab-settings   Settings tab
calendar-prev  Previous week/month arrow
calendar-next  Next week/month arrow
```

---

## File Reference

```
mobile-app/e2e/
├── helpers/
│   ├── driver.js       # Appium caps, device auto-detection
│   ├── selectors.js    # byTestId, byI18nFast, bilingual dictionary
│   └── actions.js      # tapTestId, ensureAuthenticated, dismissSystemDialogs,
│                        # waitForTestIdWithRetry, dismissPermissionDialogs
├── flows/
│   ├── auth.test.js         # 5 tests
│   ├── calendar.test.js     # 7 tests
│   ├── shifts.test.js       # 9 tests
│   ├── absences.test.js     # 11 tests
│   ├── manual-session.test.js # 5 tests
│   └── location.test.js    # 11 tests
├── start-infra.sh      # Starts Appium + simulator/emulator
├── jest.config.js      # 120s timeout, verbose
└── package.json        # webdriverio ^9, jest ^29
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No booted iOS simulator found" | `open -a Simulator`, wait for boot |
| "No running Android emulator found" | `emulator -list-avds` then `emulator -avd <name>` |
| WebDriverAgent build timeout (iOS) | First run takes minutes — wait |
| Element not found | Check app state (authenticated?), verify testID in code, check `accessible` props |
| Android testID invisible | Parent needs `accessible={false}`, element needs `accessible={true}` |
| Node version error | Use Node 20 or 22 (not 23) — `start-infra.sh` handles this |
| FAB not visible | FAB only shows in week view. Switch from month with `byI18nFast(driver, 'week')` or `byText(driver, 'Woche')` |
| Manual session form empty | No location configured — form shows error instead of fields |
| Suite failures after long runs | WebDriverAgent becomes unresponsive. Restart infra or run suites in smaller batches |

---

## Open Items for Next Session

These were identified during the 2026-01-31 review. Fixes #2, #5, #7, #8 are done. The rest need implementation or a decision.

### #1: `dismissNativeDialog` ignores `buttonTexts` on iOS

**Problem:** The iOS code path only uses `acceptAlert()` (native UIAlertController). The `buttonTexts` parameter is silently ignored. If an iOS in-app React Native dialog appears (not a native alert), this function returns `false` without trying text-based taps.

**Fix:** After the native alert check fails on iOS, fall back to the same text-based button taps used on Android. Same code path, both platforms.

**Risk:** Low — most iOS dialogs in this app are native alerts. But the inconsistency could cause a future failure if a React Native dialog is added.

### #3: `activateApp` hardcodes bundle ID

**Problem:** `ensureAuthenticated` line 440 hardcodes `'com.openworkinghours.mobileapp'`. The driver capabilities already define this as `appium:bundleId` (iOS) and `appium:appPackage` (Android).

**Fix:** Extract `APP_BUNDLE_ID` constant at the top of `actions.js`. Reference it in `activateApp` and anywhere else (e.g., `completeLocationWizard` doesn't use it yet but could).

**Risk:** Very low — bundle ID hasn't changed, but it's a maintenance hazard.

### #4: `ensureCleanCalendarState` still uses coordinate tap on iOS

**Problem:** Line 643 taps `(215, 50)` to dismiss panels on iOS. We just built `closeTemplatePanel()` with the `template-panel-overlay` testID to avoid this exact pattern.

**Fix:** Replace the coordinate tap with `closeTemplatePanel()`. If the panel isn't the only thing that could be open, first try overlay testID, then fall back to coordinate.

**Risk:** Medium — coordinate taps break on different screen sizes or if the panel layout changes.

### #6: Double-tap test uses today's date

**Problem:** `shifts.test.js` uses `new Date()` for the double-tap day column. CLAUDE.md says "Don't submit today or future dates — backend rejects them." The placement is local-only (never submitted to backend), so it works, but it contradicts the app's own constraint.

**Tradeoff:** Using today guarantees the date is visible in the current week view. Using yesterday is semantically correct but might not be visible (e.g., today is Monday → yesterday is Sunday, which is in the previous week).

**Options:**
- **A)** Use yesterday, navigate to previous week if needed — most correct, slightly more complex
- **B)** Keep today since placement is local-only — pragmatic, documented exception
- **C)** Calculate most recent past weekday still in current week — robust but over-engineered

**Decision needed from developer.**

---

## Session Log

### 2026-02-03 (session 2): Android Verification — 45-48/48

**Goal:** Verify Android E2E tests work with recent TEST_MODE expansion.

**Setup:**
- Used existing EAS build from Jan 30 (commit `8d37e6d`) — has mock auth + testIDs but not animation/geocoding mocking
- Started Pixel_7a emulator, installed APK via `adb install`
- Local Android build requires NDK 27.1 (incomplete installation) — documented workaround

**Fixes implemented:**

| Issue | Root cause | Fix |
|-------|-----------|-----|
| Location wizard blocked by "Background Permission Required" dialog | In-app React Native dialog not dismissed by `dismissPermissionDialogs` | Added `dismissNativeDialog` call with `['CONTINUE ANYWAY', ...]` in `completeLocationWizard` |
| Shifts test flaky after absences | Panel opens after double-tap, not consistently dismissed | Added recovery loop: `activateApp()` + up to 5 `back()` presses with visibility check |

**Results:**

| Run | Tests | Time | Notes |
|-----|-------|------|-------|
| 1 | 43/48 | 247s | Before fixes (manual-session failed) |
| 2 | 48/48 | 140s | After Background Permission fix |
| 3 | 45/48 | 155s | Shifts flaky |
| 4 | 48/48 | 132s | Pass |
| 5 | 45/48 | 160s | Shifts flaky |

**Stability:** ~75-80% pass rate. Remaining flakiness in shifts test after absences (~25% failure rate).

**Root cause analysis:** The shifts test double-taps a day column to place a shift. Sometimes a panel opens after placement that blocks the Month toggle. The recovery loop (back presses) doesn't always dismiss it. This only happens when shifts runs after absences in the full suite — likely state carryover from armed absence template.

**Documentation:** Restructured `mobile-app/e2e/README.md` with Runbook pattern (progressive disclosure, agent-friendly). Added platform comparison table, common issues decision tree.

**Files changed:**
- `mobile-app/e2e/helpers/actions.js` — Background Permission dialog handling
- `mobile-app/e2e/flows/shifts.test.js` — Recovery loop for panel dismissal
- `mobile-app/e2e/package.json` — Added `build:android` script
- `mobile-app/e2e/README.md` — Restructured with Runbook pattern
- `docs/E2E_TESTING_PLAN.md` — This entry, updated status

---

### 2026-02-03 (session 1): TEST_MODE Expansion — Animations + Geocoding Mocking

**Goal:** Reduce E2E flakiness by expanding TEST_MODE to control animations and geocoding.

**Changes implemented:**

| File | Change |
|------|--------|
| `src/lib/testing/mockApi.ts` | Added `isTestMode()` helper + `mockGeocodingResult` (Charité Berlin) |
| `src/modules/auth/services/AuthService.ts` | Import `isTestMode` from mockApi (removed inline definition) |
| `src/modules/calendar/components/TemplatePanel.tsx` | Skip 300ms slide animation in TEST_MODE |
| `src/modules/calendar/components/ManualSessionForm.tsx` | Skip 300ms slide animation in TEST_MODE |
| `src/modules/calendar/components/WeekView.tsx` | Skip pulse animation in TrackingBadge |
| `src/modules/geofencing/components/HoursSummaryWidget.tsx` | Skip pulse animation in Bar |
| `src/modules/geofencing/services/GeocodingService.ts` | Return mock result instantly in TEST_MODE |

**Results (iOS, 3 runs):**

| Run | Tests | Time |
|-----|-------|------|
| 1 | 48/48 | 207s |
| 2 | 48/48 | 202s |
| 3 | 48/48 | 200s |

**Baseline improvement:** ~280s → ~200s (28% faster), 100% pass rate, low variance (~3%).

**Friction points encountered:**

| Friction | Root cause | Solution |
|----------|-----------|----------|
| Tests skip flows ("location already configured") | App state persists across test runs | Uninstall app before rebuild for clean state |
| Code changes not reflected | TEST_MODE baked at build time | Must rebuild, not just hot reload |
| Geocoding mock not triggering | Needed rebuild after adding mock | `npm run build:ios` after code changes |
| Console logs not visible in test output | App logs go to Metro, not Jest | Check Metro terminal or use MCP tools to verify |

**Verification approach:** Used Maestro MCP to interactively verify:
- Geocoding mock returns "Charité – Universitätsmedizin Berlin" instantly
- TemplatePanel appears immediately after FAB tap (no 300ms delay)

**Android:** Not yet verified with these changes (no emulator running). Code is platform-agnostic, should work.

**Documentation updated:** `mobile-app/e2e/README.md` (pre-flight checklist, TEST_MODE features, expected times)

---

### 2026-01-31: Android Re-verification + Friction Reduction — 52 → 48 Tests (both platforms)

**Goal:** Re-verify all tests on Android (last verified at 32/32, expanded to 52 on iOS only), fix platform-specific issues.

**Root causes found and fixed:**

| Issue | Platform | Root cause | Fix |
|-------|----------|-----------|-----|
| App not in foreground | Android | Appium doesn't auto-launch after `deleteSession()` | `activateApp()` in `ensureAuthenticated` |
| Back-press exits app | Android | `driver.back()` from welcome screen goes to home | Skip back-presses when `login-button` visible |
| `acceptAlert()` no-ops | Android | UiAutomator2 silently succeeds without dismissing | New `dismissNativeDialog` uses text-based taps |
| Permission dialog blocks wizard | Android | Location permission appears before GPS dialog | `dismissPermissionDialogs()` after "Add Workplace" tap |
| Geocoding fails on emulator | Android | DNS broken on emulator, Photon API unreachable | Map-tap fallback + longer wait for API |
| Auth test wipes state | Both | `noReset: false` cleared app data | Rewrote auth to use `noReset: true` |
| Test ordering dependency | Both | Auth ran early and wiped state for later suites | Removed (auth no longer wipes state) |
| Shift template creation fails | Both | Accumulated templates push save button off-screen | Reuse existing templates if present |
| Panel dismiss by coordinates | Both | Coordinate tap unreliable across devices | Added `template-panel-overlay` testID |
| Shift flakiness (4 tests) | iOS | FAB animation race, `waitForExist` vs `waitForDisplayed`, yesterday not in current week | `openShiftsPanel` with retry, `closeTemplatePanel` via testID, use today's date |

**Structural changes:**
- **`dismissNativeDialog(driver, buttonTexts)`** — unified dialog dismissal, single entry point for both platforms
- **`dismissPermissionDialogs`** and **`dismissSystemDialogs`** refactored to use `dismissNativeDialog`
- **`auth.test.js`** — rewrote: no more `noReset: false`, uses `ensureAuthenticated()` like all suites (5 tests)
- **`shifts.test.js`** — rewrote: `openShiftsPanel()` and `closeTemplatePanel()` helpers, reuses existing templates, retry logic for animations (9 tests)
- **`TemplatePanel.tsx`** — added `testID="template-panel-overlay"` on backdrop
- **Removed `helpers/sequencer.js`** — no longer needed since auth doesn't wipe state
- **Removed `dismissAlert` from exports** — replaced by `dismissNativeDialog`
- **Cleaned unused imports** in auth.test.js and shifts.test.js

**Result:** 48/48 on both iOS and Android. Suites run in any order.

**Open items:** See "Open Items for Next Session" section above (#1, #3, #4, #6).

### 2026-01-30 (session 2): Local Builds, Test Fixes, Robustness — 51 → 52 Tests

**Local build workflow verified:**
- `TEST_MODE=true npx expo run:ios --configuration Release` works. First build ~4 min (native compile), incremental ~1 min.
- App loads JS from Metro (port 8081). `start-infra.sh` now starts Metro alongside Appium.
- Added `npm run build:ios` script with automatic `build.db` lock cleanup.

**High-priority test fixes (all 3 completed):**
- **Shift arming:** Replaced month-view day tap with double-tap on `week-day-column-{dateKey}` in week view. This is the actual user workflow — double-tap places a shift instance from the armed template. (+1 test, shifts now 12)
- **Manual session save:** Added `ensureLocationConfigured()` helper that auto-completes the location wizard if no location exists. Form fields (location/date/start/end/save) now verified. Save test handles validation (disabled when end time is in the future). (Consolidated from 8 → 5 focused tests)
- **Absence arming:** Added arm template → close panel → tap month-view day → verify vacation icon testID. (+3 tests, absences now 11)

**Friction points encountered and fixed:**

| Friction | Root cause | Fix |
|----------|-----------|-----|
| Xcode build.db lock after interrupted build | First `expo run:ios` attempt was piped through `head`, leaving a zombie xcodebuild holding the lock | `build:ios` script now clears stale lock before building |
| Jest 5s timeout instead of 120s | Running jest from `mobile-app/` didn't find `e2e/jest.config.js` | Config uses `__dirname` for paths; all npm scripts pass `--config jest.config.js` explicitly |
| `isLocationConfigured` false positive | Checked wrong screen (Settings) with wrong i18n key (`addLocation` ≠ actual button text) | Checks Status screen for `add-workplace-button` testID |
| GPS dialog blocks location wizard | "Standort nicht verfügbar" native alert appears on simulators after map loads; `dismissSystemDialogs` ran too early | `completeLocationWizard` has dedicated `acceptAlert()` retry loop (5 attempts, 500ms apart) |
| Stale setup wizard covering tab bar | Previous test run left wizard open → `ensureAuthenticated` couldn't find tab bar → assumed not logged in → cascading failures | `ensureAuthenticated` tries up to 3 back-taps before assuming not authenticated |
| Save test assumed form would close | Today's default end time (16:00) is in the future before 4 PM → save disabled | Test checks `isEnabled()` and handles both paths (save or validation) |

**New helpers in `actions.js`:**
- `ensureLocationConfigured(driver, returnToTab)` — checks Status for `add-workplace-button`, runs wizard if needed
- `ensureCleanCalendarState(driver)` — dismisses panels, navigates to calendar week view
- `ensureAuthenticated` — now includes back-tap recovery for stale navigation stacks

**Infrastructure improvements:**
- `start-infra.sh` starts Metro bundler alongside Appium for `ios`/`both`
- Added `test:absences` and `test:manual-session` npm scripts
- All npm scripts include explicit `--config jest.config.js`

**Files changed:**
- `e2e/helpers/actions.js` — new helpers, `ensureAuthenticated` recovery, `completeLocationWizard` GPS dialog handling
- `e2e/flows/shifts.test.js` — double-tap week-view arming (12 tests)
- `e2e/flows/absences.test.js` — arming + month-view verification (11 tests)
- `e2e/flows/manual-session.test.js` — rewritten with location setup + validation handling (5 tests)
- `e2e/package.json` — `build:ios` lock cleanup, `--config` flags, new test scripts
- `e2e/jest.config.js` — `rootDir` + `__dirname` for cwd-independent config
- `e2e/start-infra.sh` — Metro startup for iOS
- `docs/E2E_TESTING_PLAN.md` — this entry

**Result:** 52/52 iOS passing. All 6 suites pass sequentially in ~280s.

### 2026-01-30 (session 1): E2E Expansion — 32 → 51 Tests

**Changes:**
- Added `dismissSystemDialogs()` and `waitForTestIdWithRetry()` robustness helpers
- Created `absences.test.js` (8 tests) and `manual-session.test.js` (8 tests)
- Extended `shifts.test.js` with template arming + month-view tests (+3 tests)
- Added testIDs to MonthView (day cells, indicators), ManualSessionForm (all form elements), TemplatePanel (absence form + rows)
- Added i18n selector keys: `logHours`, `vacation`, `sick`, `saveSession`
- Documented Appium vs Maestro decision, local build strategy, full testID reference
- Committed as `8d37e6d`, rebuilt on EAS (both platforms)

**Verified:** 51/51 iOS tests pass. MonthView `month-day-*` testIDs confirmed in accessibility tree via Maestro inspector. ManualSessionForm testIDs confirmed in JS bundle (skip is due to no-location app state, not missing testIDs).

### 2026-01-29: E2E Tests — Both Platforms 32/32, Zero Skips

Four sessions. (1) Modal→inline rendering fix for iOS E2E. (2) Refactored CalendarFAB, TemplatePanel, ManualSessionForm from `<Modal>` to `<Animated.View>`. (3) CalendarFAB accessibility props — iOS calendar: 0/7 → 7/7. (4) TemplatePanel accessibility fix + removed Android skip guards.

### 2026-01-28: Android E2E Stable (32/32)

Android fully passing. iOS had accessibility issues fixed in 2026-01-29 sessions.

### 2026-01-27: Android E2E — All 24 Tests Passing

Android permission handling, auth state management, FAB accessibility. Framework: Appium 3.1.2 + WebdriverIO + Jest + Node 22.

### 2026-01-26: iOS Working (24/24), Tab Fix

iOS 24/24 passing. Fixed `tabBarTestID` → `tabBarButtonTestID` for React Navigation v7.

### 2026-01-25: Accessibility Fixes + Maestro Investigation

Maestro testID detection fixed via `accessible={false}` on container Views. Maestro later abandoned for Appium (see Architecture Decisions).

### 2026-01-24: E2E Testing + MCP Integration

Auth + location flows validated. MCP servers configured (Maestro + mobile-mcp). Initial test framework setup.
