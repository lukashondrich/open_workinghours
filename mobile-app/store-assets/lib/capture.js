/**
 * Screenshot capture helpers.
 *
 * Cleans the iOS status bar (9:41 AM, full battery/signal, no notifications),
 * takes a screenshot via the Appium driver, and writes it to raw/{locale}/{name}.png.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_BUNDLE_ID = 'com.openworkinghours.mobileapp';
const RAW_DIR = path.join(__dirname, '..', 'raw');

/**
 * Set a clean iOS simulator status bar.
 * Apple App Store reviewers prefer the canonical 9:41 AM time, full battery/signal.
 * No-op on Android.
 */
function cleanStatusBar() {
  try {
    execSync(
      `xcrun simctl status_bar booted override ` +
      `--time "9:41" ` +
      `--dataNetwork wifi ` +
      `--wifiMode active ` +
      `--wifiBars 3 ` +
      `--cellularMode active ` +
      `--cellularBars 4 ` +
      `--operatorName "" ` +
      `--batteryState charged ` +
      `--batteryLevel 100`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    // Not booted, not iOS, or simctl unavailable — ignore.
  }
}

/**
 * Clear status bar override (reset to default).
 */
function resetStatusBar() {
  try {
    execSync(`xcrun simctl status_bar booted clear`, { stdio: 'pipe' });
  } catch {
    /* ignore */
  }
}

/**
 * Capture a screenshot and save to raw/{locale}/{name}.png.
 *
 * @param {WebdriverIO.Browser} driver
 * @param {string} name - filename without extension, e.g. "01-geofence"
 * @param {object} [options]
 * @param {string} [options.locale] - "en" or "de"; defaults to process.env.LOCALE or "en"
 * @param {number} [options.settleMs=400] - pause before capture to let UI settle
 */
async function capture(driver, name, options = {}) {
  const locale = options.locale || process.env.LOCALE || 'en';
  const settleMs = options.settleMs ?? 400;

  cleanStatusBar();
  await driver.pause(settleMs);

  const dir = path.join(RAW_DIR, locale);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${name}.png`);

  const base64 = await driver.takeScreenshot();
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));

  console.log(`  ✓ captured raw/${locale}/${name}.png`);
  return outPath;
}

module.exports = {
  capture,
  cleanStatusBar,
  resetStatusBar,
  APP_BUNDLE_ID,
  RAW_DIR,
};
