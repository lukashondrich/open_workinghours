#!/usr/bin/env node
/**
 * Screenshot flow: DataPrivacyScreen.
 *
 * Navigates: Settings tab → "Data Privacy" row → captures.
 *
 * Run standalone:
 *   LOCALE=en node flows/05-privacy.js
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const {
  navigateToTab,
  navigateToSettings,
  tapI18n,
} = require('../../e2e/helpers/actions');
const { ensureAuthenticatedForScreenshots } = require('../lib/seed');
const { capture } = require('../lib/capture');

const FLOW_NAME = '05-privacy';

async function run() {
  const driver = await createDriver(getPlatform());
  try {
    await driver.pause(2000);
    await ensureAuthenticatedForScreenshots(driver);
    await navigateToTab(driver, 'status');
    await driver.pause(500);
    await navigateToSettings(driver);
    await driver.pause(500);

    const { byText } = require('../../e2e/helpers/selectors');
    const locale = process.env.LOCALE || 'en';
    const label = locale === 'de' ? 'Daten & Datenschutz' : 'Data & Privacy';
    const row = await byText(driver, label);
    await row.waitForExist({ timeout: 8000 });
    await row.click();
    await driver.pause(800);

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
