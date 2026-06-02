#!/usr/bin/env node
/**
 * Screenshot flow: Calendar week view + Shifts template panel open.
 *
 * Navigates: Calendar tab → FAB → Shifts → captures with panel + template visible.
 *
 * Run standalone:
 *   LOCALE=en node flows/02-calendar-week-template.js
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const {
  ensureAuthenticated,
  ensureLocationConfigured,
  ensureCleanCalendarState,
  navigateToTab,
  tapTestId,
} = require('../../e2e/helpers/actions');
const { ensureMinimalSeed, openShiftsPanel } = require('../lib/seed');
const { capture } = require('../lib/capture');

const FLOW_NAME = '02-calendar-week-template';

async function run() {
  const driver = await createDriver(getPlatform());
  try {
    await driver.pause(2000);
    await ensureAuthenticated(driver);
    await ensureLocationConfigured(driver);
    await ensureMinimalSeed(driver);  // ensures at least one template exists

    // Open the Shifts template panel for the screenshot.
    await navigateToTab(driver, 'calendar');
    await ensureCleanCalendarState(driver);
    await driver.pause(500);
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(800);
    await openShiftsPanel(driver);
    await driver.pause(600); // let panel finish animating

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
