/**
 * Common Test Actions
 *
 * Reusable actions for E2E tests with built-in waits and error handling.
 */

const { byTestId, byText, byI18n, byI18nFast, t, i18n } = require('./selectors');

/**
 * Tap element by testID
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @param {number} timeout - Max wait time in ms
 */
async function tapTestId(driver, testId, timeout = 10000) {
  const element = await byTestId(driver, testId);
  await element.waitForDisplayed({ timeout });
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
  // Handle Android system dialogs first
  if (driver.isAndroid) {
    // Try multiple times in case multiple dialogs appear
    for (let i = 0; i < 3; i++) {
      const dismissed = await dismissAndroidSystemDialog(driver);
      if (!dismissed) break;
      await driver.pause(300);
    }
  }

  // Try both languages for app-level Allow button
  await dismissAlert(driver, 'Allow');
  await dismissAlert(driver, 'Erlauben');
  // Handle any OK dialogs
  await dismissAlert(driver, 'OK');
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

    if (driver.isAndroid) {
      try { await driver.hideKeyboard(); } catch { /* ignore */ }
    }

    // Send code
    const sendCodeButton = await byTestId(driver, 'send-code-button');
    await sendCodeButton.click();
    await driver.pause(1500);

    // Dismiss "Code sent" dialog
    await dismissAlert(driver, 'OK');
    await driver.pause(500);

    // Enter verification code (TEST_MODE accepts 123456)
    const codeInput = await byTestId(driver, 'code-input');
    await codeInput.waitForDisplayed({ timeout: 5000 });
    await codeInput.setValue('123456');

    if (driver.isAndroid) {
      try { await driver.hideKeyboard(); } catch { /* ignore */ }
    }

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
 * Ensure user is authenticated before running tests
 * Performs TEST_MODE login if not already logged in
 * @param {WebdriverIO.Browser} driver
 */
async function ensureAuthenticated(driver) {
  await dismissPermissionDialogs(driver);

  const authenticated = await isAuthenticated(driver);
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

module.exports = {
  tapTestId,
  tapText,
  tapI18n,
  typeTestId,
  waitForTestId,
  waitForText,
  existsTestId,
  dismissAlert,
  dismissAndroidSystemDialog,
  dismissPermissionDialogs,
  isAuthenticated,
  ensureAuthenticated,
  navigateToTab,
  screenshot,
};
