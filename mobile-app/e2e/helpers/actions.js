/**
 * Common Test Actions
 *
 * Reusable actions for E2E tests with built-in waits and error handling.
 */

const { byTestId, byText, byI18n, byI18nFast, t, i18n } = require('./selectors');

/**
 * Dismiss iOS keyboard by tapping a neutral area.
 * No-op on Android (use driver.hideKeyboard() instead).
 * @param {WebdriverIO.Browser} driver
 */
/**
 * Dismiss iOS keyboard by tapping a neutral area.
 * Use strategy='tap' (default) for full-screen views like login.
 * Use strategy='key' for bottom-sheet panels where tapping the screen
 * would hit the overlay/backdrop and close the panel.
 */
async function dismissKeyboard(driver, strategy = 'tap') {
  if (driver.isAndroid) {
    try { await driver.hideKeyboard(); } catch { /* ignore */ }
    return;
  }

  if (strategy === 'key') {
    // Press Return key to dismiss keyboard without tapping screen.
    // Works for single-line TextInputs (blurs the input).
    try {
      await driver.execute('mobile: pressButton', { name: 'return' });
      await driver.pause(300);
    } catch {
      // Fallback to tap strategy if pressButton not available
      try {
        await driver.action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: 200, y: 200 }).down().up().perform();
        await driver.pause(300);
      } catch { /* ignore */ }
    }
    return;
  }

  // Default 'tap' strategy: tap neutral area above content
  try {
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: 200, y: 200 }).down().up().perform();
    await driver.pause(300);
  } catch { /* ignore */ }
}

/**
 * Tap element by testID
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @param {number} timeout - Max wait time in ms
 */
async function tapTestId(driver, testId, timeout = 10000) {
  const element = await byTestId(driver, testId);
  // Use waitForExist instead of waitForDisplayed — XCUITest reports
  // isDisplayed=false for elements in always-mounted absoluteFill containers
  // (inline rendering pattern used after Modal→Animated.View refactor)
  await element.waitForExist({ timeout });
  await element.click();
}

/**
 * Tap element by text
 * @param {WebdriverIO.Browser} driver
 * @param {string} text
 * @param {number} timeout
 */
async function tapText(driver, text, timeout = 10000) {
  const element = await byText(driver, text);
  await element.waitForDisplayed({ timeout });
  await element.click();
}

/**
 * Tap element by i18n key (handles German/English)
 * @param {WebdriverIO.Browser} driver
 * @param {string} key
 * @param {number} timeout
 */
async function tapI18n(driver, key, timeout = 10000) {
  const element = await byI18n(driver, key);
  await element.waitForDisplayed({ timeout });
  await element.click();
}

/**
 * Type text into element by testID
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @param {string} text
 * @param {number} timeout
 */
async function typeTestId(driver, testId, text, timeout = 10000) {
  const element = await byTestId(driver, testId);
  await element.waitForDisplayed({ timeout });
  await element.setValue(text);
}

/**
 * Wait for element by testID to be displayed
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @param {number} timeout
 */
async function waitForTestId(driver, testId, timeout = 10000) {
  const element = await byTestId(driver, testId);
  await element.waitForDisplayed({ timeout });
  return element;
}

/**
 * Wait for element by text to be displayed
 * @param {WebdriverIO.Browser} driver
 * @param {string} text
 * @param {number} timeout
 */
async function waitForText(driver, text, timeout = 10000) {
  const element = await byText(driver, text);
  await element.waitForDisplayed({ timeout });
  return element;
}

/**
 * Check if element exists (doesn't throw)
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @returns {Promise<boolean>}
 */
async function existsTestId(driver, testId) {
  try {
    const element = await byTestId(driver, testId);
    return await element.isExisting();
  } catch {
    return false;
  }
}

/**
 * Dismiss alert/dialog if present (optional action)
 * @param {WebdriverIO.Browser} driver
 * @param {string} buttonText - Text of button to tap
 */
async function dismissAlert(driver, buttonText) {
  try {
    const button = await byText(driver, buttonText);
    if (await button.isDisplayed()) {
      await button.click();
      await driver.pause(300);
    }
  } catch {
    // Alert not present, continue
  }
}

/**
 * Dismiss Android system permission dialogs using resource IDs
 * @param {WebdriverIO.Browser} driver
 */
async function dismissAndroidSystemDialog(driver) {
  if (!driver.isAndroid) return;

  try {
    // Android permission controller "Allow" button
    const allowButton = await driver.$(
      'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_button")'
    );
    if (await allowButton.isExisting()) {
      await allowButton.click();
      await driver.pause(500);
      return true;
    }
  } catch {
    // Button not found
  }

  try {
    // Android permission controller "Allow" for one-time or while using
    const allowForeground = await driver.$(
      'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_foreground_only_button")'
    );
    if (await allowForeground.isExisting()) {
      await allowForeground.click();
      await driver.pause(500);
      return true;
    }
  } catch {
    // Button not found
  }

  try {
    // Notification permission dialog (Android 13+)
    const allowNotification = await driver.$(
      'android=new UiSelector().text("Allow")'
    );
    if (await allowNotification.isExisting()) {
      await allowNotification.click();
      await driver.pause(500);
      return true;
    }
  } catch {
    // Button not found
  }

  return false;
}

/**
 * Dismiss common permission dialogs (handles both German and English)
 * @param {WebdriverIO.Browser} driver
 */
async function dismissPermissionDialogs(driver) {
  // Dismiss up to 3 dialogs (permission, Allow, OK)
  for (let i = 0; i < 3; i++) {
    const dismissed = await dismissNativeDialog(driver, ['Allow', 'Erlauben', 'OK']);
    if (!dismissed) break;
  }
}

/**
 * Dismiss a single native dialog/alert on either platform.
 *
 * - **iOS:** Uses `driver.acceptAlert()` (works for UIAlertController).
 * - **Android:** `acceptAlert()` silently succeeds without dismissing AlertDialogs,
 *   so we tap common button texts ("OK", "Allow", etc.) instead.
 *
 * @param {WebdriverIO.Browser} driver
 * @param {string[]} [buttonTexts] - Button texts to try on Android
 * @returns {Promise<boolean>} true if a dialog was dismissed
 */
async function dismissNativeDialog(driver, buttonTexts = ['OK', 'Allow', 'Erlauben']) {
  if (!driver.isAndroid) {
    // iOS: check for alert presence first to avoid noisy WARN logs
    try {
      const alertText = await driver.getAlertText();
      if (alertText) {
        await driver.acceptAlert();
        await driver.pause(300);
        return true;
      }
    } catch { /* no alert */ }
    return false;
  }

  // Android: try permission controller buttons first
  const dismissed = await dismissAndroidSystemDialog(driver);
  if (dismissed) return true;

  // Then try common button texts
  for (const text of buttonTexts) {
    try {
      const btn = await byText(driver, text, true);
      if (await btn.isExisting()) {
        await btn.click();
        await driver.pause(300);
        return true;
      }
    } catch { /* not found */ }
  }
  return false;
}

/**
 * Dismiss all system dialogs/alerts at startup (both platforms).
 * More comprehensive than dismissPermissionDialogs — handles iOS native alerts,
 * Expo dev menu, notification prompts, and other unexpected popups.
 * @param {WebdriverIO.Browser} driver
 * @param {number} maxAttempts - Max dialogs to dismiss sequentially
 */
async function dismissSystemDialogs(driver, maxAttempts = 5) {
  const allButtons = ['OK', 'Allow', 'Erlauben', 'Dismiss', 'Got it', 'Not Now', "Don't Allow"];
  for (let i = 0; i < maxAttempts; i++) {
    const dismissed = await dismissNativeDialog(driver, allButtons);
    if (!dismissed) break;
  }
}

/**
 * Wait for element by testID with retry logic.
 * Useful for elements that may not appear on first attempt (e.g., FAB menu
 * that sometimes doesn't open on the first tap).
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @param {Object} options
 * @param {Function} [options.retryAction] - Async function to call before retrying
 * @param {number} [options.timeout=10000] - Wait timeout per attempt (ms)
 * @param {number} [options.retries=2] - Number of retry attempts after first failure
 * @param {number} [options.retryDelay=1000] - Delay after retryAction before re-checking (ms)
 * @returns {Promise<WebdriverIO.Element>} The found element
 */
async function waitForTestIdWithRetry(driver, testId, options = {}) {
  const { retryAction, timeout = 10000, retries = 2, retryDelay = 1000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const el = await byTestId(driver, testId);
      // Use shorter timeout on retries since retryAction should have triggered it
      await el.waitForExist({ timeout: attempt === 0 ? timeout : Math.floor(timeout / 2) });
      return el;
    } catch (e) {
      if (attempt < retries && retryAction) {
        console.log(`waitForTestIdWithRetry: '${testId}' not found (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        await retryAction();
        await driver.pause(retryDelay);
      } else {
        throw new Error(`Element '${testId}' not found after ${attempt + 1} attempt(s): ${e.message}`);
      }
    }
  }
}

/**
 * Tab bar testID and text mapping
 */
const tabConfig = {
  status: { testId: 'tab-status', de: 'Status', en: 'Status' },
  calendar: { testId: 'tab-calendar', de: 'Kalender', en: 'Calendar' },
  settings: { testId: 'tab-settings', de: 'Einstellungen', en: 'Settings' },
};

/**
 * Navigate to a tab by tapping tab bar
 * Tries testID first, then falls back to text (bilingual)
 * @param {WebdriverIO.Browser} driver
 * @param {string} tabKey - 'status', 'calendar', or 'settings'
 */
async function navigateToTab(driver, tabKey) {
  const config = tabConfig[tabKey];
  if (!config) {
    throw new Error(`Unknown tab: ${tabKey}. Valid tabs: ${Object.keys(tabConfig).join(', ')}`);
  }

  // Try testID first
  try {
    const element = await byTestId(driver, config.testId);
    const exists = await element.isExisting();
    if (exists) {
      await element.waitForDisplayed({ timeout: 5000 });
      await element.click();
      await driver.pause(500);
      return;
    }
  } catch (e) {
    // testID not found, try text
  }

  // Fall back to text (try German first, then English)
  try {
    const deElement = await byText(driver, config.de);
    if (await deElement.isExisting()) {
      await deElement.waitForDisplayed({ timeout: 5000 });
      await deElement.click();
      await driver.pause(500);
      return;
    }
  } catch (e) {
    // German not found
  }

  // Try English
  const enElement = await byText(driver, config.en);
  await enElement.waitForDisplayed({ timeout: 5000 });
  await enElement.click();
  await driver.pause(500);
}

/**
 * Take screenshot and save to file
 * @param {WebdriverIO.Browser} driver
 * @param {string} name
 * @returns {string} filename of saved screenshot
 */
async function screenshot(driver, name) {
  const fs = require('fs');
  const path = require('path');

  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${driver.platform}-${timestamp}.png`;
  const filepath = path.join(screenshotsDir, filename);

  const data = await driver.takeScreenshot();
  fs.writeFileSync(filepath, data, 'base64');

  return filename;
}

/**
 * Check if user is authenticated (main app visible)
 * @param {WebdriverIO.Browser} driver
 * @returns {Promise<boolean>}
 */
async function isAuthenticated(driver) {
  try {
    // Check for tab bar presence (indicates main app)
    const tabStatus = await byTestId(driver, 'tab-status');
    const exists = await tabStatus.isExisting();
    if (exists) {
      const displayed = await tabStatus.isDisplayed();
      return displayed;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Perform TEST_MODE login flow
 * @param {WebdriverIO.Browser} driver
 */
async function performTestLogin(driver) {
  try {
    // Tap Login button
    const loginButton = await byTestId(driver, 'login-button');
    await loginButton.waitForDisplayed({ timeout: 5000 });
    await loginButton.click();
    await driver.pause(1000);

    // Enter email
    const emailInput = await byTestId(driver, 'email-input');
    await emailInput.waitForDisplayed({ timeout: 5000 });
    await emailInput.setValue('test@example.com');

    // Dismiss keyboard so send-code button is tappable
    await dismissKeyboard(driver);

    // Send code
    const sendCodeButton = await byTestId(driver, 'send-code-button');
    await sendCodeButton.click();
    await driver.pause(1500);

    // Dismiss "Code sent" dialog
    await dismissNativeDialog(driver, ['OK']);
    await driver.pause(500);

    // Enter verification code (TEST_MODE accepts 123456)
    const codeInput = await byTestId(driver, 'code-input');
    await codeInput.waitForDisplayed({ timeout: 5000 });
    await codeInput.setValue('123456');

    // Dismiss keyboard so verify button is tappable
    await dismissKeyboard(driver);

    // Tap login/verify button
    const verifyButton = await byTestId(driver, 'login-button');
    await verifyButton.click();
    await driver.pause(3000);

    // Dismiss any permission dialogs after login
    await dismissPermissionDialogs(driver);
  } catch (e) {
    console.log('performTestLogin failed:', e.message);
    throw e;
  }
}

/**
 * Ensure user is authenticated before running tests.
 * Handles stale state: if a stack screen (setup wizard, etc.) is covering the
 * tab bar, attempts to navigate back before checking auth.
 * Performs TEST_MODE login if not already logged in.
 * @param {WebdriverIO.Browser} driver
 */
async function ensureAuthenticated(driver) {
  // Ensure app is in foreground. On Android, Appium doesn't always auto-launch
  // the app after a previous session's deleteSession. On iOS, activateApp
  // ensures the app is foregrounded even if XCUITest session reuse leaves it backgrounded.
  try {
    await driver.activateApp('com.openworkinghours.mobileapp');
  } catch { /* already in foreground */ }

  await dismissSystemDialogs(driver);

  // Wait for app to be ready — either tab bar (authenticated) or login button (welcome screen).
  // Android emulators can take 10+ seconds to load the JS bundle.
  const maxWait = driver.isAndroid ? 15000 : 8000;
  const pollInterval = 1000;
  let waited = 0;
  while (waited < maxWait) {
    const hasTabBar = await existsTestId(driver, 'tab-status');
    const hasLogin = await existsTestId(driver, 'login-button');
    if (hasTabBar || hasLogin) break;
    await driver.pause(pollInterval);
    waited += pollInterval;
  }

  let authenticated = await isAuthenticated(driver);

  if (!authenticated) {
    // Check if we're on the welcome screen (login/register buttons visible).
    // If so, skip back-presses — on Android, back() from the welcome screen exits the app.
    const onWelcomeScreen = await existsTestId(driver, 'login-button');

    if (!onWelcomeScreen) {
      // Tab bar not found and not on welcome screen — might be covered by a stack screen
      // (e.g., setup wizard) or a dialog. Dismiss dialogs then press back to return to root.
      for (let i = 0; i < 5; i++) {
        // Dismiss any blocking dialogs first (e.g., "Background Permission Required")
        await dismissNativeDialog(driver, ['OK', 'CANCEL', 'Cancel', 'CONTINUE ANYWAY', 'Allow', 'Erlauben']);

        if (driver.isAndroid) {
          try { await driver.back(); } catch { break; }
        } else {
          try {
            await driver.action('pointer', { parameters: { pointerType: 'touch' } })
              .move({ x: 40, y: 65 }).down().up().perform();
          } catch { break; }
        }
        await driver.pause(500);

        authenticated = await isAuthenticated(driver);
        if (authenticated) break;
      }
    }
  }

  if (authenticated) {
    console.log('User already authenticated');
    return;
  }

  console.log('User not authenticated, performing TEST_MODE login...');
  await performTestLogin(driver);

  // Verify login succeeded
  const nowAuthenticated = await isAuthenticated(driver);
  if (!nowAuthenticated) {
    throw new Error('Failed to authenticate - tab bar not visible after login');
  }
  console.log('TEST_MODE login successful');
}

/**
 * Check if a work location is configured.
 * Navigates to Status tab and checks for the "Add Workplace" empty-state button.
 * If the button exists → no location configured. If absent → location exists.
 * @param {WebdriverIO.Browser} driver
 * @returns {Promise<boolean>}
 */
async function isLocationConfigured(driver) {
  await navigateToTab(driver, 'status');
  await driver.pause(1000);

  const hasAddButton = await existsTestId(driver, 'add-workplace-button');
  return !hasAddButton; // if "Add Workplace" button exists, no location is configured
}

/**
 * Complete the location setup wizard to configure a test location.
 * Assumes we are already on the Status screen with "Add Workplace" button visible.
 * @param {WebdriverIO.Browser} driver
 */
async function completeLocationWizard(driver) {
  // Tap "Add Workplace" button on Status screen
  await tapTestId(driver, 'add-workplace-button');
  await driver.pause(2000);

  // Dismiss location permission dialog (Android shows it immediately after map load)
  await dismissPermissionDialogs(driver);
  await driver.pause(driver.isAndroid ? 3000 : 1000); // Wait for map + potential GPS dialog

  // Dismiss "Location Unavailable" / "Standort nicht verfügbar" dialog.
  // May appear with a delay after the map loads, so poll for it.
  for (let i = 0; i < 6; i++) {
    const dismissed = await dismissNativeDialog(driver, ['OK']);
    if (dismissed) {
      console.log('Dismissed GPS/location dialog');
      break;
    }
    if (i < 5) await driver.pause(1000);
  }

  // Step 1: Search for a location, or tap the map as fallback if geocoding fails
  await typeTestId(driver, 'setup-search-input', 'Berlin');
  await dismissKeyboard(driver);

  // Wait for geocoding results — Photon API can be slow on emulators
  let searchWorked = false;
  try {
    const firstResult = await byTestId(driver, 'setup-search-result-0');
    await firstResult.waitForDisplayed({ timeout: 8000 });
    await firstResult.click();
    searchWorked = true;
    await driver.pause(1000);
  } catch { /* geocoding failed or no results */ }

  if (!searchWorked) {
    // Fallback: tap the center of the map to place a pin manually
    console.log('Geocoding returned no results — tapping map to place pin');
    const { width, height } = await driver.getWindowSize();
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(width / 2), y: Math.round(height / 2) })
      .down().pause(100).up().perform();
    await driver.pause(1000);
  }

  await tapTestId(driver, 'setup-continue-step1');
  await driver.pause(500);

  // Step 2: Radius — just continue with default
  await tapTestId(driver, 'setup-continue-step2');
  await driver.pause(500);

  // Step 3: Name — enter a name and save
  await typeTestId(driver, 'setup-name-input', 'Test Hospital');
  await driver.pause(300);
  await dismissKeyboard(driver);

  await tapTestId(driver, 'setup-save-button');
  await driver.pause(2000); // wait for save + navigation back

  // Dismiss any permission dialogs triggered by location setup.
  // On Android, the app shows an in-app "Background Permission Required" dialog
  // with "CANCEL" and "CONTINUE ANYWAY" buttons (not a native AlertDialog).
  await dismissNativeDialog(driver, ['CONTINUE ANYWAY', 'Continue Anyway', 'OK', 'Allow', 'Erlauben']);
  await driver.pause(500);
  await dismissPermissionDialogs(driver);
  await driver.pause(1000);
}

/**
 * Ensure a work location is configured.
 * If not, completes the location wizard with a test location.
 * Navigates back to the original tab afterwards.
 * @param {WebdriverIO.Browser} driver
 * @param {string} [returnToTab='calendar'] - Tab to navigate to after setup
 */
async function ensureLocationConfigured(driver, returnToTab = 'calendar') {
  const configured = await isLocationConfigured(driver);

  if (configured) {
    console.log('Location already configured');
    await navigateToTab(driver, returnToTab);
    await driver.pause(500);
    return;
  }

  console.log('No location configured, completing wizard...');
  try {
    await completeLocationWizard(driver);
    console.log('Location setup complete');
  } catch (e) {
    console.log(`⚠ Location wizard failed: ${e.message} — tests requiring location may skip`);
  }

  // After wizard, ensure we're back on a tab-bar screen.
  // The wizard may leave us on a sub-screen, so try Status first.
  try {
    await navigateToTab(driver, 'status');
    await driver.pause(500);
  } catch {
    // Tab bar not visible — try pressing back to return to main screen
    try {
      await driver.back();
      await driver.pause(1000);
    } catch { /* ignore */ }
  }

  // Navigate to requested tab
  await navigateToTab(driver, returnToTab);
  await driver.pause(500);
}

/**
 * Dismiss any open overlay/panel and ensure we're on the calendar in week view
 * with the FAB visible. Use this at the start of any calendar-based test suite
 * to recover from stale state left by a previous test session.
 * @param {WebdriverIO.Browser} driver
 */
async function ensureCleanCalendarState(driver) {
  // Dismiss any open panel (overlay tap on iOS, back on Android)
  if (driver.isAndroid) {
    try { await driver.back(); } catch { /* ignore */ }
  } else {
    try {
      await driver.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: 215, y: 50 }).down().up().perform();
    } catch { /* ignore */ }
  }
  await driver.pause(500);

  // Navigate to calendar tab
  await navigateToTab(driver, 'calendar');
  await driver.pause(500);

  // Ensure week view (FAB is only visible in week view)
  const fabExists = await existsTestId(driver, 'calendar-fab');
  if (!fabExists) {
    const { byText: byTxt } = require('./selectors');
    for (const text of ['Woche', 'Week']) {
      try {
        const toggle = await byTxt(driver, text, true);
        if (await toggle.isExisting()) {
          await toggle.click();
          await driver.pause(1000);
          break;
        }
      } catch { /* try next */ }
    }
  }
}

module.exports = {
  tapTestId,
  tapText,
  tapI18n,
  typeTestId,
  waitForTestId,
  waitForText,
  existsTestId,
  dismissAndroidSystemDialog,
  dismissNativeDialog,
  dismissPermissionDialogs,
  dismissSystemDialogs,
  waitForTestIdWithRetry,
  isAuthenticated,
  ensureAuthenticated,
  navigateToTab,
  screenshot,
  isLocationConfigured,
  ensureLocationConfigured,
  ensureCleanCalendarState,
  dismissKeyboard,
};
