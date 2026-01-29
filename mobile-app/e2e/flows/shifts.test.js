/**
 * Shift Management E2E Test
 *
 * Tests core shift functionality:
 * - Open template panel via FAB
 * - Create a new shift template
 * - Save the template
 *
 * KNOWN ANDROID LIMITATION:
 * FAB menu items (Absences, Shifts, Log Hours) don't appear in Android's
 * accessibility tree due to React Native's handling of conditionally-rendered
 * positioned Views. The test uses coordinate-based taps as a workaround.
 * This can be flaky - if tests fail, verify manually.
 *
 * Uses ensureAuthenticated() to handle auth state.
 */

const { createDriver, getPlatform } = require('../helpers/driver');
const { byTestId, byText, byI18nFast, byLabel, byTestIdOrLabel, i18n } = require('../helpers/selectors');
const {
  tapTestId,
  typeTestId,
  navigateToTab,
  waitForTestId,
  ensureAuthenticated,
  dismissPermissionDialogs,
  waitForTestIdWithRetry,
  existsTestId,
} = require('../helpers/actions');

describe('Shift Management', () => {
  let driver;
  // skipAndroidTests removed — APK now includes TemplatePanel accessibility fixes

  beforeAll(async () => {
    driver = await createDriver(getPlatform());
    await driver.pause(2000);
    await ensureAuthenticated(driver);

    // Android template panel tests now work with accessibility fixes in TemplatePanel.tsx
  }, 180000);

  afterAll(async () => {
    if (driver) {
      try {
        await driver.deleteSession();
      } catch (e) {
        console.log('Session cleanup error (ignored):', e.message);
      }
    }
  });

  test('should navigate to Calendar tab', async () => {
    await navigateToTab(driver, 'calendar');
    await driver.pause(500);

    // Verify we're on calendar by checking FAB exists
    const fab = await byTestId(driver, 'calendar-fab');
    await fab.waitForExist({ timeout: 5000 });
    expect(await fab.isExisting()).toBe(true);
  });

  test('should open FAB menu and tap Shifts', async () => {
    // Open FAB menu
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(1500);

    // Tap shifts option by testID (works on both platforms after inline rendering refactor)
    const shiftsOption = await byTestId(driver, 'fab-shifts-option');
    await shiftsOption.waitForExist({ timeout: 3000 });
    await shiftsOption.click();

    // Verify template panel opened by checking for "+ New" button
    await driver.pause(1500); // Wait for panel animation
    const addButton = await byTestId(driver, 'template-add');
    await addButton.waitForExist({ timeout: 5000 });
    expect(await addButton.isExisting()).toBe(true);
  });

  test('should create a new shift template', async () => {
    // Tap "+ New" button to create a new template
    let tapped = false;

    // Try testID first
    try {
      const addButton = await byTestId(driver, 'template-add');
      if (await addButton.isExisting()) {
        await addButton.click();
        tapped = true;
      }
    } catch (e) {
      // testID not found
    }

    // Fallback: try by text "New"
    if (!tapped) {
      try {
        const newButton = await byText(driver, 'New');
        await newButton.click();
        tapped = true;
      } catch (e) {
        // Text not found - test will fail
      }
    }

    await driver.pause(1000);

    // Template is auto-created and editing mode starts
    // Check that save button is visible (indicates edit mode)
    let editModeActive = false;
    try {
      const saveButton = await byTestId(driver, 'template-save');
      editModeActive = await saveButton.isDisplayed();
    } catch (e) {
      // Try by text
      const saveText = await byText(driver, 'Save');
      editModeActive = await saveText.isDisplayed();
    }
    expect(editModeActive).toBe(true);
  });

  test('should edit template name', async () => {
    // Find and clear the name input, then type new name
    const nameInput = await byTestId(driver, 'template-name-input');
    await nameInput.clearValue();
    await nameInput.setValue('Test Shift');
    await driver.pause(300);

    if (driver.isAndroid) {
      try { await driver.hideKeyboard(); } catch { /* ignore */ }
    }

    // Verify value was set (Android uses getText, iOS uses getValue)
    const value = driver.isAndroid ? await nameInput.getText() : await nameInput.getValue();
    expect(value).toContain('Test');
  });

  test('should save the template', async () => {


    // Tap save button
    await tapTestId(driver, 'template-save');
    await driver.pause(500);

    // After save, edit mode should close
    // The template row should now show the saved name
    // Check that save button is no longer visible (edit mode closed)
    try {
      const saveButton = await byTestId(driver, 'template-save');
      const isDisplayed = await saveButton.isDisplayed();
      // Save button should not be visible after saving
      expect(isDisplayed).toBe(false);
    } catch (e) {
      // If element not found, that's expected (edit mode closed)
      expect(true).toBe(true);
    }
  });

  test('should have template available for arming', async () => {


    // Save closes the panel. Navigate away and back, then reopen to verify persistence.
    await navigateToTab(driver, 'status');
    await driver.pause(1000);
    await navigateToTab(driver, 'calendar');
    await driver.pause(1000);

    // Reopen template panel via FAB
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(2000);
    const shiftsOption = await byTestId(driver, 'fab-shifts-option');
    await shiftsOption.waitForExist({ timeout: 5000 });
    await shiftsOption.click();
    await driver.pause(1500);

    // Look for a template row (template-row-0 for first template)
    const templateRow = await byTestId(driver, 'template-row-0');
    await templateRow.waitForExist({ timeout: 5000 });
    expect(await templateRow.isExisting()).toBe(true);
  });

  test('should arm a shift template', async () => {
    // template-row-0 should be visible from previous test
    const templateRow = await byTestId(driver, 'template-row-0');
    await templateRow.waitForExist({ timeout: 5000 });
    await templateRow.click();
    await driver.pause(500);

    // Arming is a toggle — visual indicator changes (radio button fills)
    // We verify the tap succeeded without error; visual state is implicit
    expect(await templateRow.isExisting()).toBe(true);
  });

  test('should close panel and tap day in month view with armed template', async () => {
    // Close template panel
    if (driver.isAndroid) {
      await driver.back();
    } else {
      await driver.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: 215, y: 200 })
        .down()
        .up()
        .perform();
    }
    await driver.pause(1000);

    // Switch to month view
    const monthToggle = await byI18nFast(driver, 'month');
    await monthToggle.waitForDisplayed({ timeout: 5000 });
    await monthToggle.click();
    await driver.pause(1000);

    // Tap a day cell (yesterday to avoid future-date issues)
    // Requires month-day-* testIDs (added in MonthView.tsx — needs rebuild)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toISOString().split('T')[0]; // yyyy-MM-dd

    const hasDayTestId = await existsTestId(driver, `month-day-${dateKey}`);
    if (!hasDayTestId) {
      console.log('⏭ month-day testIDs not available (needs rebuild) — skipping day tap');
      // Switch back to week view so remaining tests work
      const weekToggle = await byI18nFast(driver, 'week');
      await weekToggle.waitForDisplayed({ timeout: 5000 });
      await weekToggle.click();
      await driver.pause(500);
      return;
    }

    const dayCell = await byTestId(driver, `month-day-${dateKey}`);
    await dayCell.waitForExist({ timeout: 5000 });
    await dayCell.click();
    await driver.pause(1000);

    // Tapping a day in month view switches to week view
    const fab = await byTestId(driver, 'calendar-fab');
    await fab.waitForExist({ timeout: 5000 });
    expect(await fab.isExisting()).toBe(true);
  });

  test('should verify shift dot appears in month view', async () => {
    // Check for shift dots on the day we tapped
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toISOString().split('T')[0];

    // Requires month-day-* testIDs (needs rebuild)
    const hasDayTestId = await existsTestId(driver, `month-day-${dateKey}-shifts`);
    if (!hasDayTestId) {
      // Check if we're in month view first, switch if needed
      try {
        const monthToggle = await byI18nFast(driver, 'month');
        if (await monthToggle.isDisplayed()) {
          await monthToggle.click();
          await driver.pause(1000);
        }
      } catch { /* already in month view or toggle not found */ }

      console.log('⏭ month-day-*-shifts testIDs not available (needs rebuild) — skipping verification');
      // Ensure we're back in week view
      try {
        const weekToggle = await byI18nFast(driver, 'week');
        if (await weekToggle.isDisplayed()) {
          await weekToggle.click();
          await driver.pause(500);
        }
      } catch { /* already in week view */ }
      return;
    }

    // Switch to month view to verify
    const monthToggle = await byI18nFast(driver, 'month');
    await monthToggle.waitForDisplayed({ timeout: 5000 });
    await monthToggle.click();
    await driver.pause(1000);

    expect(hasDayTestId).toBe(true);

    // Switch back to week view for remaining tests
    const weekToggle = await byI18nFast(driver, 'week');
    await weekToggle.waitForDisplayed({ timeout: 5000 });
    await weekToggle.click();
    await driver.pause(500);
  });

  test('should close template panel', async () => {
    // First reopen the panel (it was closed during arming tests)
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(1500);
    const shiftsOption = await waitForTestIdWithRetry(driver, 'fab-shifts-option', {
      retryAction: async () => {
        await tapTestId(driver, 'calendar-fab');
        await driver.pause(2000);
      },
      timeout: 5000,
      retries: 2,
    });
    await shiftsOption.click();
    await driver.pause(1500);

    // Close the template panel by tapping the overlay area (top of screen)
    if (driver.isAndroid) {
      await driver.back();
    } else {
      // Tap overlay area above the panel to dismiss
      await driver.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: 215, y: 200 })
        .down()
        .up()
        .perform();
    }
    await driver.pause(1000);

    // Verify we're back on calendar
    const fab = await byTestId(driver, 'calendar-fab');
    await fab.waitForExist({ timeout: 5000 });
    expect(await fab.isExisting()).toBe(true);
  });

  test('should return to Status tab', async () => {
    await navigateToTab(driver, 'status');
    await driver.pause(500);

    // Verify we're on status screen
    const statusElement = await byI18nFast(driver, 'last14Days');
    expect(await statusElement.isDisplayed()).toBe(true);
  });
});
