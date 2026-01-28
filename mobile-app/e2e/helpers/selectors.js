/**
 * Cross-Platform Selectors
 *
 * Helpers to find elements by testID and text on both iOS and Android.
 * testID is exposed differently on each platform:
 * - iOS: accessibility id (~testId)
 * - Android: resource-id via UiSelector
 *
 * Android requirements for testID visibility:
 * 1. Element needs accessible={true}
 * 2. Parent Views need accessible={false} (prevents child aggregation)
 * 3. Add collapsable={false} to prevent view flattening
 * See: https://github.com/facebook/react-native/issues/6560
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
    // On Android, testID maps to resource-id
    // Use resourceIdMatches with regex to handle cases with/without package prefix
    // Pattern matches: "testId" OR "com.package:id/testId"
    return driver.$(`android=new UiSelector().resourceIdMatches(".*${testId}.*").instance(0)`);
  }
}

/**
 * Find element by testID with fallback to accessibility label
 * Use this for elements that might have accessible={true}
 * @param {WebdriverIO.Browser} driver
 * @param {string} testId
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byTestIdOrLabel(driver, testId) {
  if (driver.isIOS) {
    return driver.$(`~${testId}`);
  } else {
    // Try resourceId first, then content-desc
    const byId = await driver.$(`android=new UiSelector().resourceId("${testId}")`);
    if (await byId.isExisting()) {
      return byId;
    }
    return driver.$(`android=new UiSelector().description("${testId}")`);
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
 * Bilingual text lookup - app can be in German or English regardless of platform
 * Try German first (primary app language), fall back to English
 */
const i18n = {
  // Tab bar
  status: { de: 'Status', en: 'Status' },
  calendar: { de: 'Kalender', en: 'Calendar' },
  settings: { de: 'Einstellungen', en: 'Settings' },

  // Auth
  register: { de: 'Registrieren', en: 'Register' },
  login: { de: 'Anmelden', en: 'Login' },
  sendCode: { de: 'Code senden', en: 'Send Code' },
  verify: { de: 'Bestätigen', en: 'Verify' },

  // Location
  addLocation: { de: 'Arbeitsplatz hinzufügen', en: 'Add workplace' },
  workLocations: { de: 'Arbeitsorte', en: 'Work Locations' },
  continue: { de: 'Weiter', en: 'Continue' },
  save: { de: 'Speichern', en: 'Save' },

  // Calendar
  week: { de: 'Woche', en: 'Week' },
  month: { de: 'Monat', en: 'Month' },
  shifts: { de: 'Schichten', en: 'Shifts' },
  absences: { de: 'Abwesenheiten', en: 'Absences' },

  // Status
  last14Days: { de: 'Letzte 14 Tage', en: 'Last 14 Days' },

  // Dialogs
  allow: { de: 'Erlauben', en: 'Allow' },
  ok: { de: 'OK', en: 'OK' },
  cancel: { de: 'Abbrechen', en: 'Cancel' },
};

/**
 * Get text in specified language
 * @param {string} key - Key from i18n object
 * @param {string} lang - 'de' or 'en'
 * @returns {string}
 */
function t(driver, key, lang = 'de') {
  return i18n[key]?.[lang] || key;
}

/**
 * Find element by localized text - tries German first, then English
 * @param {WebdriverIO.Browser} driver
 * @param {string} key - Key from i18n object
 * @param {number} timeout - Max time to search in ms
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byI18n(driver, key, timeout = 5000) {
  const deText = i18n[key]?.de;
  const enText = i18n[key]?.en;

  if (!deText && !enText) {
    // Fallback: use key as text
    return byText(driver, key);
  }

  // Try German first
  if (deText) {
    const deElement = await byText(driver, deText);
    try {
      await deElement.waitForExist({ timeout: timeout / 2 });
      if (await deElement.isExisting()) {
        return deElement;
      }
    } catch (e) {
      // German not found, try English
    }
  }

  // Try English
  if (enText && enText !== deText) {
    return byText(driver, enText);
  }

  // Return German element (will fail with proper error message)
  return byText(driver, deText || key);
}

/**
 * Find element by either German or English text (whichever exists)
 * Faster than byI18n when you just need to check existence
 * @param {WebdriverIO.Browser} driver
 * @param {string} key - Key from i18n object
 * @returns {Promise<WebdriverIO.Element>}
 */
async function byI18nFast(driver, key) {
  const deText = i18n[key]?.de || key;
  const enText = i18n[key]?.en || key;

  if (driver.isIOS) {
    // iOS: use predicate with OR
    return driver.$(`-ios predicate string:label CONTAINS "${deText}" OR label CONTAINS "${enText}"`);
  } else {
    // Android: use regex pattern
    return driver.$(`android=new UiSelector().textMatches("(?i).*(${deText}|${enText}).*")`);
  }
}

module.exports = {
  byTestId,
  byTestIdOrLabel,
  byText,
  byLabel,
  byI18n,
  byI18nFast,
  t,
  i18n,
};
