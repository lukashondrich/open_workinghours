# E2E Tests (Appium)

Cross-platform E2E tests for Open Working Hours using Appium.

## Prerequisites

- **Node 22** (required - Appium 3.x doesn't support Node 23)
- Appium server running
- iOS Simulator or Android Emulator running

## Quick Start

```bash
# Install Node 22 (if needed)
brew install node@22

# Set PATH for Node 22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# Install dependencies
cd mobile-app/e2e
npm install

# Install Appium globally and drivers
npm install -g appium
appium driver install xcuitest
appium driver install uiautomator2

# Start Appium server (in separate terminal)
appium --allow-cors --relaxed-security

# Run tests
npm run test:ios      # iOS only
npm run test:android  # Android only
npm test              # Default platform (iOS)
```

## Test Structure

```
e2e/
├── helpers/
│   ├── driver.js      # Appium driver setup
│   ├── selectors.js   # Cross-platform element selectors
│   └── actions.js     # Common test actions
├── flows/
│   ├── auth.test.js   # Registration flow
│   ├── location.test.js # Location setup wizard
│   └── calendar.test.js # Calendar navigation
└── README.md
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

## Running Individual Tests

```bash
# Single flow
npm run test:calendar
npm run test:auth
npm run test:location

# Single test file
npx jest flows/calendar.test.js

# With debug output
DEBUG=1 npm run test:ios
```

## Troubleshooting

### "Node version must be at least..."
Appium 3.x requires Node 20, 22, or 24+. Use:
```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

### "element not found"
1. Check if app is in expected state (logged in vs. welcome screen)
2. Verify testID exists in the app code
3. Try different selector strategy (see selectors.js)

### Android testID not working
Android uses resourceId instead of accessibility id.

## Comparison with Maestro

| Aspect | Maestro | Appium |
|--------|---------|--------|
| Test format | YAML | JavaScript |
| Android support | Broken | Works |
| iOS support | Works | Works |
| testID selectors | Yes | Yes |
| Debugging | Limited | Full IDE support |

Maestro flows are kept in .maestro/ for reference (iOS only).
