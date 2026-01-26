# E2E Tests (Appium)

Cross-platform E2E tests for Open Working Hours using Appium + Jest.

## Prerequisites

- **Node 20 or 22** (Appium 3.x doesn't support Node 23)
- Appium server running
- iOS Simulator or Android Emulator running

## Quick Start

```bash
# Install dependencies
cd mobile-app/e2e
npm install

# Install Appium globally and drivers
npm install -g appium
appium driver install xcuitest
appium driver install uiautomator2

# Start Appium server (in separate terminal)
npm run appium:start

# Boot a simulator/emulator, then run tests
open -a Simulator  # iOS
npm run test:ios

# Or for Android
emulator -avd Pixel_7a  # Your AVD name
npm run test:android
```

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
├── helpers/
│   ├── driver.js      # Appium driver setup + auto-detection
│   ├── selectors.js   # Cross-platform element selectors
│   └── actions.js     # Common test actions
├── flows/
│   ├── auth.test.js   # Registration flow
│   ├── location.test.js # Location setup wizard
│   └── calendar.test.js # Calendar navigation
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
npm run test:calendar
npm run test:auth
npm run test:location

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

## Localization

The app displays German on iOS and English on Android. Use i18n helpers:

```javascript
const { t, byI18n } = require('./helpers/selectors');

// Get localized text
const text = t(driver, 'calendar'); // 'Kalender' on iOS, 'Calendar' on Android

// Find element by localized text
const tab = await byI18n(driver, 'calendar');
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

## Troubleshooting

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

### "element not found"
1. Check if app is in expected state (logged in vs. welcome screen)
2. Verify testID exists in the app code
3. Try different selector strategy (see selectors.js)

### Node version issues
Appium 3.x requires Node 20, 22, or 24+:
```bash
node -v  # Check version
brew install node@22  # Install if needed
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

## Comparison with Maestro

| Aspect | Maestro | Appium |
|--------|---------|--------|
| Test format | YAML | JavaScript |
| Android support | Broken (2.1.0) | Works |
| iOS support | Works | Works |
| Auto-detection | No | Yes |
| Debugging | Limited | Full IDE support |

Maestro flows are kept in `.maestro/` for reference (iOS only).
