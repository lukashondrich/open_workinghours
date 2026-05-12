# E2E Tests

Cross-platform E2E tests for Open Working Hours using Appium + Jest.

---

## Runbook (Start Here)

### TL;DR

```bash
cd mobile-app/e2e
npm run infra:ios      # Terminal 1: start Appium + simulator
npm run test:ios       # Terminal 2: run tests
```

### Platform Comparison

| Factor | iOS | Android |
|--------|-----|---------|
| **Stability** | ~100% (48/48) | ~82% (45/55) — improving |
| **Time** | ~200s | ~260s |
| **Build** | `npm run build:ios` | `npm run build:android` or EAS |
| **Known flakiness** | None | Absences arm (picker state), manual-session (location wizard) |
| **Local build prereqs** | Xcode | Android Studio + NDK |

**Recommendation:** Run iOS first (more stable). Use Android for cross-platform verification.

### Pre-flight Checklist

```
[ ] 1. Simulator/emulator running?
      iOS:     xcrun simctl list devices | grep Booted
      Android: adb devices

[ ] 2. App installed with TEST_MODE?
      If unsure → rebuild (npm run build:ios or build:android)

[ ] 3. Appium server running?
      npm run infra:ios (or infra:android)

[ ] 4. Clean state needed?
      If tests skip flows ("location already configured"):
      iOS:     xcrun simctl uninstall booted com.openworkinghours.mobileapp
      Android: adb uninstall com.openworkinghours.mobileapp
      Then rebuild
```

### Quick Start by Platform

#### iOS

```bash
cd mobile-app/e2e

# One-time setup
npm install
npm install -g appium
appium driver install xcuitest

# Build app (first time or after native/testID changes)
npm run build:ios

# Run tests
npm run infra:ios      # Terminal 1
npm run test:ios       # Terminal 2
```

#### Android

```bash
cd mobile-app/e2e

# One-time setup
npm install
npm install -g appium
appium driver install uiautomator2

# Start emulator
emulator -list-avds              # List available
emulator -avd Pixel_7a &         # Start one

# Build app (requires Java + NDK, or use EAS)
npm run build:android            # Local build
# OR download from EAS:
# eas build:list --platform android --limit 1
# curl -L -o app-release.apk <APK_URL>
# adb install app-release.apk

# Run tests
npm run infra:android  # Terminal 1
npm run test:android   # Terminal 2
```

### Common Issues → Fixes

| Symptom | Platform | Likely Cause | Fix |
|---------|----------|--------------|-----|
| "No booted iOS simulator found" | iOS | Simulator not running | `open -a Simulator`, wait for boot |
| "No running Android emulator found" | Android | Emulator not running | `emulator -avd <name>` |
| WebDriverAgent build timeout | iOS | First run compiles WDA | Wait ~3-5 min (one-time) |
| "element not found" | Both | Wrong app state | Check if authenticated, verify testID exists |
| Tests pass but skip flows | Both | Stale app state | Uninstall app, rebuild |
| "Background Permission" dialog blocks | Android | In-app dialog not dismissed | Fixed in code (CONTINUE ANYWAY) |
| Shifts/absences/manual-session all fail | Android | FAB hidden — stale calendar state | Call `ensureCleanCalendarState()` in `beforeAll` |
| Shifts test flaky after absences | Android | Panel not dismissed after double-tap | Use `inline-picker-cancel` to close |
| Node version error | Both | Using Node 23 | Use Node 20 or 22 |
| FAB not visible | Both | In month view | Switch to week view first |
| Manual session form empty | Both | No location configured | `ensureLocationConfigured()` handles this |

### Run Individual Suites

```bash
npm run test:auth           # 5 tests, ~10s
npm run test:calendar       # 7 tests, ~35s
npm run test:location       # 11 tests, ~10s
npm run test:shifts         # 9 tests, ~80s
npm run test:absences       # 11 tests, ~75s
npm run test:manual-session # 5 tests, ~85s
```

---

## Reference

### Prerequisites

- **Node 20 or 22** (Appium 3.x doesn't support Node 23)
- Appium installed globally with drivers
- iOS Simulator or Android Emulator

### Test Structure

```
e2e/
├── start-infra.sh       # Infrastructure startup script
├── helpers/
│   ├── driver.js        # Appium driver setup + auto-detection
│   ├── selectors.js     # Cross-platform element selectors (bilingual)
│   └── actions.js       # Common test actions + recovery helpers
├── flows/
│   ├── auth.test.js         # 5 tests - authentication state
│   ├── calendar.test.js     # 7 tests - navigation, FAB, views
│   ├── location.test.js     # 11 tests - setup wizard
│   ├── shifts.test.js       # 9 tests - templates, arming, placement
│   ├── absences.test.js     # 11 tests - absence templates
│   └── manual-session.test.js # 5 tests - Log Hours form
├── jest.config.js       # 120s timeout, verbose
└── package.json         # webdriverio ^9, jest ^29
```

### Infrastructure Script

The `start-infra.sh` script handles Node version compatibility and starts all required services:

```bash
./start-infra.sh          # Appium only
./start-infra.sh ios      # Appium + boot iOS simulator + Metro
./start-infra.sh android  # Appium + start Android emulator
./start-infra.sh both     # Everything
```

**What it does:**
1. Uses Node 22 (required for Appium 3.x)
2. Kills any existing Appium processes
3. Starts Appium server
4. Optionally boots iOS simulator or Android emulator
5. Starts Metro bundler (for iOS)
6. Waits for everything to be ready

### Device Auto-Detection

Tests automatically detect running simulators/emulators - no hardcoded device IDs.

- **iOS:** Finds first booted simulator via `xcrun simctl list devices booted`
- **Android:** Finds first emulator via `adb devices`

**Override with environment variables:**
```bash
IOS_UDID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX npm run test:ios
ANDROID_DEVICE=emulator-5556 npm run test:android
```

### Cross-Platform Selectors

testIDs are accessed differently on each platform:

```javascript
// iOS uses accessibility id
driver.$('~calendar-fab')

// Android uses resource-id
driver.$('android=new UiSelector().resourceId("calendar-fab")')

// Use helper for cross-platform
const { byTestId } = require('./helpers/selectors');
const element = await byTestId(driver, 'calendar-fab');
```

### Bilingual Text Matching

The app displays German or English based on device locale. Tests handle both:

```javascript
const { byI18nFast } = require('./helpers/selectors');

// Matches either "Kalender" (German) or "Calendar" (English)
const tab = await byI18nFast(driver, 'calendar');

// Available keys: status, calendar, settings, week, month, last14Days, etc.
```

### Test Design: Handling Variable State

Tests handle variable app state gracefully:

```javascript
let canTestWizard = false;

test('should check if Add Location is available', async () => {
  canTestWizard = await addButton.isDisplayed();
  if (!canTestWizard) {
    console.log('  ℹ Location already configured - wizard tests will be skipped');
  }
});

test('should open wizard', async () => {
  if (!canTestWizard) {
    console.log('  ⏭ Skipped: location already configured');
    return;
  }
  // ... actual test
});
```

### Builds

#### When to Rebuild

| Scenario | Rebuild needed? |
|----------|-----------------|
| Changed JS logic only | No — Metro serves latest |
| Changed `testID` or `accessible` props | **Yes** — baked into native view tree |
| Added/removed native modules | **Yes** |
| Changed `app.json` or plugins | **Yes** |
| TEST_MODE code changes (mockApi.ts, etc.) | **Yes** — constants baked at build time |
| Want clean app state | **Yes** (or uninstall first) |

#### Local Builds

```bash
cd mobile-app/e2e
npm run build:ios      # TEST_MODE=true, Release config
npm run build:android  # TEST_MODE=true, Release variant (requires Java + NDK)
```

First build compiles all native modules (~4 min). Subsequent builds are incremental (~1 min).

#### Cloud Builds (EAS)

```bash
cd mobile-app
eas build --profile e2e-testing --platform ios
eas build --profile e2e-testing --platform android
```

### TEST_MODE Features

When built with `TEST_MODE=true`, the app enables E2E optimizations:

| Feature | What it does | File |
|---------|--------------|------|
| **Mock auth** | Code `123456` authenticates, no real email | `AuthService.ts` |
| **Mock geocoding** | Returns "Charité Berlin" instantly, no network | `GeocodingService.ts` |
| **Skip panel animations** | TemplatePanel, ManualSessionForm open instantly | Component `useEffect`s |
| **Skip pulse animations** | Tracking badges have stable opacity | `WeekView.tsx`, `HoursSummaryWidget.tsx` |

All controlled by `isTestMode()` in `src/lib/testing/mockApi.ts`.

**Without TEST_MODE:**
- Auth requires real email verification
- Geocoding has 8s timeout, may fail on emulators
- Animations cause timing flakiness in tests

### Platform-Specific Notes

#### iOS

- First run takes several minutes to build WebDriverAgent (one-time)
- Uses XCUITest driver
- `getValue()` works on text inputs
- System dialogs: `driver.getAlertText()` + `acceptAlert()`

#### Android

- Uses UiAutomator2 driver
- `getValue()` doesn't work on text inputs → use `getText()` instead
- `acceptAlert()` silently no-ops → use text-based button taps
- Needs `activateApp()` after session changes
- Permission dialogs use resource IDs
- Back button: `driver.back()` or `driver.pressKeyCode(4)`

**React Navigation v7 fix:** Use `tabBarButtonTestID` (not `tabBarTestID`) for tab buttons.

```tsx
// WRONG - doesn't work on Android
<Tab.Screen options={{ tabBarTestID: 'tab-status' }} />

// CORRECT - works on both platforms
<Tab.Screen options={{ tabBarButtonTestID: 'tab-status' }} />
```

**Android testID visibility:** If testIDs aren't found:

```tsx
// ❌ BAD - parent aggregates children
<View>
  <TouchableOpacity testID="btn-1">...</TouchableOpacity>
</View>

// ✅ GOOD - children individually accessible
<View accessible={false} collapsable={false}>
  <TouchableOpacity testID="btn-1" accessible={true}>...</TouchableOpacity>
</View>
```

### Troubleshooting (Detailed)

#### Node version issues
Appium 3.x requires Node 20, 22, or 24+ (NOT 23):
```bash
node -v  # Check version

# Use the infrastructure script (handles this automatically)
npm run infra:ios

# Or manually use Node 22
/opt/homebrew/opt/node@22/bin/node $(which appium) --allow-cors --relaxed-security
```

#### Element not found
1. Check if app is in expected state (logged in vs. welcome screen)
2. Verify testID exists in the app code
3. For Android, element may need `accessible={true}` in the component
4. Parent View may need `accessible={false}` to expose children

#### Suite failures after long runs
WebDriverAgent becomes unresponsive. Restart infra or run suites in smaller batches.

---

## Android E2E: Lessons & Pitfalls

Hard-won lessons from debugging Android E2E flakiness (2026-03-24/25). These issues do NOT affect iOS.

### 1. FAB is conditionally hidden — tests must ensure clean state

The `CalendarFAB` component hides the FAB button when any of these are true:
- `state.view === 'month'`
- `state.inlinePickerOpen`
- `state.templatePanelOpen`
- `state.manualSessionFormOpen`

**Problem:** App data persists across test runs (`expo run:android` uses `adb install`, not a clean install). If a previous run left the calendar in month view, the next run's shifts/absences/manual-session tests fail immediately because `calendar-fab` doesn't exist.

**Fix:** Every suite that needs the FAB must call `ensureCleanCalendarState(driver)` in `beforeAll`, AFTER `ensureAuthenticated()`. This function:
1. Navigates to the Calendar tab
2. Checks if FAB is visible
3. If not, presses back (to dismiss any open panel/picker)
4. If still not, clicks the `toggle-week` testID (to exit month view)

**Gotcha:** Do NOT press back before navigating to the Calendar tab. On Android, pressing back from the main screen exits the app. Navigate first, then dismiss.

### 2. `byI18nFast` text matching is unreliable on Android during animations

`byI18nFast` uses `UiSelector().textMatches("(?i).*(Woche|Week).*")` which relies on UiAutomator2 reading the element's text. During view transitions or when the element is partially rendered, text may not be exposed.

**Fix:** Use `byTestId` with dedicated testIDs for elements that are tapped during transitions. The Week/Month toggle now has `testID="toggle-week"` and `testID="toggle-month"`.

**When `byI18nFast` is still fine:** For elements that are fully rendered and static when tapped (e.g., tab labels, "Last 14 Days" heading, "Save" buttons). Only replace it where you hit flakiness.

### 3. Overlay click lands inside the InlinePicker on Android

`closeTemplatePanel()` taps the `template-panel-overlay` element. UiAutomator2 clicks at the element's center coordinates. But the InlinePicker container sits on top of the overlay, so the center click (540, ~1000) lands inside the picker instead of on the transparent overlay behind it.

**Fix:** Try `inline-picker-cancel` testID first (most reliable). Fall back to coordinate tap at the top of the overlay (y=150, above the picker). Fall back to `driver.back()`.

```javascript
// Reliable dismiss order for Android:
// 1. Try inline-picker-cancel button
// 2. Tap overlay at coordinates above the picker
// 3. driver.back()
```

### 4. Nested TouchableOpacity needs accessibility props for UiAutomator2

Template rows are `TouchableOpacity` elements containing a nested `TouchableOpacity` (edit button). Without explicit accessibility props, UiAutomator2 may not expose the parent's `testID` as a `resource-id`.

**Fix:** Add `accessible={true}` and `accessibilityRole="button"` to the parent row. Add `accessible={false}` to the nested edit button so it doesn't aggregate.

```tsx
// Parent row — must be individually accessible
<TouchableOpacity testID="template-row-0" accessible={true} accessibilityRole="button">
  {/* Nested button — must NOT aggregate into parent */}
  <TouchableOpacity onPress={handleEdit} accessible={false}>
    <Pencil />
  </TouchableOpacity>
  {/* ... rest of row content */}
</TouchableOpacity>
```

### 5. TemplatePanel animation must skip in TEST_MODE

The TemplatePanel's 300ms open/close animation (`Animated.timing`) creates race conditions on Android. Tests may interact with elements before the animation completes, or the animation may not complete reliably under emulator load.

**Fix:** Check `isTestMode()` and use `animValue.setValue()` instead of `Animated.timing()`:

```tsx
useEffect(() => {
  if (isTestMode()) {
    animValue.setValue(isOpen ? 1 : 0);
    return;
  }
  Animated.timing(animValue, { toValue: isOpen ? 1 : 0, duration: 300, useNativeDriver: true }).start();
}, [isOpen]);
```

This pattern is already used in `ManualSessionForm.tsx`, `WeekView.tsx`, and `HoursSummaryWidget.tsx`.

### 6. Emulator instability: UiAutomator2 initialization timeouts

The Android emulator can become unresponsive after extended test runs, showing "Process system isn't responding" dialogs and UiAutomator2 server launch timeouts.

**Symptoms:**
- `The instrumentation process cannot be initialized within 30000ms timeout`
- `Command 'adb shell getprop ...' timed out after 20000ms`
- All suites fail in `beforeAll` at `createDriver()`

**Fixes applied:**
- `driver.js`: Added `uiautomator2ServerLaunchTimeout: 60000` and `adbExecTimeout: 40000` to Android capabilities
- Default 20s/30s timeouts were too tight for emulators under load

**Recovery when it happens:**
```bash
# 1. Kill emulator
adb emu kill

# 2. Cold boot with clean state
emulator -avd <name> -no-snapshot -wipe-data

# 3. Wait for full boot
adb wait-for-device && adb shell getprop sys.boot_completed

# 4. Uninstall stale UiAutomator2 server (prevents conflicts)
adb uninstall io.appium.uiautomator2.server
adb uninstall io.appium.uiautomator2.server.test

# 5. Restart Appium
lsof -i :4723 -t | xargs kill -9
npm run infra:android

# 6. Rebuild app (wipe-data removed it)
npm run build:android
```

### 7. Subagent error reports can be wrong — always get verbatim output

When using Bash subagents to run E2E tests, the subagent may summarize or paraphrase error messages. This can lead to investigating the wrong root cause.

**Example:** A subagent reported `save-template-button not displayed after 5000ms`. The actual testID is `template-save`, and the real error was `calendar-fab still not existing after 5000ms` — a completely different element and root cause. Three debug cycles were wasted on template row accessibility before discovering this.

**Fix:** Always instruct the subagent to copy error messages **verbatim** from Jest output. Include this in the prompt:
```
For the FIRST failing test in each failing suite, copy the EXACT error message
(verbatim, not paraphrased). Do NOT summarize or rephrase errors.
```

### 8. Test execution order matters — Jest runs failing tests first

Jest's default test sequencer prioritizes previously-failing test files. This means the execution order is NOT alphabetical — it's based on the `.jest-cache`. Suites that failed in the last run will execute first.

This affects state-dependent tests: if shifts runs before registration (because shifts failed last time), `ensureAuthenticated()` must handle the full registration + login flow in shifts' `beforeAll`.

**To force alphabetical order:** Delete `.jest-cache/` or use `--no-cache`.

**To see actual order:** Use `--verbose` and check the suite sequence in output.

### 9. InlinePicker ScrollView maxHeight clips form buttons

The absences/shifts template list and the inline create form share a `ScrollView` with `maxHeight` (in `InlinePicker.tsx`, style `listContainer`). When 3+ templates exist AND the create form is open, the form's Save/Cancel buttons are clipped below the maxHeight.

**Symptoms:** `absence-save` testID not found after tapping `absence-add`. The keyboard auto-focuses the name input, making it worse.

**Fix (2026-03-25):** Increased `maxHeight` from 300 to 450 in `InlinePicker.tsx`. Tests also dismiss the keyboard and scroll before looking for the save button.

**Key learning:** Always dismiss the keyboard on Android before asserting elements exist below a text input. Android keyboards push content but UiAutomator2 may not find elements outside a ScrollView's visible bounds.

### 10. Arming a template closes the InlinePicker instantly in TEST_MODE

Tapping a template row in the InlinePicker arms it AND places it on the target date, then the picker closes. In TEST_MODE the close animation is instant (`animValue.setValue(0)` instead of `Animated.timing`).

**Symptoms:** Test asserts `templateRow.isExisting()` after clicking to arm — returns false because the picker (and the row) no longer exist.

**Fix:** After clicking to arm, check if the panel is still open. If closed (Android/TEST_MODE), skip the close step and verify the FAB is visible instead.

### 11. "Add Workplace" goes to Permissions screen, not the setup wizard

On a fresh install (or after permission revocation), tapping "Add Workplace" on the Status screen navigates to an **in-app Permissions screen** (showing Location Foreground/Background status) instead of the location setup wizard. The test helper `completeLocationWizard()` expects to find `setup-search-input` but gets the Permissions screen instead.

**Root cause:** The app checks `ACCESS_BACKGROUND_LOCATION` before opening the wizard. If denied, it redirects to the Permissions screen. On emulators, background location is never granted by default — the registration flow only grants foreground permission.

**Fix (in `completeLocationWizard`):**
```javascript
// Grant background permission + high-accuracy mode before starting wizard
execSync('adb shell pm grant com.openworkinghours.mobileapp android.permission.ACCESS_BACKGROUND_LOCATION');
execSync('adb shell settings put secure location_mode 3');

// CRITICAL: Force-restart the app — it caches permission state at startup
await driver.terminateApp('com.openworkinghours.mobileapp');
await driver.activateApp('com.openworkinghours.mobileapp');
```

**Why restart is required:** The `adb shell pm grant` command grants the permission at the OS level, but the app's JavaScript code (expo-location) caches the permission result. Without restarting, the app still thinks the permission is denied.

### 12. Google "Location Accuracy" dialog blocks the wizard on Android emulators

After the setup wizard opens the map, Google Play Services may show a "For a better experience, your device will need to use Location Accuracy" dialog with "No thanks" / "Turn on" buttons. This dialog is rendered by Google Play Services in a **separate system window**.

**Problem:** This dialog is NOT accessible via UiAutomator2 even with `enableMultiWindows: true`. Neither `dismissNativeDialog` nor coordinate taps via mobile-mcp can dismiss it. `adb shell input tap` also fails.

**Fix:** Pre-configure high-accuracy mode via `adb shell settings put secure location_mode 3` BEFORE the wizard opens. If the mode is already on, the dialog doesn't appear.

**Fallback if it appears:** `adb shell input keyevent KEYCODE_BACK` dismisses it, but also exits the wizard. The test must then re-navigate to the wizard.

### Session Log: 2026-03-25 — Android E2E Stabilization

**Starting state:** 36/55 (65%) — auth, calendar, registration pass; shifts, absences, location, manual-session fail

**Ending state:** 45/55 (82%) — 5/7 suites fully green

| Suite | Before | After | Key Fix |
|-------|--------|-------|---------|
| Auth | 5/5 | 5/5 | — |
| Registration | 7/7 | 7/7 | — |
| Calendar | 7/7 | 7/7 | Added `ensureCleanCalendarState` |
| Location | 11/11 | 11/11 | 15s geocoding wait, dialog dismissal |
| Shifts | 4/9 | **9/9** | Fixed arm assertion (picker closes), FAB recovery |
| Absences | 2/11 | **6/11** | maxHeight 300→450, keyboard dismiss, picker close |
| Manual Session | 0/5 | **0/5** | adb permission grant + restart (fix applied, not yet verified) |

**Remaining failures (10 tests across 2 suites):**

1. **Absences "arm" + downstream (5 tests):** The persist test now closes the picker. Fix applied but not yet verified in a test run.

2. **Manual Session (5 tests):** Cascading failure from location wizard. `completeLocationWizard` now grants permission via adb and restarts the app. Fix applied but not yet verified. The Google Location Accuracy dialog may still appear — the `location_mode 3` pre-config should prevent it but was not confirmed.

**Changes made (native — used 2 builds):**
- `InlinePicker.tsx`: `listContainer.maxHeight` 300 → 450
- `CalendarHeader.tsx`: `testID="toggle-week"` / `testID="toggle-month"` (pre-existing from 03-24)
- `TemplatePanel.tsx`: `isTestMode()` animation skip (pre-existing from 03-24)

**Changes made (test code — no rebuild needed):**
- `selectors.js`: `byTestId` Android regex anchored to `"(.*:id/)?${testId}$"` (prevents substring matches)
- `calendar.test.js`: Added `ensureCleanCalendarState()` in `beforeAll`
- `location.test.js`: 15s geocoding wait + dialog dismissal after wizard open
- `shifts.test.js`: Arm test handles panel close, renamed follow-up test
- `absences.test.js`: Keyboard dismiss + scroll in create test, picker close after persist
- `actions.js`: `completeLocationWizard` — adb permission grant + app restart + `location_mode 3`

**Next session TODO:**
1. Run full Android suite to verify absences arm + manual-session fixes (no rebuild needed)
2. If manual-session still fails: investigate Google Location Accuracy dialog interactively — may need to pre-enable location services on the emulator snapshot
3. Consider adding adb permission grants to `ensureAuthenticated()` so all suites benefit early
4. If all 55 pass: update this table and consider adding the fixes to iOS test path too

---

## Deep Dive

For detailed reference information, see **[docs/E2E_TESTING_PLAN.md](../../docs/E2E_TESTING_PLAN.md)**:

- **Session logs** — Historical record of changes and fixes
- **Architecture decisions** — Why Appium (not Maestro), why inline Animated.View (not Modal)
- **Robustness helpers** — `dismissNativeDialog`, `ensureAuthenticated`, `waitForTestIdWithRetry`, etc.
- **testID reference** — Complete list of testIDs by component
- **Known issues backlog** — Open items for future sessions
- **Test coverage** — What's tested, what's not yet covered

---

## Comparison with Maestro

| Aspect | Maestro | Appium |
|--------|---------|--------|
| Test format | YAML | JavaScript |
| Android support | Broken (2.1.0) | Works |
| iOS support | Works | Works |
| Auto-detection | No | Yes |
| Bilingual | Manual | Automatic |
| Debugging | Limited | Full IDE support |

Maestro flows are kept in `.maestro/` for reference (iOS only). Maestro MCP tools are still useful for interactive debugging.
