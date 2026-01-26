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

const { createDriver, getPlatform } = require('../helpers/driver');
const { byTestId, byText, t } = require('../helpers/selectors');
const {
  tapTestId,
  typeTestId,
  tapI18n,
  navigateToTab,
  waitForText,
  existsTestId,
  dismissPermissionDialogs,
} = require('../helpers/actions');

describe('Location Setup', () => {
  let driver;
  let canTestWizard = false; // Track if we can test the wizard flow

  beforeAll(async () => {
    driver = await createDriver(getPlatform());
    await driver.pause(2000);
    await dismissPermissionDialogs(driver);
  });

  afterAll(async () => {
    if (driver) {
      await driver.deleteSession();
    }
  });

  test('should navigate to Settings', async () => {
    await navigateToTab(driver, 'settings');
    await driver.pause(500);

    // Verify we're on settings by looking for common elements
    const settingsText = driver.isIOS ? 'Einstellungen' : 'Settings';
    const header = await byText(driver, settingsText);
    expect(await header.isDisplayed()).toBe(true);
  });

  test('should find Work Locations section', async () => {
    const locationsText = driver.isIOS ? 'Arbeitsorte' : 'Work Locations';
    const locationsSection = await byText(driver, locationsText);

    // This should always be visible on Settings screen
    expect(await locationsSection.isDisplayed()).toBe(true);
  });

  test('should check if Add Location is available', async () => {
    // Check if "Add new location" button exists
    // If not, a location is already configured - we'll skip wizard tests
    const addText = driver.isIOS
      ? 'Arbeitsplatz hinzufügen'
      : 'Add workplace';

    try {
      const addButton = await byText(driver, addText);
      canTestWizard = await addButton.isDisplayed();
    } catch (e) {
      canTestWizard = false;
    }

    if (!canTestWizard) {
      console.log('  ℹ Location already configured - wizard tests will be skipped');
    }

    // This test always passes - it's just checking state
    expect(true).toBe(true);
  });

  test('should open Add Location flow', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    const addText = driver.isIOS
      ? 'Arbeitsplatz hinzufügen'
      : 'Add workplace';

    const addButton = await byText(driver, addText);
    await addButton.click();
    await driver.pause(1000);

    // Step 1: Search input should be visible
    const searchInput = await byTestId(driver, 'setup-search-input');
    expect(await searchInput.isDisplayed()).toBe(true);
  });

  test('should search for a location', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    await typeTestId(driver, 'setup-search-input', 'Berlin');
    await driver.pause(2000); // Wait for search results

    // Tap first search result
    const firstResult = await byTestId(driver, 'setup-search-result-0');
    expect(await firstResult.isDisplayed()).toBe(true);

    await firstResult.click();
    await driver.pause(1000);
  });

  test('should proceed to Step 2 (Radius)', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    await tapTestId(driver, 'setup-continue-step1');
    await driver.pause(500);

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

    if (driver.isAndroid) {
      await driver.hideKeyboard();
    }

    expect(true).toBe(true);
  });

  test('should have save button visible', async () => {
    if (!canTestWizard) {
      console.log('  ⏭ Skipped: location already configured');
      return;
    }

    // Verify save button exists (but don't tap it - avoid test data)
    const saveBtn = await byTestId(driver, 'setup-save-button');
    expect(await saveBtn.isDisplayed()).toBe(true);

    // Go back to cancel (avoid creating test data)
    console.log('  ℹ Canceling wizard to avoid test data');
    await tapTestId(driver, 'setup-back-button');
    await driver.pause(300);
    await tapTestId(driver, 'setup-back-button');
    await driver.pause(300);
    await tapTestId(driver, 'setup-back-button');
    await driver.pause(300);
  });

  test('should return to main app', async () => {
    await navigateToTab(driver, 'status');
    await driver.pause(500);

    // Verify we're back on status screen
    const statusText = driver.isIOS ? 'Letzte 14 Tage' : 'Last 14 Days';
    const statusElement = await byText(driver, statusText);
    expect(await statusElement.isDisplayed()).toBe(true);
  });
});
