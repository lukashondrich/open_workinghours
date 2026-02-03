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
| **Stability** | ~100% (48/48) | ~75-80% (45-48/48) |
| **Time** | ~200s | ~130-160s |
| **Build** | `npm run build:ios` | `npm run build:android` or EAS |
| **Known flakiness** | None | Shifts test after absences (~25%) |
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
| Shifts test flaky after absences | Android | Panel not dismissed after double-tap | Known issue (~25% flake) |
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
