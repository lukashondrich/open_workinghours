/**
 * Common Test Actions
 *
 * Reusable actions for E2E tests with built-in waits and error handling.
 */

const { byTestId, byText, byTextAnyCase, byAlertButtonText, byI18n, byI18nFast, t, i18n } = require('./selectors');
const { execSync } = require('child_process');

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
    // Only hide when the keyboard is actually shown: hideKeyboard() presses
    // Back, and with no keyboard open that POPS THE CURRENT SCREEN (this
    // silently exited the setup wizard at Step 3 — UiAutomator2's setValue
    // injects text without raising the keyboard).
    try {
      if (await driver.isKeyboardShown()) await driver.hideKeyboard();
    } catch { /* ignore */ }
    return;
  }

  if (strategy === 'key') {
    // Press Return key to dismiss keyboard without tapping screen.
    // Works for single-line TextInputs (blurs the input).
    // NO screen-tap fallback here: 'key' is used inside bottom-sheet panels,
    // where a fallback tap would land on the overlay and close the panel
    // (this exact bug broke the shifts/absences template-create tests —
    // 'mobile: pressButton' doesn't accept 'return' and always threw).
    try {
      await driver.execute('mobile: pressButton', { name: 'return' });
      await driver.pause(300);
    } catch { /* ignore — prefer dismissKeyboardFromInput for reliability */ }
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
 * Dismiss the keyboard by pressing Return on a specific text input.
 * Safe inside bottom-sheet panels (no screen tap that could hit the overlay).
 * iOS: types '\n' into the input — presses Return, which blurs single-line
 * TextInputs and hides the keyboard. Android: uses driver.hideKeyboard().
 * @param {WebdriverIO.Browser} driver
 * @param {WebdriverIO.Element} inputElement - the focused TextInput element
 */
async function dismissKeyboardFromInput(driver, inputElement) {
  if (driver.isAndroid) {
    // Guarded like dismissKeyboard: hideKeyboard() with no keyboard open
    // presses Back and pops the current screen.
    try {
      if (await driver.isKeyboardShown()) await driver.hideKeyboard();
    } catch { /* ignore */ }
    await driver.pause(300);
    return;
  }
  try {
    await inputElement.addValue('\n');
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
  await dismissOnboardingTooltips(driver);
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
 * Dismiss first-time education tooltips so legacy E2E flows can continue.
 * @param {WebdriverIO.Browser} driver
 */
async function dismissOnboardingTooltips(driver) {
  const dismissIds = [
    'calendar-intro-tooltip-dismiss',
    'calendar-fab-tooltip-dismiss',
    'calendar-batch-tooltip-dismiss',
    'submit-tooltip-dismiss',
    'tracked-session-tooltip-dismiss',
  ];

  for (const testId of dismissIds) {
    if (await existsTestId(driver, testId)) {
      const element = await byTestId(driver, testId);
      await element.waitForExist({ timeout: 2000 });
      await element.click();
      await driver.pause(500);
    }
  }
}

/**
 * Advance through the custom setup foreground-location primer when it appears.
 * E2E flows choose "Not Now" to avoid platform permission dialog variance.
 * @param {WebdriverIO.Browser} driver
 */
async function advancePastSetupForegroundPrimer(driver) {
  await driver.pause(500);
  if (await existsTestId(driver, 'setup-foreground-primer-skip')) {
    await tapTestId(driver, 'setup-foreground-primer-skip');
    await driver.pause(1000);
  }
}

/**
 * Skip optional post-save permission primers in setup flows.
 * The primers (background location, then notifications) can each appear with
 * a DELAY after save on slow emulators — poll instead of a one-shot check,
 * until the tab bar is reached or the budget is spent.
 * @param {WebdriverIO.Browser} driver
 */
async function skipSetupPostSavePermissionPrimers(driver) {
  await driver.pause(500);
  for (let i = 0; i < 10; i++) {
    let acted = false;
    if (await existsTestId(driver, 'setup-background-primer-skip')) {
      await tapTestId(driver, 'setup-background-primer-skip');
      await driver.pause(1000);
      acted = true;
    }
    if (await existsTestId(driver, 'setup-notification-primer-skip')) {
      await tapTestId(driver, 'setup-notification-primer-skip');
      await driver.pause(1000);
      acted = true;
    }
    if (!acted) {
      if (await existsTestId(driver, 'tab-status')) break;
      await driver.pause(1000);
    }
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

  // Then try common button texts. Case-insensitive: Android AlertDialog
  // themes render button labels ALL-CAPS. Prefer native Button-class matches
  // (alert titles can carry the same text as a button); fall back to generic
  // text matching for in-app RN dialogs whose buttons aren't widget.Button.
  for (const text of buttonTexts) {
    try {
      const nativeBtn = await byAlertButtonText(driver, text);
      if (await nativeBtn.isExisting()) {
        await nativeBtn.click();
        await driver.pause(300);
        return true;
      }
      const btn = await byTextAnyCase(driver, text);
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
 * Interact with a Picker component (inline animated dropdown).
 * Opens the picker by tapping its trigger, waits for animation,
 * then selects an option by its value.
 * @param {WebdriverIO.Browser} driver
 * @param {string} pickerTestId - testID of the picker trigger (e.g., 'state-picker')
 * @param {string} optionValue - value suffix of the option to select (e.g., 'BE')
 * @param {number} timeout
 */
async function selectPickerOption(driver, pickerTestId, optionValue, timeout = 10000) {
  // Tap picker trigger to open dropdown
  await tapTestId(driver, pickerTestId, timeout);
  await driver.pause(400); // wait for expand animation (200ms) + render

  // Tap the option — testID pattern: {pickerTestId}-option-{value}
  const optionTestId = `${pickerTestId}-option-${optionValue}`;
  await tapTestId(driver, optionTestId, timeout);
  await driver.pause(300); // wait for close animation
}

/**
 * Perform TEST_MODE registration flow (new user).
 * Flow: WelcomeScreen → EmailVerification → RegisterScreen → Consent → Main App.
 * Assumes we are currently on the WelcomeScreen.
 * @param {WebdriverIO.Browser} driver
 */
async function performTestRegistration(driver) {
  try {
    // 1. Tap "Create Account" on Welcome screen
    const registerBtn = await byTestId(driver, 'register-button');
    await registerBtn.waitForExist({ timeout: 5000 });
    await registerBtn.click();
    await driver.pause(1000);

    // 2. Email verification
    await typeTestId(driver, 'email-input', 'test@example.com');
    await dismissKeyboard(driver);

    await tapTestId(driver, 'send-code-button');
    await driver.pause(1500);

    // Dismiss "Code sent" dialog
    await dismissNativeDialog(driver, ['OK']);
    await driver.pause(500);

    // Enter verification code (TEST_MODE accepts 123456)
    await typeTestId(driver, 'code-input', '123456');
    await dismissKeyboard(driver);

    await tapTestId(driver, 'verify-code-button');
    await driver.pause(2000);

    // 3. Registration form — fill required pickers
    // State (Berlin)
    await selectPickerOption(driver, 'state-picker', 'BE');

    // Hospital ("Other" — pinned option, visible without typing min chars)
    await selectPickerOption(driver, 'hospital-picker', 'other');

    // Profession (Physician)
    await selectPickerOption(driver, 'profession-picker', 'physician');

    // Seniority (Assistenzarzt — appears after profession is selected)
    await selectPickerOption(driver, 'seniority-picker', 'assistenzarzt');

    // 4. Scroll down to register button if needed, then tap
    // The register button may be below the fold after all pickers
    if (driver.isAndroid) {
      try {
        const regBtn = await byTestId(driver, 'register-button');
        const displayed = await regBtn.isDisplayed();
        if (!displayed) {
          // Scroll down to reveal button
          const { width, height } = await driver.getWindowSize();
          await driver.action('pointer', { parameters: { pointerType: 'touch' } })
            .move({ x: Math.round(width / 2), y: Math.round(height * 0.7) })
            .down()
            .move({ x: Math.round(width / 2), y: Math.round(height * 0.3), duration: 300 })
            .up()
            .perform();
          await driver.pause(500);
        }
      } catch { /* scroll attempt, continue to tap */ }
    }

    await tapTestId(driver, 'register-button');
    await driver.pause(1500);

    // 5. Accept GDPR consent (ConsentBottomSheet)
    // Uses RBSheet — on Android, UiAutomator2 can see Modal content.
    // On iOS, XCUITest may not — fallback to text-based tapping.
    try {
      await tapTestId(driver, 'consent-checkbox', 8000);
      await driver.pause(300);
      await tapTestId(driver, 'consent-accept-button');
    } catch (e) {
      // Fallback: try tapping by text (works when Modal elements are aggregated)
      console.log('Consent testID tap failed, trying text fallback:', e.message);
      for (const text of ['I agree', 'Ich stimme zu', 'I Agree & Continue', 'Akzeptieren & Fortfahren']) {
        try {
          const checkbox = await byText(driver, text);
          if (await checkbox.isExisting()) {
            await checkbox.click();
            await driver.pause(500);
            break;
          }
        } catch { /* try next */ }
      }
    }
    await driver.pause(3000);

    // 6. Dismiss any permission dialogs after registration
    await dismissPermissionDialogs(driver);
  } catch (e) {
    console.log('performTestRegistration failed:', e.message);
    throw e;
  }
}

/**
 * Tab bar testID and text mapping.
 * NOTE: Settings is NOT a tab — it's a gear button on the StatusScreen.
 * Use navigateToSettings() instead of navigateToTab(driver, 'settings').
 */
const tabConfig = {
  status: { testId: 'tab-status', de: 'Status', en: 'Status' },
  calendar: { testId: 'tab-calendar', de: 'Kalender', en: 'Calendar' },
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
      if (tabKey === 'calendar' || tabKey === 'status') {
        await dismissOnboardingTooltips(driver);
      }
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
      if (tabKey === 'calendar' || tabKey === 'status') {
        await dismissOnboardingTooltips(driver);
      }
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
  if (tabKey === 'calendar' || tabKey === 'status') {
    await dismissOnboardingTooltips(driver);
  }
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
    // Post-2026-05-13 WelcomeScreen (social auth redesign): "Weiter mit
    // E-Mail" (email-signin-button) navigates to LoginScreen, where
    // login-button is the FINAL submit. The old flow tapped login-button
    // on the welcome screen directly — kept as fallback for old builds.
    // (Same bridge as store-assets/lib/seed.js doTestLoginOnLoginScreen.)
    if (await existsTestId(driver, 'email-signin-button')) {
      await tapTestId(driver, 'email-signin-button', 5000);
      await driver.pause(1000);
    } else {
      const loginButton = await byTestId(driver, 'login-button');
      await loginButton.waitForDisplayed({ timeout: 5000 });
      await loginButton.click();
      await driver.pause(1000);
    }

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

  // Wait for app to be ready — either tab bar (authenticated) or a welcome-
  // screen button. Post-2026-05-13 redesign the welcome screen shows
  // email-signin-button; login-button is kept for old builds.
  // Android emulators can take 10+ seconds to load the JS bundle.
  const isOnWelcomeScreen = async () =>
    (await existsTestId(driver, 'email-signin-button')) ||
    (await existsTestId(driver, 'login-button'));

  const maxWait = driver.isAndroid ? 15000 : 8000;
  const pollInterval = 1000;
  let waited = 0;
  while (waited < maxWait) {
    const hasTabBar = await existsTestId(driver, 'tab-status');
    const hasLogin = await isOnWelcomeScreen();
    if (hasTabBar || hasLogin) break;
    await driver.pause(pollInterval);
    waited += pollInterval;
  }

  let authenticated = await isAuthenticated(driver);

  if (!authenticated) {
    // Check if we're on the welcome screen (login/register buttons visible).
    // If so, skip back-presses — on Android, back() from the welcome screen
    // exits the app (this exact miss broke the whole Android suite when the
    // welcome screen redesign renamed the button).
    const onWelcomeScreen = await isOnWelcomeScreen();

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

  console.log('User not authenticated, attempting TEST_MODE login...');

  // Try login first (works for existing/returning users)
  try {
    await performTestLogin(driver);
    await driver.pause(1000);

    const loginWorked = await isAuthenticated(driver);
    if (loginWorked) {
      console.log('TEST_MODE login successful');
      return;
    }
  } catch (e) {
    console.log('Login attempt failed:', e.message);
  }

  // Login didn't work — dismiss any error dialogs
  console.log('Login failed, falling back to registration...');
  await dismissSystemDialogs(driver);
  await driver.pause(500);

  // Navigate back to Welcome screen so we can start registration
  for (let i = 0; i < 3; i++) {
    const hasRegister = await existsTestId(driver, 'register-button');
    if (hasRegister) break;
    if (driver.isAndroid) {
      try { await driver.back(); } catch { break; }
    } else {
      // iOS: tap back button area
      try {
        await driver.action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: 40, y: 65 }).down().up().perform();
      } catch { break; }
    }
    await driver.pause(500);
  }

  // Try registration
  try {
    await performTestRegistration(driver);
    await driver.pause(1000);

    const regWorked = await isAuthenticated(driver);
    if (regWorked) {
      console.log('TEST_MODE registration successful');
      return;
    }
  } catch (e) {
    console.log('Registration attempt failed:', e.message);
  }

  throw new Error('Failed to authenticate - neither login nor registration succeeded');
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
  // On Android, grant background location permission via adb before starting the wizard.
  // Without it, "Add Workplace" navigates to a Permissions screen instead of the setup wizard.
  if (driver.isAndroid) {
    try {
      execSync('adb shell pm grant com.openworkinghours.mobileapp android.permission.ACCESS_BACKGROUND_LOCATION 2>/dev/null');
      // Enable high-accuracy location mode to prevent Google "Location Accuracy" dialog
      execSync('adb shell settings put secure location_mode 3 2>/dev/null');
      console.log('Granted background location permission + enabled high-accuracy mode via adb');
    } catch { /* already granted or adb failed */ }

    // Force-restart app so it picks up the adb permission grant (app caches permission state)
    try {
      await driver.terminateApp('com.openworkinghours.mobileapp');
      await driver.pause(1000);
      await driver.activateApp('com.openworkinghours.mobileapp');
      // Poll for the app to be ready — release-build cold start takes ~20s
      // on emulators ("Loading..." spinner before any screen renders)
      for (let i = 0; i < 30; i++) {
        const ready =
          (await existsTestId(driver, 'tab-status')) ||
          (await existsTestId(driver, 'email-signin-button')) ||
          (await existsTestId(driver, 'login-button'));
        if (ready) break;
        await driver.pause(1000);
      }
      await dismissSystemDialogs(driver);
      // The restart may land on the welcome screen if auth state didn't
      // survive the process kill — re-authenticate if needed.
      await ensureAuthenticated(driver);
    } catch (e) {
      console.log('App restart recovery issue:', e.message);
    }

    // Navigate to Status tab where "Add Workplace" button is
    await navigateToTab(driver, 'status');
    await driver.pause(1000);

    // Tap "Add Workplace" to open the wizard (it's still showing after restart)
    try {
      await tapTestId(driver, 'add-workplace-button', 5000);
      await driver.pause(2000);
      console.log('Tapped "Add Workplace" after app restart');
    } catch (e) {
      console.log('Could not tap "Add Workplace" after restart:', e.message);
    }
  } else {
    // iOS: tap "Add Workplace" on the Status screen to open the wizard.
    // (The Android branch taps it after its permission-grant restart; the iOS
    // path previously never tapped it, so the wizard never opened and
    // setup-search-input could not be found.)
    try {
      await tapTestId(driver, 'add-workplace-button', 5000);
      await driver.pause(1500);
    } catch (e) {
      console.log('Could not tap "Add Workplace":', e.message);
    }
  }

  await advancePastSetupForegroundPrimer(driver);

  // Dismiss location permission dialog (Android shows it immediately after map load)
  await dismissPermissionDialogs(driver);
  await driver.pause(driver.isAndroid ? 3000 : 1000); // Wait for map + potential GPS dialog

  // Dismiss Google "Location Accuracy" dialog and other GPS dialogs.
  // May appear with a delay after the map loads, so poll for it.
  for (let i = 0; i < 6; i++) {
    const dismissed = await dismissNativeDialog(driver, ['OK', 'No thanks', 'No Thanks', 'Turn on']);
    if (dismissed) {
      console.log('Dismissed GPS/location dialog');
      break;
    }
    if (i < 5) await driver.pause(1000);
  }

  // The wizard may START at Step 2 (radius) instead of Step 1 (search):
  // when the user's registered hospital has directory coordinates, the pin is
  // pre-placed (v2.1.2 hospital pre-population) and the search step is
  // skipped. The TEST_MODE mock user has hospitalRefId 6, so this is the
  // common path in E2E.
  const onSearchStep = await existsTestId(driver, 'setup-search-input');
  if (onSearchStep) {
    // Step 1: Search for a location, or tap the map as fallback if geocoding fails
    await typeTestId(driver, 'setup-search-input', 'Berlin');
    await dismissKeyboard(driver);

    // Wait for geocoding results — Photon API can be slow on emulators
    let searchWorked = false;
    try {
      const firstResult = await byTestId(driver, 'setup-search-result-0');
      await firstResult.waitForDisplayed({ timeout: 15000 });
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
  } else {
    console.log('Wizard started at Step 2 (hospital pre-population) — skipping search step');
  }

  // Step 2: Radius — just continue with default
  await tapTestId(driver, 'setup-continue-step2');
  await driver.pause(500);

  // Step 3: Name — enter a name and save.
  // Android: do NOT dismiss the keyboard here — driver.hideKeyboard() presses
  // Back, which pops the wizard screen (verified empirically, even with the
  // keyboard shown). adjustResize keeps the save button on-screen with the
  // keyboard up, so it can be tapped directly.
  await typeTestId(driver, 'setup-name-input', 'Test Hospital');
  await driver.pause(300);
  if (!driver.isAndroid) {
    await dismissKeyboard(driver);
  }

  await scrollToTestId(driver, 'setup-save-button');
  await tapTestId(driver, 'setup-save-button');
  await driver.pause(1000);
  await skipSetupPostSavePermissionPrimers(driver);
  await driver.pause(1000); // wait for save + navigation back

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

  // After wizard, ensure we're back on a tab-bar screen. NO blind back-press
  // here: if the app is already on the tab root, back() EXITS the app on
  // Android (this left the whole suite staring at the launcher). Instead
  // re-foreground the app and wait for the tab bar — post-save transitions
  // (primers, auto check-in) can take a while on emulators.
  try {
    await driver.activateApp('com.openworkinghours.mobileapp');
  } catch { /* already in foreground */ }
  for (let i = 0; i < 15; i++) {
    if (await existsTestId(driver, 'tab-status')) break;
    // Late-appearing post-save primers block the way to the tab bar
    if (await existsTestId(driver, 'setup-background-primer-skip')) {
      await tapTestId(driver, 'setup-background-primer-skip');
    } else if (await existsTestId(driver, 'setup-notification-primer-skip')) {
      await tapTestId(driver, 'setup-notification-primer-skip');
    } else {
      await dismissNativeDialog(driver, ['OK', 'CONTINUE ANYWAY', 'Allow', 'Erlauben']);
    }
    await driver.pause(1000);
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
  // Navigate to calendar tab first
  await navigateToTab(driver, 'calendar');
  await driver.pause(500);

  // Dismiss any open panels/pickers if FAB is not visible
  // (FAB is hidden when InlinePicker, TemplatePanel, or ManualSessionForm is open, or in month view)
  let fabExists = await existsTestId(driver, 'calendar-fab');
  if (!fabExists) {
    // First-visit onboarding tooltips can also hide the FAB
    await dismissOnboardingTooltips(driver);
    fabExists = await existsTestId(driver, 'calendar-fab');
  }
  if (!fabExists) {
    // Try dismissing open overlays — press back on Android, tap outside on iOS.
    // Android: ONLY press back when an overlay is verifiably open — back with
    // nothing open exits the app from the tab root (left the suite on the
    // launcher home screen).
    for (let i = 0; i < 2; i++) {
      if (driver.isAndroid) {
        const overlayOpen =
          (await existsTestId(driver, 'inline-picker-cancel')) ||
          (await existsTestId(driver, 'template-panel-overlay')) ||
          (await existsTestId(driver, 'manual-session-cancel'));
        if (!overlayOpen) break;
        try { await driver.back(); } catch { /* ignore */ }
      } else {
        try {
          await driver.action('pointer', { parameters: { pointerType: 'touch' } })
            .move({ x: 215, y: 50 }).down().up().perform();
        } catch { /* ignore */ }
      }
      await driver.pause(500);
      fabExists = await existsTestId(driver, 'calendar-fab');
      if (fabExists) break;
    }
  }

  // If FAB still not visible, we may be in month view — switch to week
  if (!fabExists) {
    try {
      const toggle = await byTestId(driver, 'toggle-week');
      if (await toggle.isExisting()) {
        await toggle.click();
        await driver.pause(1000);
      }
    } catch {
      // Fallback to text matching for older builds
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
}

/**
 * Scroll until an element with the given testID is in the view tree.
 * Android only renders on-screen elements into the UiAutomator tree, so
 * below-the-fold elements "don't exist" until scrolled to (iOS exposes the
 * whole tree, where this returns immediately).
 * Tries UiScrollable scrollIntoView first, then manual swipes.
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @param {number} maxSwipes
 * @returns {Promise<boolean>} whether the element exists after scrolling
 */
async function scrollToTestId(driver, testId, maxSwipes = 4) {
  if (await existsTestId(driver, testId)) return true;

  if (driver.isAndroid) {
    try {
      const el = await driver.$(
        `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceIdMatches("(.*:id/)?${testId}$"))`
      );
      if (await el.isExisting()) return true;
    } catch { /* no scrollable container or not found — try manual swipes */ }
  }

  for (let i = 0; i < maxSwipes; i++) {
    try {
      const { width, height } = await driver.getWindowSize();
      await driver.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: Math.round(width / 2), y: Math.round(height * 0.7) })
        .down()
        .move({ x: Math.round(width / 2), y: Math.round(height * 0.3), duration: 400 })
        .up()
        .perform();
      await driver.pause(500);
    } catch { /* swipe failed — re-check existence anyway */ }
    if (await existsTestId(driver, testId)) return true;
  }
  return existsTestId(driver, testId);
}

/**
 * Navigate to Settings screen by tapping the gear button.
 * Replaces the fragile navigateToTab(driver, 'settings') pattern.
 * @param {WebdriverIO.Browser} driver
 */
async function navigateToSettings(driver) {
  await tapTestId(driver, 'settings-gear-button', 5000);
  await driver.pause(500);
}

module.exports = {
  tapTestId,
  tapText,
  tapI18n,
  typeTestId,
  waitForTestId,
  waitForText,
  existsTestId,
  dismissOnboardingTooltips,
  advancePastSetupForegroundPrimer,
  skipSetupPostSavePermissionPrimers,
  dismissAndroidSystemDialog,
  dismissNativeDialog,
  dismissPermissionDialogs,
  dismissSystemDialogs,
  waitForTestIdWithRetry,
  selectPickerOption,
  isAuthenticated,
  performTestLogin,
  performTestRegistration,
  ensureAuthenticated,
  navigateToTab,
  navigateToSettings,
  screenshot,
  isLocationConfigured,
  ensureLocationConfigured,
  ensureCleanCalendarState,
  scrollToTestId,
  dismissKeyboard,
  dismissKeyboardFromInput,
};
