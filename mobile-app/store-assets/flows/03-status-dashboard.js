#!/usr/bin/env node
/**
 * Screenshot flow: Status / 14-day dashboard (StatusScreen).
 *
 * TODO: Navigate to Status tab. If seed data is wired up, this just works.
 * Without seed data, the dashboard will be empty and the screenshot won't sell.
 *
 * Run standalone:
 *   LOCALE=en node flows/03-status-dashboard.js
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const {
  navigateToTab,
} = require('../../e2e/helpers/actions');
const { ensureAuthenticatedForScreenshots, ensureOneLocation } = require('../lib/seed');
const { capture } = require('../lib/capture');

const FLOW_NAME = '03-status-dashboard';

async function run() {
  const driver = await createDriver(getPlatform());
  try {
    await driver.pause(2000);
    await ensureAuthenticatedForScreenshots(driver);
    // Shifts + location now seeded automatically via TEST_SCREENSHOT_SEED flag in App.tsx.
    await navigateToTab(driver, 'status');
    await driver.pause(1500);

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
