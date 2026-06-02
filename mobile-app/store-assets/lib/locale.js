/**
 * iOS simulator locale switching.
 *
 * Sets AppleLanguages + AppleLocale on the booted simulator, then terminates
 * the app so it picks up the new locale on next launch.
 *
 * Caller is responsible for re-launching the app after this resolves.
 */

const { execSync } = require('child_process');
const { APP_BUNDLE_ID } = require('./capture');

const LOCALE_MAP = {
  en: { language: 'en-US', locale: 'en_US' },
  de: { language: 'de-DE', locale: 'de_DE' },
};

/**
 * Set the booted iOS simulator's language + locale.
 * Terminates the app so it picks up the new locale on next launch.
 *
 * @param {string} locale - "en" or "de"
 */
function setLocale(locale) {
  const cfg = LOCALE_MAP[locale];
  if (!cfg) {
    throw new Error(`Unsupported locale "${locale}". Supported: ${Object.keys(LOCALE_MAP).join(', ')}`);
  }

  console.log(`  → setting simulator locale to ${cfg.language}`);

  // Terminate app first so the locale change is picked up on next launch.
  try {
    execSync(`xcrun simctl terminate booted ${APP_BUNDLE_ID}`, { stdio: 'pipe' });
  } catch {
    /* not running — fine */
  }

  // Write language + locale defaults.
  execSync(
    `xcrun simctl spawn booted defaults write -g AppleLanguages "(${cfg.language})"`,
    { stdio: 'pipe' }
  );
  execSync(
    `xcrun simctl spawn booted defaults write -g AppleLocale ${cfg.locale}`,
    { stdio: 'pipe' }
  );

  // App also caches its own locale — wipe NSUserDefaults for our bundle.
  try {
    execSync(
      `xcrun simctl spawn booted defaults delete ${APP_BUNDLE_ID} 2>/dev/null || true`,
      { stdio: 'pipe' }
    );
  } catch {
    /* ignore */
  }
}

/**
 * Launch the app via simctl (no Appium session required).
 * Use this before opening an Appium session.
 */
function launchApp() {
  execSync(`xcrun simctl launch booted ${APP_BUNDLE_ID}`, { stdio: 'pipe' });
}

module.exports = {
  setLocale,
  launchApp,
  LOCALE_MAP,
};
