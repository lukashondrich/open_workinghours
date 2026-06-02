#!/usr/bin/env node
/**
 * Screenshot flow: Geofence map (LocationsListScreen).
 *
 * Navigates: Status → Settings tab → "Work Locations" → captures.
 *
 * Run standalone:
 *   LOCALE=en node flows/01-geofence.js
 *
 * Run via orchestrator:
 *   node capture-all.js
 *
 * Prerequisites: Appium running, simulator booted, app installed with TEST_MODE.
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const {
  ensureLocationConfigured,
  navigateToTab,
  navigateToSettings,
  tapI18n,
} = require('../../e2e/helpers/actions');
const { ensureAuthenticatedForScreenshots, ensureOneLocation } = require('../lib/seed');
const { capture } = require('../lib/capture');

const FLOW_NAME = '01-geofence';

async function run() {
  const driver = await createDriver(getPlatform());
  try {
    await driver.pause(2000);
    await ensureAuthenticatedForScreenshots(driver);

    try {
      await ensureOneLocation(driver);
    } catch (e) {
      console.warn(`  ⚠ ensureOneLocation failed: ${e.message}`);
    }

    // Navigate: Status (with settings gear) → Settings → Work Locations.
    await navigateToTab(driver, 'status');
    await driver.pause(500);
    await navigateToSettings(driver);
    await driver.pause(500);
    const { byText } = require('../../e2e/helpers/selectors');
    const locale = process.env.LOCALE || 'en';
    const label = locale === 'de' ? 'Arbeitsorte' : 'Work Locations';
    const row = await byText(driver, label);
    await row.waitForExist({ timeout: 8000 });
    await row.click();
    await driver.pause(3000); // map tiles need extra time

    await capture(driver, FLOW_NAME);
  } finally {
    try { await driver.deleteSession(); } catch { /* ignore */ }
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(`✗ ${FLOW_NAME} failed:`, err.message);
    process.exit(1);
  });
}

module.exports = { run, FLOW_NAME };
