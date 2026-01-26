/**
 * Common Test Actions
 *
 * Reusable actions for E2E tests with built-in waits and error handling.
 */

const { byTestId, byText, byI18n, t } = require('./selectors');

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
 * Dismiss common permission dialogs
 * @param {WebdriverIO.Browser} driver
 */
async function dismissPermissionDialogs(driver) {
  // Handle notification permission
  await dismissAlert(driver, t(driver, 'allow'));
  // Handle any OK dialogs
  await dismissAlert(driver, t(driver, 'ok'));
}

/**
 * Navigate to a tab by tapping tab bar
 * @param {WebdriverIO.Browser} driver
 * @param {string} tabKey - i18n key: 'status', 'calendar', or 'settings'
 */
async function navigateToTab(driver, tabKey) {
  await tapI18n(driver, tabKey);
  await driver.pause(500);
}

/**
 * Take screenshot and save to file
 * @param {WebdriverIO.Browser} driver
 * @param {string} name
 */
async function screenshot(driver, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${driver.platform}-${timestamp}.png`;
  const data = await driver.takeScreenshot();
  require('fs').writeFileSync(`./screenshots/${filename}`, data, 'base64');
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
