#!/usr/bin/env node
/**
 * Orchestrator: runs all flows in all locales, then composes.
 *
 * For each locale:
 *   1. Set iOS simulator locale + terminate app
 *   2. Run each flow (each flow opens its own Appium session, navigates, captures)
 *   3. Run compose
 *
 * Run:
 *   node capture-all.js              # all locales + all flows
 *   LOCALES=en node capture-all.js   # one locale
 *   FLOWS=01-geofence node capture-all.js  # one flow
 *
 * Prerequisites:
 *   - Appium running (cd ../e2e && npm run infra:ios)
 *   - Simulator booted
 *   - App built with TEST_MODE (cd ../e2e && npm run build:ios)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { setLocale } = require('./lib/locale');
const { resetStatusBar } = require('./lib/capture');

const FLOWS_DIR = path.join(__dirname, 'flows');

function listFlows() {
  return fs
    .readdirSync(FLOWS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => f.replace(/\.js$/, ''));
}

function runNode(scriptPath, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function runFlowsForLocale(locale, flows) {
  console.log(`\n━━━ Locale: ${locale} ━━━`);
  setLocale(locale);

  for (const flow of flows) {
    console.log(`\n→ ${flow}`);
    const flowPath = path.join(FLOWS_DIR, `${flow}.js`);
    try {
      await runNode(flowPath, { LOCALE: locale });
    } catch (err) {
      console.error(`✗ ${flow} failed: ${err.message}`);
      // Continue with other flows — don't fail the whole run on one bad flow.
    }
  }
}

async function main() {
  const locales = (process.env.LOCALES || 'en,de').split(',').map((s) => s.trim()).filter(Boolean);
  const requested = process.env.FLOWS ? process.env.FLOWS.split(',').map((s) => s.trim()) : null;
  const allFlows = listFlows();
  const flows = requested ? allFlows.filter((f) => requested.includes(f)) : allFlows;

  if (flows.length === 0) {
    console.error('✗ No flows to run.');
    process.exit(1);
  }

  console.log(`Locales: ${locales.join(', ')}`);
  console.log(`Flows:   ${flows.join(', ')}`);

  try {
    for (const locale of locales) {
      await runFlowsForLocale(locale, flows);
    }

    console.log(`\n━━━ Compose ━━━`);
    await runNode(path.join(__dirname, 'compose.js'), { LOCALES: locales.join(',') });

    console.log(`\n✓ All done. Drag composed/{en,de}/*.png into App Store Connect.`);
  } finally {
    resetStatusBar();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n✗ capture-all failed:', err.message);
    resetStatusBar();
    process.exit(1);
  });
}
