/**
 * Location Setup E2E Test
 *
 * Tests the location setup wizard:
 * 1. Navigate to Settings
 * 2. Open "Add location" flow
 * 3. Search for location
 * 4. Adjust radius
 * 5. Name the location
 * 6. Verify save button (don't save to avoid test data)
 *
 * Note: Tests are designed to handle variable app state.
 * If a location is already configured, wizard tests are skipped.
 */

const { execSync } = require('child_process');
const { createDriver, getPlatform } = require('../helpers/driver');
const { byTestId, byText, byI18nFast, t, i18n } = require('../helpers/selectors');
const {
  tapTestId,
  typeTestId,
  tapI18n,
  navigateToSettings,
  navigateToTab,
  waitForText,
  existsTestId,
  scrollToTestId,
  dismissPermissionDialogs,
  dismissNativeDialog,
  ensureAuthenticated,
  dismissKeyboard,
  advancePastSetupForegroundPrimer,
} = require('../helpers/actions');

describe('Location Setup', () => {
  let driver;
  let canTestWizard = false; // Track if we can test the wizard flow
  let canTestSearch = false; // False when hospital pre-population skips the search step

  beforeAll(async () => {
    // Android: enable high-accuracy location mode BEFORE the wizard's map
    // opens. Otherwise Google Play Services shows a "Location Accuracy"
    // dialog in a separate system window that UiAutomator2 cannot see or
    // dismiss — hierarchy queries then hang until the jest timeout.
    if (getPlatform() === 'android') {
      try {
        execSync('adb shell settings put secure location_mode 3 2>/dev/null');
      } catch { /* adb unavailable — dialog handling below is best-effort */ }
    }

    driver = await createDriver(getPlatform());
    await driver.pause(2000);
    // Ensure we're authenticated before location tests
    await ensureAuthenticated(driver);
  }, 180000); // Increase timeout to 3 minutes for Android

  afterAll(async () => {
    if (driver) {
      try {
        await driver.deleteSession();
      } catch (e) {
        console.log('Session cleanup error (ignored):', e.message);
      }
    }
  });

  test('should navigate to Settings', async () => {
    await navigateToSettings(driver);
    await driver.pause(500);

    // Verify we're on settings by looking for sign-out button
    const signOutExists = await existsTestId(driver, 'sign-out-button');
    expect(signOutExists).toBe(true);
  });

  test('should find Work Locations section', async () => {
    const locationsSection = await byI18nFast(driver, 'workLocations');

    // This should always be visible on Settings screen
    expect(await locationsSection.isDisplayed()).toBe(true);
  });

  test('should check if Add Location is available', async () => {
    // The add button lives on the LocationsList screen (Settings → Work
    // Locations), not on Settings itself — navigate into it first.
    // If the button is missing (max locations reached), skip wizard tests.
    try {
      const workLocationsRow = await byI18nFast(driver, 'workLocations');
      await workLocationsRow.waitForDisplayed({ timeout: 5000 });
      await workLocationsRow.click();
      await driver.pause(1000);

      const addButton = await byI18nFast(driver, 'addLocation');
      await addButton.waitForDisplayed({ timeout: 5000 });
      canTestWizard = await addButton.isDisplayed();
    } catch (e) {
      canTestWizard = false;
    }

    if (!canTestWizard) {
      console.log('  ℹ Add Location not available (max reached?) - wizard tests will be skipped');
    }

    // This test always passes - it's just checking state
    expect(true).toBe(true);
  });

  test('should open Add Location flow', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    const addButton = await byI18nFast(driver, 'addLocation');
    await addButton.click();
    await driver.pause(driver.isAndroid ? 3000 : 1000);
    await advancePastSetupForegroundPrimer(driver);

    // Dismiss GPS/location dialogs that may appear on Android after map loads
    await dismissPermissionDialogs(driver);
    for (let i = 0; i < 3; i++) {
      const dismissed = await dismissNativeDialog(driver, ['OK']);
      if (!dismissed) break;
      await driver.pause(500);
    }

    // The wizard starts at Step 1 (search) for users without a known hospital,
    // or directly at Step 2 (radius) when hospital pre-population placed the
    // pin (v2.1.2). The TEST_MODE mock user has hospitalRefId 6 → Step 2.
    canTestSearch = await existsTestId(driver, 'setup-search-input');
    const onRadiusStep = await existsTestId(driver, 'setup-continue-step2');
    if (!canTestSearch) {
      console.log('  ℹ Wizard opened at Step 2 (hospital pre-population) - search tests will be skipped');
    }
    expect(canTestSearch || onRadiusStep).toBe(true);
  });

  test('should search for a location', async () => {
    if (!canTestWizard || !canTestSearch) {
      console.log('  ⏭ Skipped: wizard unavailable or search step skipped');
      return;
    }

    await typeTestId(driver, 'setup-search-input', 'Berlin');

    // Wait for geocoding results — Photon API can be slow on Android emulators
    const firstResult = await byTestId(driver, 'setup-search-result-0');
    await firstResult.waitForDisplayed({ timeout: 15000 });
    expect(await firstResult.isDisplayed()).toBe(true);

    await firstResult.click();
    await driver.pause(1000);
  });

  test('should proceed to Step 2 (Radius)', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    if (canTestSearch) {
      await tapTestId(driver, 'setup-continue-step1');
      await driver.pause(500);
    } // else: already on Step 2 (hospital pre-population)

    // Verify radius controls are visible
    const decreaseBtn = await byTestId(driver, 'setup-radius-decrease');
    expect(await decreaseBtn.isDisplayed()).toBe(true);
  });

  test('should adjust radius', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    // Increase radius
    await tapTestId(driver, 'setup-radius-increase');
    await driver.pause(300);

    // Decrease radius
    await tapTestId(driver, 'setup-radius-decrease');
    await driver.pause(300);

    // If we got here without errors, radius controls work
    expect(true).toBe(true);
  });

  test('should proceed to Step 3 (Name)', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    await tapTestId(driver, 'setup-continue-step2');
    await driver.pause(500);

    // Verify name input is visible
    const nameInput = await byTestId(driver, 'setup-name-input');
    expect(await nameInput.isDisplayed()).toBe(true);
  });

  test('should enter location name', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    await typeTestId(driver, 'setup-name-input', 'Test Hospital');
    await driver.pause(500);

    // Android: keep the keyboard up — hideKeyboard() presses Back and pops
    // the wizard screen (see completeLocationWizard). adjustResize keeps the
    // save button reachable regardless.
    if (!driver.isAndroid) {
      await dismissKeyboard(driver);
    }

    expect(true).toBe(true);
  });

  test('should have save button visible', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    // Verify save button exists (but don't tap it - avoid test data).
    // Android: scroll it into view first — below-the-fold elements aren't in
    // the UiAutomator tree at all.
    const found = await scrollToTestId(driver, 'setup-save-button');
    expect(found).toBe(true);

    // Go back to cancel (avoid creating test data).
    // setup-back-button only exists for steps 3→2 and 2→1 (step 1 has no
    // in-wizard back button); the stack unwind happens in the next test.
    console.log('  ℹ Canceling wizard to avoid test data');
    await tapTestId(driver, 'setup-back-button');
    await driver.pause(300);
    await tapTestId(driver, 'setup-back-button');
    await driver.pause(300);
  });

  test('should return to main app', async () => {
    // We may be several stack screens deep (Setup → LocationsList → Settings).
    // Unwind until the tab bar is visible: nav-back coordinate tap on iOS
    // (native header back has no testID), hardware back on Android.
    for (let i = 0; i < 5; i++) {
      const hasTabBar = await existsTestId(driver, 'tab-status');
      if (hasTabBar) break;
      if (driver.isIOS) {
        try {
          await driver.action('pointer', { parameters: { pointerType: 'touch' } })
            .move({ x: 40, y: 65 }).down().up().perform();
        } catch { /* ignore */ }
      } else {
        try { await driver.back(); } catch { /* ignore */ }
      }
      await driver.pause(700);
    }

    await navigateToTab(driver, 'status');
    await driver.pause(500);

    // Verify we're back on status screen (bilingual)
    const statusElement = await byI18nFast(driver, 'last14Days');
    expect(await statusElement.isDisplayed()).toBe(true);
  });
});
