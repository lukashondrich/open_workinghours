/**
 * Seed helpers.
 *
 * Idempotent: creates app state needed for non-empty screenshots.
 * Called by flows that need data (template panel, status dashboard, etc.).
 *
 * v1 scope: only ensures at least one shift template exists.
 *
 * Phase 2 TODO:
 *   - place shifts on the current week (so status + month views look populated)
 *   - place an absence (so month view shows the absence dot)
 *   - mock CollectiveInsightsService for the Reports screen
 */

const { byTestId, byI18n } = require('../../e2e/helpers/selectors');
const {
  tapTestId,
  typeTestId,
  navigateToTab,
  ensureCleanCalendarState,
  waitForTestIdWithRetry,
  existsTestId,
  dismissKeyboard,
  dismissNativeDialog,
  dismissPermissionDialogs,
} = require('../../e2e/helpers/actions');

const SHIFT_TEMPLATE_NAME = 'Frühschicht';

/**
 * Open the Shifts template panel via the FAB.
 * Mirrors openShiftsPanel from e2e/flows/shifts.test.js.
 */
async function openShiftsPanel(driver) {
  const shiftsOption = await waitForTestIdWithRetry(driver, 'fab-shifts-option', {
    retryAction: async () => {
      await tapTestId(driver, 'calendar-fab');
      await driver.pause(800);
    },
    timeout: 5000,
    retries: 2,
    retryDelay: 1500,
  });
  await shiftsOption.waitForDisplayed({ timeout: 5000 });
  await shiftsOption.click();
  await driver.pause(500);

  const addButton = await byTestId(driver, 'template-add');
  await addButton.waitForExist({ timeout: 5000 });
}

/**
 * Close the template panel reliably.
 * Mirrors closeTemplatePanel from e2e/flows/shifts.test.js but iOS-only
 * (we only screenshot on iOS for the App Store).
 */
async function closeTemplatePanel(driver) {
  try {
    const cancel = await byTestId(driver, 'inline-picker-cancel');
    if (await cancel.isExisting()) {
      await cancel.click();
      await driver.pause(600);
      return;
    }
  } catch { /* not found */ }

  try {
    const overlay = await byTestId(driver, 'template-panel-overlay');
    if (await overlay.isExisting()) {
      await overlay.click();
      await driver.pause(600);
      return;
    }
  } catch { /* not found */ }
}

/**
 * Ensure at least one shift template exists.
 * Caller must be on the Calendar tab with FAB visible.
 *
 * Idempotent: if a template exists, opens the panel to confirm and closes it.
 */
async function ensureTemplateExists(driver) {
  await tapTestId(driver, 'calendar-fab');
  await driver.pause(800);
  await openShiftsPanel(driver);

  const hasExisting = await existsTestId(driver, 'template-row-0');
  if (hasExisting) {
    console.log('  ✓ shift template already exists');
    await closeTemplatePanel(driver);
    return;
  }

  console.log(`  → creating shift template "${SHIFT_TEMPLATE_NAME}"`);
  const addButton = await byTestId(driver, 'template-add');
  await addButton.waitForDisplayed({ timeout: 5000 });
  await addButton.click();
  await driver.pause(500);

  const nameInput = await byTestId(driver, 'template-name-input');
  await nameInput.waitForExist({ timeout: 5000 });
  await nameInput.clearValue();
  await nameInput.setValue(SHIFT_TEMPLATE_NAME);
  await driver.pause(500);
  // Don't dismiss keyboard — Xcode 26's WDA broke 'return'/hideKeyboard and our
  // tap fallbacks risk closing the panel. The save button should be tappable
  // even with the keyboard visible (it sits above the keyboard).
  try {
    await tapTestId(driver, 'template-save', 5000);
    await driver.pause(1000);
  } catch (e) {
    // If save isn't tappable, the keyboard is likely covering it. Try tapping
    // by coordinate at the save button's expected position (above keyboard).
    const save = await byTestId(driver, 'template-save');
    if (await save.isExisting()) {
      try { await save.click(); } catch { /* ignore */ }
      await driver.pause(1000);
    }
  }
}

/**
 * Minimal seed: ensures location is configured AND a shift template exists.
 * Safe to call multiple times per locale — fast on re-runs.
 *
 * Caller must have already authenticated.
 */
async function ensureMinimalSeed(driver) {
  console.log('→ ensureMinimalSeed');
  await ensureCleanCalendarState(driver);
  await navigateToTab(driver, 'calendar');
  await driver.pause(500);
  await ensureTemplateExists(driver);
}

/**
 * TEST_MODE login flow for the post-2026-05-13 LoginScreen layout.
 * Assumes the driver is already on LoginScreen (email input visible).
 *
 * Inlined from performTestLogin minus the leading "tap login-button" step
 * (that step was the OLD WelcomeScreen's nav button; the new WelcomeScreen
 * uses email-signin-button instead, handled by the bridge step in
 * ensureAuthenticatedForScreenshots).
 */
async function doTestLoginOnLoginScreen(driver) {
  const emailInput = await byTestId(driver, 'email-input');
  await emailInput.waitForDisplayed({ timeout: 5000 });
  await emailInput.setValue('test@example.com');
  await dismissKeyboard(driver);

  await tapTestId(driver, 'send-code-button', 5000);
  await driver.pause(1500);
  await dismissNativeDialog(driver, ['OK']);
  await driver.pause(500);

  const codeInput = await byTestId(driver, 'code-input');
  await codeInput.waitForDisplayed({ timeout: 5000 });
  await codeInput.setValue('123456');
  await dismissKeyboard(driver);

  await tapTestId(driver, 'login-button', 5000);
  await driver.pause(3000);

  await dismissPermissionDialogs(driver);
}

/**
 * Authenticate, bridging the redesigned WelcomeScreen (post-2026-05-13).
 *
 * The shared e2e helper `ensureAuthenticated` looks for `login-button` on the
 * welcome screen — but the redesigned WelcomeScreen has `email-signin-button`
 * that navigates to LoginScreen (which has `login-button` as the final submit).
 */
async function ensureAuthenticatedForScreenshots(driver) {
  try {
    await driver.activateApp('com.openworkinghours.mobileapp');
  } catch { /* already foreground */ }

  if (await existsTestId(driver, 'tab-status')) {
    console.log('  ✓ already authenticated');
    return;
  }

  // If WelcomeScreen is visible, we're genuinely logged out — run auth flow.
  // Otherwise we may be authed but on a stack screen (Settings, LocationsList, etc.) —
  // try popping back via iOS's standard back-button hit area.
  if (!(await existsTestId(driver, 'email-signin-button'))) {
    console.log('  → tab-status not visible but no WelcomeScreen — popping stack');
    for (let i = 0; i < 6; i++) {
      try {
        await driver.action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: 40, y: 65 }).down().up().perform();
      } catch { break; }
      await driver.pause(400);
      if (await existsTestId(driver, 'tab-status')) {
        console.log('  ✓ recovered to tab root');
        return;
      }
    }
  }

  // Still no tab-status — full auth flow.
  if (await existsTestId(driver, 'email-signin-button')) {
    console.log('  → bridging WelcomeScreen → LoginScreen');
    await tapTestId(driver, 'email-signin-button', 5000);
    await driver.pause(800);
  }

  await doTestLoginOnLoginScreen(driver);
  await driver.pause(1000);

  if (!(await existsTestId(driver, 'tab-status'))) {
    throw new Error('Auth flow ran but tab-status still not visible');
  }
  console.log('  ✓ authenticated via TEST_MODE');
}

/**
 * Configure one work location, idempotently.
 * Uses TEST_MODE mock geocoding (returns "Charité Berlin" instantly).
 * Caller must already be authenticated.
 *
 * Pattern lifted from manual UI flow because the shared e2e helper's
 * completeLocationWizard (iOS branch) assumes add-workplace-button was already
 * tapped — which is a bug. This function handles the full flow.
 */
async function ensureOneLocation(driver) {
  console.log('→ ensureOneLocation');
  await navigateToTab(driver, 'status');
  await driver.pause(800);

  // If add-workplace-button is absent, a location already exists.
  if (!(await existsTestId(driver, 'add-workplace-button'))) {
    console.log('  ✓ location already configured');
    return;
  }

  console.log('  → tapping Add Workplace');
  await tapTestId(driver, 'add-workplace-button', 5000);
  await driver.pause(1500);

  // Setup screen step 1: search for location
  console.log('  → searching for location');
  const searchInput = await byTestId(driver, 'setup-search-input');
  await searchInput.waitForExist({ timeout: 8000 });
  await searchInput.setValue('Charité');
  await driver.pause(1500); // mock geocoding settles instantly but UI may debounce
  await dismissKeyboard(driver, 'key');

  // Tap first result
  const firstResult = await byTestId(driver, 'setup-search-result-0');
  await firstResult.waitForExist({ timeout: 5000 });
  await firstResult.click();
  await driver.pause(800);

  // Continue past step 1 (location confirmation + map)
  await tapTestId(driver, 'setup-continue-step1', 5000);
  await driver.pause(800);

  // Step 2: radius selection — accept default
  await tapTestId(driver, 'setup-continue-step2', 5000);
  await driver.pause(800);

  // Step 3: name + save
  // setup-name-input usually pre-fills with the location name; just save.
  await tapTestId(driver, 'setup-save-button', 5000);
  await driver.pause(2000);

  // Dismiss any post-save permission primers (notification, etc.)
  // The helper bundle has skipSetupPostSavePermissionPrimers but it's for the
  // wizard's own primer screens — easier to just dismiss & navigate back.
  for (let i = 0; i < 3; i++) {
    await dismissNativeDialog(driver, ['OK', 'Cancel', 'Don\'t Allow', 'Allow', 'Skip']);
    await driver.pause(400);
  }

  // Return to a sensible state
  await navigateToTab(driver, 'status');
  await driver.pause(500);

  console.log('  ✓ location configured');
}

/**
 * Place shifts on a few days of the current week so the status dashboard,
 * week view, and month view all look populated.
 *
 * Strategy:
 *   - Ensure template exists
 *   - Open Shifts panel via FAB
 *   - Tap template-row-0 → arms template AND places one shift on the currently
 *     focused date (typically today)
 *   - Then double-tap on adjacent past day columns to place additional shifts
 *
 * Idempotent-ish: re-running will add MORE shifts (no dedup yet). For our
 * use case (fresh-install screenshots), running once is fine. To make truly
 * idempotent, check `week-day-column-{date}-shifts` testID before placing.
 *
 * Caller must already be authenticated.
 */
async function placeShiftsOnCurrentWeek(driver) {
  console.log('→ placeShiftsOnCurrentWeek');
  await ensureCleanCalendarState(driver);
  await navigateToTab(driver, 'calendar');
  await driver.pause(500);

  await ensureTemplateExists(driver);
  await driver.pause(500);

  // Open Shifts picker
  await tapTestId(driver, 'calendar-fab');
  await driver.pause(800);
  await openShiftsPanel(driver);
  await driver.pause(500);

  // Tap template row — arms it and places one shift on the focused (today) date.
  await tapTestId(driver, 'template-row-0', 5000);
  await driver.pause(1500);

  // If the picker stayed open, close it.
  if (await existsTestId(driver, 'template-row-0')) {
    await closeTemplatePanel(driver);
  }
  await driver.pause(500);

  // With template armed, double-tap past day columns to place more shifts.
  const today = new Date();
  const offsets = [-1, -2]; // yesterday + 2 days ago
  let placed = 1; // we already placed one (on today)

  for (const offset of offsets) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateKey = d.toISOString().split('T')[0];
    const dayId = `week-day-column-${dateKey}`;

    if (!(await existsTestId(driver, dayId))) {
      console.log(`  ⚠ ${dayId} not visible in current week — skipping`);
      continue;
    }
    try {
      const col = await byTestId(driver, dayId);
      await col.click();
      await driver.pause(120);
      await col.click();
      await driver.pause(1500);
      placed++;
    } catch (e) {
      console.log(`  ⚠ couldn't double-tap ${dayId}: ${e.message}`);
    }
  }

  console.log(`  ✓ placed ${placed} shift(s)`);
}

module.exports = {
  ensureMinimalSeed,
  ensureTemplateExists,
  ensureAuthenticatedForScreenshots,
  ensureOneLocation,
  placeShiftsOnCurrentWeek,
  openShiftsPanel,
  closeTemplatePanel,
  SHIFT_TEMPLATE_NAME,
};
