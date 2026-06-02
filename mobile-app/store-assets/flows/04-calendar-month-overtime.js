#!/usr/bin/env node
/**
 * Screenshot flow: Calendar month view with overtime + absences visible.
 *
 * TODO:
 *   1. Navigate to Calendar tab
 *   2. Switch to month view (tap toggle-month)
 *   3. Ensure visible: an overtime day, a sick day, a vacation day
 *      (depends on seed data — see seed/ TODO in README)
 *
 * Run standalone:
 *   LOCALE=en node flows/04-calendar-month-overtime.js
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const {
  navigateToTab,
  tapTestId,
} = require('../../e2e/helpers/actions');
const { ensureAuthenticatedForScreenshots } = require('../lib/seed');
const { capture } = require('../lib/capture');

const FLOW_NAME = '04-calendar-month-overtime';

async function run() {
  const driver = await createDriver(getPlatform());
  try {
    await driver.pause(2000);
    await ensureAuthenticatedForScreenshots(driver);
    await navigateToTab(driver, 'calendar');
    await driver.pause(500);

    // Switch to month view
    try {
      await tapTestId(driver, 'toggle-month', 3000);
      await driver.pause(800);
    } catch {
      // Already in month view — fine.
    }

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
