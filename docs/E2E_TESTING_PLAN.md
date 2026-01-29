# E2E Testing

**Updated:** 2026-01-29
**Status:** 32/32 passing on both iOS and Android

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
| calendar | 7 | Tab navigation, FAB menu, week prev/next, month/week toggle |
| shifts | 8 | FAB → shifts panel, create template, edit name, save, persistence, close |
| location | 11 | Settings nav, add location wizard (search → radius → name), conditional skip if configured |
| **Total** | **32** | |

### Not yet covered (next priorities)

**High — core user flows:**
1. Absence template creation (mirrors shift flow, absences tab)
2. Template arming + day tap (arm template → tap calendar day → verify instance)
3. Manual session logging (FAB → Log Hours → form → save)

**Medium — important but less frequent:**
4. Shift/absence deletion + confirm alert
5. Overlap detection (two overlapping shifts → warning)
6. Settings (language toggle, account info)
7. Location management (edit/delete existing)

**Lower — complex to simulate:**
8. Data submission to backend (needs connectivity or mocking)
9. Geofencing dashboard (needs location simulation)
10. 14-day planned/tracked hours chart

---

## Known Flakiness & Robustness Issues

Track issues here as they appear. The goal is to fix each one with a helper or pattern, not just note it.

| Issue | Frequency | Current workaround | Proper fix |
|-------|-----------|-------------------|------------|
| FAB menu items not found on first tap | Occasional (iOS) | Retry logic in `calendar.test.js` with 15s timeout | Generic retry helper for flaky element interactions |
| `isDisplayed()` unreliable for inline Animated.Views | Always | Use `isExisting()` instead | Document as standard pattern (not a bug) |
| Android `getValue()` doesn't work on text inputs | Always | Use `getText()` on Android | Platform branch in helper |
| First iOS run slow (WebDriverAgent build) | First run only | Wait | N/A — one-time cost |

### Timing log

Track how long test runs take to spot regressions:

| Date | Platform | Total time | Notes |
|------|----------|-----------|-------|
| _(fill in next run)_ | | | |

---

## Architecture Decisions

### Why Appium (not Maestro)

Maestro 2.1.0 cannot connect to Android emulators (gRPC port 7001 failure, no fix available). Appium works on both platforms. Legacy Maestro flows are in `.maestro/` for reference only.

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
| System permission dialogs | "Allow" / "Erlauben" | Resource ID: `com.android.permissioncontroller:id/permission_allow_button` |
| App locale | Follows device | Follows device |

### TEST_MODE builds

E2E tests require `TEST_MODE=true` builds (mock auth with code "123456"):

```bash
eas build --profile e2e-testing --platform ios
eas build --profile e2e-testing --platform android
```

---

## File Reference

```
mobile-app/e2e/
├── helpers/
│   ├── driver.js       # Appium caps, device auto-detection
│   ├── selectors.js    # byTestId, byI18nFast, bilingual dictionary
│   └── actions.js      # tapTestId, ensureAuthenticated, dismissPermissionDialogs
├── flows/
│   ├── auth.test.js
│   ├── calendar.test.js
│   ├── location.test.js
│   └── shifts.test.js
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
