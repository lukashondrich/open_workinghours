#!/usr/bin/env node
/**
 * Screenshot flow: Reports / collective insights.
 *
 * TODO:
 *   1. Navigate to Reports tab
 *   2. Ideally: ensure CollectiveInsightsData has a populated state
 *      (mocked or seeded — Reports without insights data looks empty)
 *   3. Capture with the insights cards visible AND a week ready to send
 *      (so "Contribute anonymously" is implicitly shown)
 *
 * Run standalone:
 *   LOCALE=en node flows/06-collective-insights.js
 */

const { createDriver, getPlatform } = require('../../e2e/helpers/driver');
const { tapTestId } = require('../../e2e/helpers/actions');
const { ensureAuthenticatedForScreenshots } = require('../lib/seed');
const { capture } = require('../lib/capture');

const FLOW_NAME = '06-collective-insights';

async function run() {
  const driver = await createDriver(getPlatform());
  try {
    await driver.pause(2000);
    await ensureAuthenticatedForScreenshots(driver);
    // navigateToTab's tabConfig doesn't include 'reports'; tap by testID directly.
    await tapTestId(driver, 'tab-reports', 5000);
    await driver.pause(2000); // CollectiveInsightsService fetch + render

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
