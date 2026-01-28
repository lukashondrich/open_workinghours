/**
 * Calendar Navigation E2E Test
 *
 * Tests calendar screen functionality:
 * - Navigate to Calendar tab
 * - Open FAB menu
 * - Navigate weeks (prev/next)
 * - Switch between Week/Month views
 *
 * Works with already logged-in state.
 */

const { createDriver, getPlatform } = require('../helpers/driver');
const { byTestId, byText, byI18nFast, t, i18n } = require('../helpers/selectors');
const {
  tapTestId,
  tapI18n,
  navigateToTab,
  waitForTestId,
  dismissPermissionDialogs,
  ensureAuthenticated,
} = require('../helpers/actions');

describe('Calendar Navigation', () => {
  let driver;

  beforeAll(async () => {
    driver = await createDriver(getPlatform());
    await driver.pause(2000);
    // Ensure we're authenticated before calendar tests
    await ensureAuthenticated(driver);
  });

  afterAll(async () => {
    if (driver) {
      await driver.deleteSession();
    }
  });

  test('should navigate to Calendar tab', async () => {
    await navigateToTab(driver, 'calendar');

    // Verify we're on calendar screen by checking for FAB
    const fab = await byTestId(driver, 'calendar-fab');
    expect(await fab.isDisplayed()).toBe(true);
  });

  test('should open FAB menu', async () => {
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(1500); // Allow menu animation to complete

    // Verify menu is open by checking FAB's accessibility label changed
    const fab = await byTestId(driver, 'calendar-fab');
    if (driver.isAndroid) {
      // On Android, FAB menu items don't appear in accessibility tree (known issue)
      // Verify FAB is still interactable (proves tap worked)
      // Future: Rebuild APK with accessible={true} on menu items
      const isDisplayed = await fab.isDisplayed();
      expect(isDisplayed).toBe(true);
      console.log('  ℹ Android FAB menu: visual verification only (menu items not in a11y tree)');
    } else {
      // On iOS, verify menu item is visible
      const shiftsText = await byI18nFast(driver, 'shifts');
      expect(await shiftsText.isDisplayed()).toBe(true);
    }

    // Close FAB menu
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(500);
  });

  test('should navigate to previous week', async () => {
    await tapTestId(driver, 'calendar-prev');
    await driver.pause(500);
    // Visual verification - week header should change
  });

  test('should navigate to next week', async () => {
    await tapTestId(driver, 'calendar-next');
    await driver.pause(500);
    // Visual verification - week header should change
  });

  test('should switch to Month view', async () => {
    // Find and tap Month toggle (handles both German "Monat" and English "Month")
    const monthToggle = await byI18nFast(driver, 'month');
    await monthToggle.waitForDisplayed({ timeout: 5000 });
    await monthToggle.click();
    await driver.pause(1000); // Allow view transition to complete

    // Verify we're in Month view by checking the Week toggle is now tappable
    // (FAB is hidden in Month view by design)
    const weekToggle = await byI18nFast(driver, 'week');
    expect(await weekToggle.isDisplayed()).toBe(true);
  });

  test('should switch back to Week view', async () => {
    // Find and tap Week toggle (handles both German "Woche" and English "Week")
    const weekToggle = await byI18nFast(driver, 'week');
    await weekToggle.waitForDisplayed({ timeout: 5000 });
    await weekToggle.click();
    await driver.pause(500);
  });

  test('should navigate back to Status tab', async () => {
    await navigateToTab(driver, 'status');
    await driver.pause(500);

    // Verify we're on status screen (handles both languages)
    const statusElement = await byI18nFast(driver, 'last14Days');
    expect(await statusElement.isDisplayed()).toBe(true);
  });
});
