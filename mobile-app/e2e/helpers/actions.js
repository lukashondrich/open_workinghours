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
 * Dismiss common permission dialogs (handles both German and English)
 * @param {WebdriverIO.Browser} driver
 */
async function dismissPermissionDialogs(driver) {
  // Try both languages for Allow button
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

module.exports = {
  tapTestId,
  tapText,
  tapI18n,
  typeTestId,
  waitForTestId,
  waitForText,
  existsTestId,
  dismissAlert,
  dismissPermissionDialogs,
  navigateToTab,
  screenshot,
};
