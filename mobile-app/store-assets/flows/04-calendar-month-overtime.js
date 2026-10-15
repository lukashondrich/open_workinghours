#!/usr/bin/env node
/**
 * Screenshot flow: Calendar month view with overtime + absences visible.
 *
 * Navigates: Calendar tab → month toggle (verified: waits for today's month
 * cell, re-taps if the toggle tap was swallowed) → captures. Overtime, sick
 * and vacation days come from the TEST_SCREENSHOT_SEED data.
 *
 * Run standalone:
 *   LOCALE=en node flows/04-calendar-month-overtime.js
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const {
  navigateToTab,
  tapTestId,
} = require('../../e2e/helpers/actions');
const { byTestId } = require('../../e2e/helpers/selectors');
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

    // Switch to month view — and VERIFY it took effect. A plain tap on the
    // toggle is sometimes swallowed right after the tab switch (the capture
    // then silently lands on week view, seen 2026-08-13), so wait for today's
    // month cell to exist and re-tap if it doesn't.
    const todayKey = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
    const todayCell = await byTestId(driver, `month-day-${todayKey}`);
    let inMonthView = false;
    for (let attempt = 1; attempt <= 3 && !inMonthView; attempt++) {
      try {
        await tapTestId(driver, 'toggle-month', 3000);
      } catch {
        // toggle not found — fall through to the check below
      }
      try {
        await todayCell.waitForExist({ timeout: 2500 });
        inMonthView = true;
      } catch {
        console.log(`  toggle-month tap ${attempt} did not switch the view — retrying`);
        await driver.pause(500);
      }
    }
    if (!inMonthView) throw new Error('could not switch the calendar to month view');
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
