# E2E Tests (Appium)

Cross-platform E2E tests for Open Working Hours using Appium + Jest.

## Prerequisites

- **Node 20 or 22** (Appium 3.x doesn't support Node 23)
- Appium installed globally with drivers
- iOS Simulator or Android Emulator

## Quick Start

```bash
# Install dependencies
cd mobile-app/e2e
npm install

# Install Appium globally and drivers (one-time setup)
npm install -g appium
appium driver install xcuitest
appium driver install uiautomator2

# Start infrastructure (uses Node 22 automatically)
npm run infra:ios      # Appium + iOS simulator
npm run infra:android  # Appium + Android emulator
npm run infra:both     # Everything

# In another terminal, run tests
npm run test:ios
npm run test:android
```

## Infrastructure Script

The `start-infra.sh` script handles Node version compatibility and starts all required services:

```bash
./start-infra.sh          # Appium only
./start-infra.sh ios      # Appium + boot iOS simulator
./start-infra.sh android  # Appium + start Android emulator
./start-infra.sh both     # Everything
```

**What it does:**
1. Uses Node 22 (required for Appium 3.x)
2. Kills any existing Appium processes
3. Starts Appium server
4. Optionally boots iOS simulator or Android emulator
5. Waits for everything to be ready

## Device Auto-Detection

Tests automatically detect running simulators/emulators - no hardcoded device IDs.

**How it works:**
- iOS: Finds first booted simulator via `xcrun simctl list devices booted`
- Android: Finds first emulator via `adb devices`

**Override with environment variables:**
```bash
IOS_UDID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX npm run test:ios
ANDROID_DEVICE=emulator-5556 npm run test:android
```

## Test Structure

```
e2e/
├── start-infra.sh    # Infrastructure startup script
├── helpers/
│   ├── driver.js     # Appium driver setup + auto-detection
│   ├── selectors.js  # Cross-platform element selectors (bilingual)
│   └── actions.js    # Common test actions
├── flows/
│   ├── auth.test.js      # Registration flow
│   ├── calendar.test.js  # Calendar navigation
│   ├── location.test.js  # Location setup wizard
│   └── shifts.test.js    # Shift template creation
└── README.md
```

## Running Tests

```bash
# All tests on iOS (default)
npm test

# All tests on specific platform
npm run test:ios
npm run test:android

# Single test file
npm run test:auth
npm run test:calendar
npm run test:location
npm run test:shifts

# With debug output
DEBUG=1 npm run test:ios
```

## Cross-Platform Selectors

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

## Bilingual Text Matching

The app can display German or English regardless of platform (depends on device locale).
Tests handle both languages automatically:

```javascript
const { byI18nFast } = require('./helpers/selectors');

// Matches either "Kalender" (German) or "Calendar" (English)
const tab = await byI18nFast(driver, 'calendar');

// Available keys: status, calendar, settings, week, month, last14Days, etc.
```

## Test Design: Handling Variable State

Some tests handle variable app state gracefully:

```javascript
// Location tests check if wizard is available
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

This allows tests to pass in different app states while clearly logging what was skipped.

## E2E Testing Builds

For automated E2E testing, use the `e2e-testing` build profile which has `TEST_MODE` enabled:

```bash
# Build for E2E testing (includes mock auth)
eas build --profile e2e-testing --platform ios
eas build --profile e2e-testing --platform android

# Install and run
eas build:run --platform android --profile e2e-testing
```

**TEST_MODE features:**
- Mock verification codes - use `123456` to authenticate
- Skips actual email sending
- Returns mock API responses for auth flow

**Without TEST_MODE:**
- Auth flow requires real email verification
- Tests can only verify UI up to the welcome screen

## Tab Bar Testing (Android Fix)

React Navigation v7 requires `tabBarButtonTestID` (not `tabBarTestID`) for tab buttons to be accessible on Android:

```tsx
// WRONG - doesn't work on Android
<Tab.Screen options={{ tabBarTestID: 'tab-status' }} />

// CORRECT - works on both platforms
<Tab.Screen options={{ tabBarButtonTestID: 'tab-status' }} />
```

The testIDs `tab-status`, `tab-calendar`, `tab-settings` are now properly exposed on both iOS and Android.

## Troubleshooting

### Node version issues
Appium 3.x requires Node 20, 22, or 24+ (NOT 23):
```bash
node -v  # Check version

# Use the infrastructure script (handles this automatically)
npm run infra:ios

# Or manually use Node 22
/opt/homebrew/opt/node@22/bin/node $(which appium) --allow-cors --relaxed-security
```

### "No booted iOS simulator found"
```bash
open -a Simulator
# Wait for it to boot, then retry
```

### "No running Android emulator found"
```bash
emulator -list-avds  # List available AVDs
emulator -avd <name>  # Start one
```

### WebDriverAgent build timeout
First run on iOS takes several minutes to build WebDriverAgent. Just wait.

### "element not found"
1. Check if app is in expected state (logged in vs. welcome screen)
2. Verify testID exists in the app code
3. For Android, element may need `accessible={true}` in the component

### Android testIDs not working

On Android, testID visibility depends on the accessibility tree structure. Common issues:

**Issue 1: Parent View aggregates children**

If a parent View doesn't have `accessible={false}`, it aggregates all children into a single accessibility element, hiding their individual testIDs:

```tsx
// ❌ BAD - children not visible to Appium
<View>
  <TouchableOpacity testID="btn-1" accessible={true}>...</TouchableOpacity>
  <TouchableOpacity testID="btn-2" accessible={true}>...</TouchableOpacity>
</View>

// ✅ GOOD - children are individually accessible
<View accessible={false}>
  <TouchableOpacity testID="btn-1" accessible={true}>...</TouchableOpacity>
  <TouchableOpacity testID="btn-2" accessible={true}>...</TouchableOpacity>
</View>
```

**Issue 2: View flattening on Android**

React Native may optimize away Views on Android. Prevent with `collapsable={false}`:

```tsx
<View accessible={false} collapsable={false}>
  {/* children now guaranteed to be in tree */}
</View>
```

**Issue 3: Absolutely-positioned menus/modals**

Popup menus and modals often need special handling:

```tsx
<View style={styles.popupMenu}
      accessible={false}      // Allow children to be found
      collapsable={false}>    // Prevent flattening
  <TouchableOpacity
      testID="menu-item"
      accessible={true}>      // Mark as accessible
    <Text>Menu Item</Text>
  </TouchableOpacity>
</View>
```

**References:**
- [RN Issue #6560](https://github.com/facebook/react-native/issues/6560) - accessible aggregation
- [RN Issue #30226](https://github.com/facebook/react-native/issues/30226) - testID visibility

## Comparison with Maestro

| Aspect | Maestro | Appium |
|--------|---------|--------|
| Test format | YAML | JavaScript |
| Android support | Broken (2.1.0) | Works |
| iOS support | Works | Works |
| Auto-detection | No | Yes |
| Bilingual | Manual | Automatic |
| Debugging | Limited | Full IDE support |

Maestro flows are kept in `.maestro/` for reference (iOS only).
