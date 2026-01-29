/**
 * Absence Management E2E Test
 *
 * Tests absence template functionality:
 * - Open template panel via FAB → Absences
 * - Create a new absence template (vacation type)
 * - Save and verify persistence
 * - Close panel
 *
 * Note: Absence form uses separate testIDs from shift form:
 * - absence-name-input, absence-save, absence-cancel (added in rebuild)
 * - Falls back to text-based selectors on older builds
 *
 * Uses ensureAuthenticated() to handle auth state.
 */

const { createDriver, getPlatform } = require('../helpers/driver');
const { byTestId, byText, byI18nFast } = require('../helpers/selectors');
const {
  tapTestId,
  navigateToTab,
  ensureAuthenticated,
  waitForTestIdWithRetry,
  existsTestId,
} = require('../helpers/actions');

describe('Absence Management', () => {
  let driver;

  beforeAll(async () => {
    driver = await createDriver(getPlatform());
    await driver.pause(2000);
    await ensureAuthenticated(driver);
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

    const fab = await byTestId(driver, 'calendar-fab');
    await fab.waitForExist({ timeout: 5000 });
    expect(await fab.isExisting()).toBe(true);
  });

  test('should open FAB menu and tap Absences', async () => {
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(1500);

    const absOption = await waitForTestIdWithRetry(driver, 'fab-absences-option', {
      retryAction: async () => {
        await tapTestId(driver, 'calendar-fab');
        await driver.pause(2000);
      },
      timeout: 5000,
      retries: 2,
    });
    await absOption.click();
    await driver.pause(1500);

    // Verify absence panel opened — look for "+ New" button on absences tab
    const addButton = await byTestId(driver, 'absence-add');
    await addButton.waitForExist({ timeout: 5000 });
    expect(await addButton.isExisting()).toBe(true);
  });

  test('should create a new absence template', async () => {
    // Tap "+ New" to create absence template
    await tapTestId(driver, 'absence-add');
    await driver.pause(1000);

    // Verify edit mode — save button should appear
    // Try testID first (needs rebuild), fallback to text
    let saveFound = false;
    try {
      const saveButton = await byTestId(driver, 'absence-save');
      saveFound = await saveButton.isExisting();
    } catch { /* testID not available */ }

    if (!saveFound) {
      // Fallback: look for Save text button
      const saveText = await byI18nFast(driver, 'save');
      await saveText.waitForDisplayed({ timeout: 5000 });
      saveFound = await saveText.isDisplayed();
    }
    expect(saveFound).toBe(true);
  });

  test('should edit absence template name', async () => {
    // Try absence-specific testID first, fallback to generic
    let nameInput;
    const hasAbsenceInput = await existsTestId(driver, 'absence-name-input');
    if (hasAbsenceInput) {
      nameInput = await byTestId(driver, 'absence-name-input');
    } else {
      // Fallback: find the text input by looking for placeholder text
      nameInput = await byTestId(driver, 'template-name-input');
      if (!(await nameInput.isExisting())) {
        // Last resort: find by text type
        if (driver.isIOS) {
          nameInput = await driver.$('-ios class chain:**/XCUIElementTypeTextField');
        } else {
          nameInput = await driver.$('android=new UiSelector().className("android.widget.EditText")');
        }
      }
    }

    await nameInput.waitForExist({ timeout: 5000 });
    await nameInput.clearValue();
    await nameInput.setValue('Test Vacation');
    await driver.pause(300);

    if (driver.isAndroid) {
      try { await driver.hideKeyboard(); } catch { /* ignore */ }
    }

    const value = driver.isAndroid ? await nameInput.getText() : await nameInput.getValue();
    expect(value).toContain('Test');
  });

  test('should save absence template', async () => {
    // Try testID first, fallback to text
    const hasTestId = await existsTestId(driver, 'absence-save');
    if (hasTestId) {
      await tapTestId(driver, 'absence-save');
    } else {
      // Fallback: tap Save by text
      const saveText = await byI18nFast(driver, 'save');
      await saveText.waitForDisplayed({ timeout: 5000 });
      await saveText.click();
    }
    await driver.pause(500);
  });

  test('should verify absence template persists', async () => {
    // Close panel first (save closes edit mode but panel stays open)
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

    // Navigate away and back, then reopen absence panel
    await navigateToTab(driver, 'status');
    await driver.pause(500);
    await navigateToTab(driver, 'calendar');
    await driver.pause(500);

    await tapTestId(driver, 'calendar-fab');
    await driver.pause(1500);

    const absOption = await waitForTestIdWithRetry(driver, 'fab-absences-option', {
      retryAction: async () => {
        await tapTestId(driver, 'calendar-fab');
        await driver.pause(2000);
      },
      timeout: 5000,
      retries: 2,
    });
    await absOption.click();
    await driver.pause(1500);

    // Verify a template row exists — try testID, fallback to text
    let found = false;
    const hasRow = await existsTestId(driver, 'absence-row-vacation-0');
    if (hasRow) {
      found = true;
    } else {
      // Fallback: look for the template name we created
      try {
        const templateText = await byText(driver, 'Test Vacation');
        found = await templateText.isExisting();
      } catch { /* not found */ }
    }
    expect(found).toBe(true);
  });

  test('should close absence panel', async () => {
    if (driver.isAndroid) {
      await driver.back();
    } else {
      // Tap overlay area above the panel
      await driver.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: 215, y: 200 })
        .down()
        .up()
        .perform();
    }
    await driver.pause(1000);

    const fab = await byTestId(driver, 'calendar-fab');
    await fab.waitForExist({ timeout: 5000 });
    expect(await fab.isExisting()).toBe(true);
  });

  test('should return to Status tab', async () => {
    await navigateToTab(driver, 'status');
    await driver.pause(500);

    const statusElement = await byI18nFast(driver, 'last14Days');
    expect(await statusElement.isDisplayed()).toBe(true);
  });
});
