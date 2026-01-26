/**
 * Cross-Platform Selectors
 *
 * Helpers to find elements by testID and text on both iOS and Android.
 * testID is exposed differently on each platform:
 * - iOS: accessibility id (~testId)
 * - Android: resource-id (UiSelector)
 */

/**
 * Find element by testID (works on both platforms)
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byTestId(driver, testId) {
  if (driver.isIOS) {
    return driver.$(`~${testId}`);
  } else {
    return driver.$(`android=new UiSelector().resourceId("${testId}")`);
  }
}

/**
 * Find element by text content
 * @param {WebdriverIO.Browser} driver
 * @param {string} text - Exact or partial text to match
 * @param {boolean} exact - If true, match exact text; if false, contains
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byText(driver, text, exact = false) {
  if (driver.isIOS) {
    if (exact) {
      return driver.$(`-ios predicate string:label == "${text}"`);
    } else {
      return driver.$(`-ios predicate string:label CONTAINS "${text}"`);
    }
  } else {
    if (exact) {
      return driver.$(`android=new UiSelector().text("${text}")`);
    } else {
      return driver.$(`android=new UiSelector().textContains("${text}")`);
    }
  }
}

/**
 * Find element by accessibility label
 * @param {WebdriverIO.Browser} driver
 * @param {string} label
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byLabel(driver, label) {
  if (driver.isIOS) {
    return driver.$(`-ios predicate string:label == "${label}"`);
  } else {
    return driver.$(`android=new UiSelector().description("${label}")`);
  }
}

/**
 * Platform-aware text lookup (handles German iOS vs English Android)
 */
const i18n = {
  // Tab bar
  status: { ios: 'Status', android: 'Status' },
  calendar: { ios: 'Kalender', android: 'Calendar' },
  settings: { ios: 'Einstellungen', android: 'Settings' },

  // Auth
  register: { ios: 'Registrieren', android: 'Register' },
  login: { ios: 'Anmelden', android: 'Login' },
  sendCode: { ios: 'Code senden', android: 'Send Code' },
  verify: { ios: 'Bestätigen', android: 'Verify' },

  // Location
  addLocation: { ios: 'Neuen Standort hinzufügen', android: 'Add new location' },
  continue: { ios: 'Weiter', android: 'Continue' },
  save: { ios: 'Speichern', android: 'Save' },

  // Dialogs
  allow: { ios: 'Erlauben', android: 'Allow' },
  ok: { ios: 'OK', android: 'OK' },
  cancel: { ios: 'Abbrechen', android: 'Cancel' },
};

/**
 * Get localized text for current platform
 * @param {WebdriverIO.Browser} driver
 * @param {string} key - Key from i18n object
 * @returns {string}
 */
function t(driver, key) {
  const platform = driver.isIOS ? 'ios' : 'android';
  return i18n[key]?.[platform] || key;
}

/**
 * Find element by localized text
 * @param {WebdriverIO.Browser} driver
 * @param {string} key - Key from i18n object
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byI18n(driver, key) {
  const text = t(driver, key);
  return byText(driver, text);
}

module.exports = {
  byTestId,
  byText,
  byLabel,
  byI18n,
  t,
  i18n,
};
