# Calendar Export — E2E Validation Results

**Date:** 2026-04-29
**Branch:** `worktree-feature-calendar-export`
**Test file:** `mobile-app/e2e/flows/calendar-export.test.js` (13 tests)
**Appium:** 3.1.2, XCUITest 9.10.5, UiAutomator2 4.2.9
**Node:** 22.22.0 (via `/opt/homebrew/opt/node@22/bin`)

---

## Summary

| Platform | Pass | Fail | Total | Notes |
|----------|------|------|-------|-------|
| **iOS** (iPhone 15 Pro, iOS 17.5) | 9 | 4 | 13 | Sign-out flow tests fail |
| **Android** (Pixel 7a emulator, API 36) | 2 | 11 | 13 | Navigation to Settings broken |

---

## iOS Results (9/13)

### Passing Tests

| # | Test | Time |
|---|------|------|
| 1 | should navigate to Settings and see calendar sync section | 2.4s |
| 2 | should have calendar sync initially disabled | 4.0s |
| 3 | should enable calendar sync and handle permission | 5.1s |
| 4 | should not show warning when permission is granted | 66ms |
| 5 | should disable sync with "Keep exported events" | 4.2s |
| 6 | should re-enable sync after disabling with keep | 4.9s |
| 7 | should disable sync with "Delete exported events" | 4.2s |
| 8 | should cancel disable dialog without changing state | 8.6s |
| 11 | should re-authenticate after sign-out for further tests | 15.4s |

### Failing Tests

| # | Test | Root Cause |
|---|------|------------|
| 9 | should show sign-out calendar dialog when sync enabled | Checks `tab-settings` which doesn't exist |
| 10 | should handle sign-out with "Keep events" | Cascades from #9; `login-button` not found |
| 12 | should sign-out with "Remove events" when sync enabled | Same cascade; sign-out dialog flow not completing |
| 13 | should re-authenticate and verify sync is disabled | Toggle still enabled (prior sign-out didn't happen) |

**Root cause analysis:**

Test 9 scrolls to the sign-out button, taps it, confirms the first dialog ("Abmelden"), expects a second calendar-specific dialog, taps Cancel, then verifies the user is still authenticated by checking `existsTestId(driver, 'tab-settings')`. But **there is no `tab-settings` testID** — the app uses a gear icon (`settings-gear-button`) instead of a settings tab. The assertion fails, cascading to tests 10, 12, and 13.

Secondary issue: the sign-out + calendar dialog flow uses chained `Alert.alert()` calls (first dialog confirm triggers second dialog). The test expects to see a second dialog appear after confirming the first, but the timing and button text matching may be fragile on iOS.

### Fixes Needed (iOS)

1. **Test line 385:** Change `existsTestId(driver, 'tab-settings')` → `existsTestId(driver, 'tab-status')` or `existsTestId(driver, 'settings-gear-button')`
2. **Test `navigateToCalendarSync()`:** This calls `navigateToTab(driver, 'settings')` which relies on the gear button's accessibility label matching "Einstellungen" via `byText()`. This works on iOS but is fragile — should use `tapTestId(driver, 'settings-gear-button')` instead.
3. **Sign-out dialog sequence:** Add more pause between chained Alert dialogs. The first dialog's destructive button triggers a second dialog; the test needs to wait for the second dialog to appear before trying to tap its buttons.

---

## Android Results (2/13)

### Passing Tests

| # | Test | Time |
|---|------|------|
| 4 | should not show warning when permission is granted | 103ms |
| 11 | should re-authenticate after sign-out for further tests | 1.3s |

Both pass trivially — test 4 checks a testID doesn't exist (always true when on wrong screen), test 11 just calls `ensureAuthenticated()`.

### Failing Tests

All 11 failures cascade from test 1:

**Test 1 error:**
```
element ("android=new UiSelector().textContains("Settings")") still not displayed after 5000ms
```

`navigateToTab(driver, 'settings')` → tries `tab-settings` testID (not found) → falls back to `byText("Einstellungen")` then `byText("Settings")`. On Android, `byText` uses `UiSelector().textContains()` which searches visible text, not accessibility labels. The gear button has no visible "Einstellungen" text, so it fails.

### Fixes Needed (Android)

1. **Replace `navigateToTab(driver, 'settings')`** with `tapTestId(driver, 'settings-gear-button')` in the `navigateToCalendarSync()` helper.
2. **Or add `navigateToSettings()` to `actions.js`** that taps the gear button by testID, separate from `navigateToTab()`.
3. After fixing navigation, re-run to discover any Android-specific calendar permission or dialog issues.

---

## Code Fix Applied: ListItem Accessibility

**File:** `mobile-app/src/components/ui/ListItem.tsx`

**Problem:** `ListItem` uses `TouchableOpacity` which defaults to `accessible={true}` on iOS. This aggregates all children into a single XCUITest element, hiding the `Switch` with `testID="calendar-sync-toggle"` from Appium.

**Before fix:** iOS saw the calendar-sync ListItem as one element with concatenated text. The `calendar-sync-toggle` testID was invisible. All 13 tests failed.

**Fix:** Added `accessible={!rightElement}` to the `TouchableOpacity`:

```tsx
<TouchableOpacity
  ...
  testID={testID}
  accessible={!rightElement}  // Break aggregation when interactive children present
>
```

**After fix:** The Switch is individually exposed in the XCUITest accessibility tree. iOS toggle tests pass (tests 1-8).

**Impact:** Only affects ListItems that pass `rightElement` (currently: calendar-sync). Navigation ListItems (no `rightElement`) remain single accessible elements — no behavior change.

---

## Environment Notes

- **Node 23.x incompatible:** Appium 3.1.2 requires `>=20.19.0 <23.0.0 || >=24.0.0`. Used `node@22` via Homebrew (`/opt/homebrew/opt/node@22/bin`).
- **Release builds required:** E2E tests run against Release builds (TEST_MODE=true baked in at build time). Debug builds use Metro and don't bundle JS inline.
- **iOS simulator reboots:** The simulator shut down between consecutive test runs. Need to verify it's booted before each run.
- **Appium XCUITest driver warning:** `appium-xcuitest-driver` has a peer dependency on Appium ^2.5.4 (we use 3.1.2). Works despite the warning.

---

## Next Steps

1. Fix `navigateToCalendarSync()` to use `tapTestId(driver, 'settings-gear-button')` instead of `navigateToTab(driver, 'settings')`
2. Fix sign-out assertion to use `tab-status` instead of `tab-settings`
3. Add timing for chained Alert dialogs in sign-out flow
4. Re-run iOS — target 13/13
5. Re-run Android — target 9+/13 (sign-out tests may need same fixes)
6. Consider adding `navigateToSettings()` helper to `actions.js` for reuse across test suites
