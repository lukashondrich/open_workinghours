# E2E Testing Plan

**Created:** 2026-01-22
**Updated:** 2026-01-24
**Status:** In Progress - Auth/location flows validated, MCP integration configured

---

## Overview

Setting up automated E2E testing for the mobile app with two complementary approaches:

1. **Maestro YAML flows** - Declarative, version-controlled tests for CI/CD
2. **MCP integration** - AI-assisted test development and interactive debugging

Both iOS and Android have equal priority. CI/CD integration is a near-term goal.

**Target Devices:**
- Android: Pixel 6 API 30, Pixel 7a API 34
- iOS: iPhone SE (3rd gen), iPhone 15, iPhone 15 Pro Max

**Priority Flows:**
1. Authentication (welcome → email verification → register with consent) ✅ **Validated**
2. Location Setup (search → map → name → save) - Pending
3. Calendar Shift Management (add template → place shift → confirm day) - Pending

---

## Flow Status

| Flow | Status | Notes |
|------|--------|-------|
| `auth/registration.yaml` | ✅ Working | Full registration flow validated |
| `location/setup.yaml` | ✅ Working | Full location setup flow validated |
| `calendar/shift-management.yaml` | ✅ Working | Coordinate-based flow (avoids accessibility bug) |

---

## Completed Work

### 1. Maestro Installation ✅
- Installed Maestro CLI v2.1.0 via `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Installed OpenJDK 17 (required dependency): `brew install openjdk@17`
- PATH setup: `export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH:$HOME/.maestro/bin"`

### 2. Directory Structure ✅
```
mobile-app/.maestro/
├── config.yaml           # Maestro configuration
├── flows/
│   ├── auth/
│   │   └── registration.yaml
│   ├── location/
│   │   └── setup.yaml
│   └── calendar/
│       └── shift-management.yaml
├── scripts/
│   ├── get-week-date.js  # Helper for dynamic dates
│   └── run-parallel.sh   # Multi-device runner
└── results/              # Test output directory
```

### 3. App Test Mode ✅
**Files created/modified:**

| File | Changes |
|------|---------|
| `app.config.js` | TEST_MODE with env var fallback to app.json value |
| `app.json` | Added `TEST_MODE: false` in extra (set true for testing) |
| `src/lib/testing/mockApi.ts` | Created - Mock API responses for auth endpoints |
| `src/modules/auth/services/AuthService.ts` | Added test mode bypass for all auth methods |

**Mock API Coverage:**
- `POST /verification/request` → Returns success (logs `[AuthService] TEST_MODE: Returning mock verification request`)
- `POST /verification/confirm` → Validates test code "123456"
- `POST /auth/register` → Returns mock user + token
- `POST /auth/login` → Returns mock user + token
- `GET /auth/me` → Returns mock user profile

**TEST_MODE Configuration:**
```javascript
// app.config.js - uses env var if set, otherwise falls back to app.json
TEST_MODE: process.env.TEST_MODE !== undefined
  ? process.env.TEST_MODE === 'true'
  : appJson.expo.extra.TEST_MODE,
```

### 4. testIDs Added ✅

| File | testIDs Added |
|------|---------------|
| `SetupScreen.tsx` | `setup-search-input`, `setup-search-result-${index}`, `setup-continue-step1`, `setup-continue-step2`, `setup-radius-decrease`, `setup-radius-increase`, `setup-name-input`, `setup-save-button`, `setup-back-button`, `setup-edit-button` |
| `ConsentBottomSheet.tsx` | `consent-terms-link`, `consent-privacy-link`, `consent-checkbox`, `consent-accept-button`, `consent-cancel-button` |
| `CalendarFAB.tsx` | `fab-shifts-option`, `fab-absences-option`, `fab-log-hours-option` (FAB already had `calendar-fab`) |

**Pre-existing testIDs (already in codebase):**
- Auth screens: `login-button`, `register-button`, `email-input`, `code-input`, `send-code-button`, `verify-code-button`, etc.
- Tab bar: `tabBarTestID` on each tab (doesn't work with Maestro - use text matching instead)
- Calendar: `calendar-fab`, `template-add`, `template-save`, `template-row-${index}`

### 5. Auth Registration Flow ✅ VALIDATED

The `flows/auth/registration.yaml` flow has been tested and works end-to-end:

**Flow steps:**
1. Launch app with `clearState: true`
2. Handle dev client launcher (tap Metro server URL)
3. Handle notification permission dialogs ("Erlauben")
4. Handle dev client onboarding ("Continue")
5. Close dev client debug panel
6. Welcome screen → tap Register
7. Email entry → enter test email → tap Send Code
8. Code entry → enter "123456" → tap Verify
9. Registration form → fill hospital, specialty, role, state
10. Consent modal → check checkbox → tap Accept
11. Verify main app loads (Status, Kalender, Einstellungen tabs)

### 6. Multi-Device Script ✅
`scripts/run-parallel.sh` created for parallel execution on multiple devices.

---

## Known Issues & Learnings

### 1. Dev Client Launcher Screen
- **Issue:** When using `clearState: true`, the dev client shows its launcher screen instead of auto-connecting
- **Solution:** Add steps to tap the Metro server URL (`http://localhost:8081`) in the flow
- **Code:**
  ```yaml
  - tapOn:
      text: "http://localhost:8081"
      optional: true
  ```

### 2. Notification Permission Dialogs
- **Issue:** iOS notification permission dialog appears at various points and blocks interaction
- **Solution:** Add optional taps for "Erlauben" (German for "Allow") throughout the flow
- **Code:**
  ```yaml
  - tapOn:
      text: "Erlauben"
      optional: true
  ```

### 3. Dev Client Debug Panel
- **Issue:** After connecting to Metro, a debug panel may open covering the app
- **Solution:** Tap outside the panel (gray overlay area) to dismiss it
- **Code:**
  ```yaml
  - tapOn:
      point: "50%, 25%"
  ```

### 4. TEST_MODE Configuration Override
- **Issue:** `app.config.js` was overwriting `TEST_MODE` from app.json with env var value (undefined → false)
- **Solution:** Fixed to use env var only if explicitly set, otherwise use app.json value
- **File:** `mobile-app/app.config.js`

### 5. Alert Dialogs After Actions
- **Issue:** Some actions (like sending verification code) show Alert dialogs that block UI
- **Solution:** Add optional "OK" taps and waits after such actions
- **Code:**
  ```yaml
  - tapOn:
      text: "OK"
      optional: true
  ```

### 6. Keyboard Blocking Buttons
- **Issue:** On-screen keyboard can block buttons from being tapped
- **Solution:** Add `hideKeyboard` before tapping buttons
- **Code:**
  ```yaml
  - hideKeyboard
  - tapOn:
      id: "send-code-button"
  ```

### 7. Tab Bar testIDs Don't Work
- **Issue:** `tabBarTestID` on React Navigation Tab.Screen options not recognized by Maestro
- **Solution:** Use text matching with German labels
- **Code:**
  ```yaml
  - assertVisible:
      text: "Status"
  - assertVisible:
      text: "Kalender"
  - assertVisible:
      text: "Einstellungen"
  ```

### 8. Auth State Persistence
- **Issue:** `clearState: true` doesn't clear SecureStore (where auth tokens are stored)
- **Impact:** Registration test can only run once per app install (user already exists on second run)
- **Solution:** For repeated testing, either:
  - Log out before running test
  - Delete app from simulator
  - Create a "logout first" helper flow

### 9. App ID Must Match Dev Build
- **Issue:** Original flow used Expo Go's app ID (`host.exp.Exponent`)
- **Solution:** Use the actual app bundle ID: `com.openworkinghours.mobileapp`

### 10. Status Screen Accessibility Issues
- **Issue:** Maestro cannot read view hierarchy on Status screen (HoursSummaryWidget chart causes `kAXErrorInvalidUIElement`)
- **Solution:** Navigate via Settings tab using coordinate tap instead of text matching
- **Code:**
  ```yaml
  # Navigate via Settings tab to avoid Status screen
  - tapOn:
      point: "83%, 96%"
  ```

### 11. Location Permission Dialogs
- **Issue:** Simulator shows "Standort nicht verfügbar" (Location unavailable) dialog
- **Solution:** Add optional "OK" tap to dismiss the dialog
- **Code:**
  ```yaml
  - tapOn:
      text: "OK"
      optional: true
  ```

### 12. kAXErrorInvalidUIElement on Calendar Screen
- **Issue:** Maestro CLI crashes with `kAXErrorInvalidUIElement` when trying to inspect view hierarchy on Calendar screen
- **Cause:** Certain React Native components (charts, animated elements) cause iOS accessibility tree inspection to fail
- **Affected operations:** Any `tapOn` by `id:` or `text:`, any `assertVisible`, any `extendedWaitUntil`
- **Solution:** Use coordinate-based taps exclusively: `tapOn: point: "X%,Y%"`
- **Note:** This bug does NOT affect MCP tools (mobile-mcp, maestro MCP) which use different drivers
- **Code:**
  ```yaml
  # DON'T use testID (triggers view hierarchy inspection)
  - tapOn:
      id: "calendar-fab"  # Will crash

  # DO use coordinates
  - tapOn:
      point: "88%,82%"  # Works reliably
  ```

### 13. German UI Labels
- **Issue:** App is in German, not English - text matching must use German labels
- **Key labels:**
  - "Arbeitsorte" (Work locations)
  - "Neuen Standort hinzufügen" (Add new location)
  - "Einstellungen" (Settings)
  - "Einstempeln" (Clock in)
  - "Speichern" → "Weiter" (Save/Continue)

---

## Quick Commands Reference

```bash
# Setup PATH (add to ~/.zshrc for persistence)
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH:$HOME/.maestro/bin"

# Verify Maestro
maestro --version

# Start Metro for testing (TEST_MODE enabled via app.json)
cd mobile-app
npx expo start --ios --clear

# Or build with TEST_MODE env var
TEST_MODE=true npx expo run:ios --device "iPhone 15 Pro Max"

# Run single flow
maestro test .maestro/flows/auth/registration.yaml

# Run all flows
maestro test .maestro/flows

# Run on specific device
maestro test .maestro/flows --device "iPhone 15"

# View test results (screenshots, logs)
ls ~/.maestro/tests/
```

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `mobile-app/.maestro/config.yaml` | Maestro configuration |
| `mobile-app/.maestro/flows/auth/registration.yaml` | Auth E2E flow (validated) |
| `mobile-app/.maestro/flows/location/setup.yaml` | Location E2E flow (pending) |
| `mobile-app/.maestro/flows/calendar/shift-management.yaml` | Calendar E2E flow (pending) |
| `mobile-app/.maestro/scripts/run-parallel.sh` | Multi-device runner |
| `mobile-app/.maestro/scripts/get-week-date.js` | Date helper |
| `mobile-app/src/lib/testing/mockApi.ts` | Mock API responses |

### Modified Files
| File | Changes |
|------|---------|
| `mobile-app/app.config.js` | Fixed TEST_MODE to use env var with app.json fallback |
| `mobile-app/app.json` | Added `TEST_MODE: false` in extra config |
| `mobile-app/src/modules/auth/services/AuthService.ts` | Added test mode bypass |
| `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx` | Added 10 testIDs |
| `mobile-app/src/modules/auth/components/ConsentBottomSheet.tsx` | Added 5 testIDs |
| `mobile-app/src/modules/calendar/components/CalendarFAB.tsx` | Added 3 testIDs |

---

## Remaining Work

### Phase 1: Validate Remaining Flows
1. Run location flow: `maestro test .maestro/flows/location/setup.yaml`
2. Run calendar flow: `maestro test .maestro/flows/calendar/shift-management.yaml`
3. Fix any issues found

### Phase 2: Android Testing
1. Start Android emulator
2. Build Android dev client: `npx expo run:android`
3. Run flows on Android
4. Adjust for platform differences (dialog text in English vs German, etc.)

### Phase 3: Multi-Device Parallel
1. Test parallel script: `./.maestro/scripts/run-parallel.sh ios`
2. Test on Android: `./.maestro/scripts/run-parallel.sh android`
3. Test both: `./.maestro/scripts/run-parallel.sh all`

### Phase 4: CI Integration (Future)
1. Consider Maestro Cloud for CI/CD
2. Or self-hosted runners with simulators

### Phase 5: Screenshot Management
1. Set up organized screenshot folder structure
2. Implement cleanup script for temporary screenshots
3. Document naming conventions

---

## Screenshot Management

**Policy:** Screenshots are debugging artifacts, not documentation. They're gitignored and ephemeral.

### .gitignore Rules (implemented)
```gitignore
# E2E test artifacts
*.png
.maestro/results/
.maestro/screenshots/
```

### Commands
```bash
# Run tests (screenshots saved to current directory)
cd mobile-app/.maestro && maestro test flows/

# Clean up after debugging
rm -f mobile-app/*.png
rm -rf mobile-app/.maestro/screenshots/*

# For CI/CD with artifact collection
maestro test --output ./results/
```

### Why Not Keep Screenshots?
- Overwritten every test run
- Large files (100KB-1MB each)
- No consistent naming across runs
- Debugging value expires immediately
- If you need documentation screenshots, capture them manually with clear names

---

## MCP Integration (AI-Assisted Testing)

### Configured MCP Servers

Two MCP servers are configured in `.mcp.json` at project root:

| Server | Purpose | Platforms |
|--------|---------|-----------|
| **maestro** | Native Maestro MCP - run flows, debug tests via AI | iOS + Android |
| **mobile-mcp** | Direct device control via accessibility tree | iOS + Android |

**Configuration file:** `.mcp.json`
```json
{
  "mcpServers": {
    "maestro": {
      "type": "stdio",
      "command": "maestro",
      "args": ["mcp", "--working-dir", "/Users/user01/open_workinghours/mobile-app"],
      "env": {
        "PATH": "/opt/homebrew/opt/openjdk@17/bin:..."
      }
    },
    "mobile-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mobilenext/mobile-mcp@latest"],
      "env": {}
    }
  }
}
```

### How to Use

1. **Restart Claude Code** (MCP servers load at startup)
2. AI assistants can then:
   - Run Maestro flows and see results
   - Interact with simulators directly (tap, swipe, screenshot)
   - Write and debug YAML test files
   - Validate UI after implementing features

### When to Use Which

| Approach | Use Case |
|----------|----------|
| **Maestro YAML** | Reproducible CI tests, regression suites |
| **Maestro MCP** | AI writes/debugs YAML, faster iteration |
| **mobile-mcp** | Exploratory testing, when testIDs aren't available |

### Research Sources

These MCP servers were chosen based on research (2026-01-24):

- [mobile-mcp](https://github.com/mobile-next/mobile-mcp) - Platform-agnostic, accessibility-first
- [ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp) - iOS-specific, featured in Anthropic docs
- [Maestro MCP](https://mcp.so/server/maestro/mobile-dev-inc) - Native integration with Maestro v2.1.0+
- [Firebase App Testing Agent](https://firebase.blog/posts/2025/04/app-testing-agent/) - Natural language goals (Android only)

### Comparison: E2E Testing Approaches

| Approach | Pros | Cons | CI/CD Ready |
|----------|------|------|-------------|
| **Maestro YAML** | Declarative, version-controlled, parallel sharding | Manual YAML writing | ✅ Maestro Cloud or self-hosted |
| **Maestro MCP** | AI writes/debugs tests, uses existing flows | Still YAML under the hood | ✅ Same as above |
| **mobile-mcp** | AI controls devices directly, no scripts | Less structured, harder to reproduce | ⚠️ Needs custom setup |
| **Firebase Agent** | Natural language, self-healing | Android only, Google lock-in | ✅ Firebase integration |

### Next Steps for MCP

1. Test Maestro MCP after restarting Claude Code
2. Compare speed with running `maestro test` directly
3. Evaluate for interactive development workflow
4. Keep Maestro YAML as the CI/CD source of truth

---

## Related Documentation

- `mobile-app/ARCHITECTURE.md` - Mobile app architecture
- `docs/debugging.md` - Debugging tips

---

## Session Log

### 2026-01-24: MCP Evaluation & Calendar Flow Fix
- **MCP servers tested:** Both `maestro` and `mobile-mcp` working
- **Comparison findings:**
  | Aspect | Maestro MCP | mobile-mcp |
  |--------|-------------|------------|
  | App Launch | Timeout issues | ✅ Works |
  | View Hierarchy | ✅ Full tree with testIDs | ⚠️ Misses some elements |
  | Tap by testID | ✅ Works | ❌ Not supported |
  | YAML flows | ✅ `run_flow` tool | ❌ Not available |
- **Calendar flow fixes:**
  - Updated `appId` from `host.exp.Exponent` to `com.openworkinghours.mobileapp`
  - Added coordinate tap fallback for tab navigation
  - Added `optional: true` with testID + text fallback for Speichern button
- **Accessibility fix:** Added `accessible={false}` to TemplatePanel edit form container
  - File: `mobile-app/src/modules/calendar/components/TemplatePanel.tsx:324`
  - Reason: Parent View was grouping all children into one accessibility element
  - Effect: Exposes `template-save` testID to Maestro (requires app rebuild)
- **Recommendation:** Use coordinate taps for this app due to accessibility bug; MCP tools for interactive debugging
- **Final test result:** ✅ Calendar shift-management flow PASSED with coordinate-based approach
- **Workaround:** TestID/text-based taps trigger `kAXErrorInvalidUIElement` - use `point: "X%,Y%"` instead

### 2026-01-24: Auth Flow Validation
- **Xcode:** Upgraded to 16.x, installed iOS 18.6 simulator
- **Build:** Successfully built dev client with `npx expo run:ios`
- **TEST_MODE:** Fixed config override issue in `app.config.js`
- **Auth Flow:** Validated complete registration flow
- **Issues Fixed:** Dev client handling, notification dialogs, debug panel, keyboard, alerts
- **Result:** Auth registration E2E test passing

### 2026-01-24: Location Flow Validation
- **Status screen issue:** Discovered Maestro accessibility bug with HoursSummaryWidget chart
- **Workaround:** Navigate via Settings using coordinate taps to avoid Status screen
- **Location setup:** Full 3-step wizard working (search → radius → name → save)
- **Key fixes:**
  - Use German UI labels ("Arbeitsorte", "Neuen Standort hinzufügen")
  - Handle location permission dialog with optional "OK" tap
  - Use coordinate tap for Settings tab and Step 3 save button
- **Result:** Location setup E2E test passing
