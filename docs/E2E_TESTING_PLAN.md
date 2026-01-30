# E2E Testing

**Updated:** 2026-01-30
**Status:** 51/51 passing on iOS (Android not yet re-tested with new build)

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

# Start infrastructure (terminal 1)
npm run infra:ios      # or infra:android, infra:both

# Run tests (terminal 2)
npm run test:ios       # or test:android
npm run test:shifts    # single suite: auth, calendar, location, shifts
```

See `mobile-app/e2e/README.md` for full setup (driver installation, device auto-detection, env overrides).

---

## Test Coverage

| Suite | Tests | What's covered |
|-------|-------|----------------|
| auth | 6 | Welcome screen → email → code → registration → main app |
| calendar | 7 | Tab navigation, FAB menu (with retry), week prev/next, month/week toggle |
| shifts | 11 | FAB → shifts panel, create template, edit name, save, persistence, arm template, month-view day tap, close |
| absences | 8 | FAB → absences panel, create absence template, edit name, save, persistence, close |
| manual-session | 8 | FAB → Log Hours, verify form opens, check form elements, close form |
| location | 11 | Settings nav, add location wizard (search → radius → name), conditional skip if configured |
| **Total** | **51** | |

### Not yet covered (next priorities)

**High — extend existing suites:**
1. Template arming → week-view day tap → verify shift instance (current arming test taps month view which just navigates, doesn't create instance)
2. Manual session save (requires location to be configured first in test app)
3. Absence arming → day tap → verify absence icon in month view

**Medium — new flows:**
4. Shift/absence deletion + confirm alert
5. Overlap detection (two overlapping shifts → warning)
6. Settings (language toggle, account info)
7. Location management (edit/delete existing)

**Lower — complex to simulate:**
8. Data submission to backend (needs connectivity or mocking)
9. Geofencing dashboard (needs location simulation)
10. 14-day planned/tracked hours chart

---

## Known Issues

### Test-level issues (not app bugs)

| Issue | Root cause | Status |
|-------|-----------|--------|
| Shift arming month-view verification skips | Tapping a day in month view switches to week view — it doesn't create a shift instance. Shift creation from an armed template requires tapping a day column in week view. | Test logic needs adjustment |
| Manual session form fields skip | Form shows "Please add a location first" when no location is configured. Save/location/date/time elements aren't rendered. | Tests need location wizard to complete first |
| WebDriver WARN logs for `getAlertText()` | WebDriverIO retries `getAlertText()` 3 times before throwing, producing WARN/ERROR logs. | Cosmetic — doesn't affect results |
| Suite ordering can cause staleness | Running all 6 suites sequentially (5+ min) can overwhelm WebDriverAgent. Later suites may fail with session timeouts. | Run in smaller batches or restart infra between batches |

### Flakiness & robustness

| Issue | Frequency | Fix |
|-------|-----------|-----|
| FAB menu items not found on first tap | Occasional (iOS) | `waitForTestIdWithRetry()` with retryAction (implemented) |
| `isDisplayed()` unreliable for inline Animated.Views | Always | Use `isExisting()` instead (documented pattern) |
| Android `getValue()` doesn't work on text inputs | Always | Use `getText()` on Android (platform branch in tests) |
| First iOS run slow (WebDriverAgent build) | First run only | Wait — one-time cost |

---

## Robustness Helpers

### `dismissSystemDialogs(driver, maxAttempts=5)`

Comprehensive dialog dismissal for both platforms. Called by `ensureAuthenticated()` at the start of every test suite.

- **iOS:** Uses `driver.getAlertText()` to detect native UIAlertController alerts (notification permission, location permission, Expo prompts), then `driver.acceptAlert()`. Falls back to text-based dismissal for app-level buttons (`OK`, `Allow`, `Erlauben`, `Dismiss`, `Got it`, `Not Now`, `Don't Allow`).
- **Android:** Reuses `dismissAndroidSystemDialog()` which finds buttons by UiAutomator resource IDs.
- Loops up to `maxAttempts` for stacked dialogs.

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

### Planned: Local Xcode Builds for Iteration

Local builds bypass EAS entirely for simulator testing. Use EAS only for device/TestFlight builds.

**Prerequisites (verified 2026-01-30):**
- Xcode 26.2 — installed
- macOS 15.7.3 — current
- CocoaPods 1.16.2 — installed
- `ios/` native project — already prebuilt with Pods installed
- Simulator runtimes — iOS 17.5, 18.6, 26.2 available

**Workflow:**
```bash
cd mobile-app

# One-time: regenerate native project if app.json/plugins changed
npx expo prebuild --platform ios
cd ios && pod install && cd ..

# Build and install on simulator (JS-only changes: ~1-2 min, full: ~5-15 min)
TEST_MODE=true npx expo run:ios --configuration Release

# Run E2E tests
cd e2e && npm run test:ios
```

**Advantages:**
- Iterate on testIDs without EAS builds (save credits, save time)
- First build is slow (5-15 min compiling native modules), subsequent builds are incremental
- No signing needed for simulator builds

**When to still use EAS:**
- TestFlight / production builds (need signing + distribution)
- Android APK builds (unless Android Studio is set up locally)
- CI/CD pipeline builds

**Potential friction:**
- Expo SDK 54 + Xcode 26.2 compatibility — EAS uses a known-good Xcode version; local may have edge cases
- `prebuild` drift — if `ios/` is stale, `npx expo prebuild --clean` regenerates it (then re-run `pod install`)

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

E2E tests require `TEST_MODE=true` builds (mock auth with code "123456"):

```bash
# Cloud (EAS)
eas build --profile e2e-testing --platform ios

# Local (planned)
TEST_MODE=true npx expo run:ios --configuration Release
```

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
│   ├── auth.test.js         # 6 tests
│   ├── calendar.test.js     # 7 tests
│   ├── shifts.test.js       # 11 tests
│   ├── absences.test.js     # 8 tests
│   ├── manual-session.test.js # 8 tests
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

## Session Log

### 2026-01-30: E2E Expansion — 32 → 51 Tests

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
