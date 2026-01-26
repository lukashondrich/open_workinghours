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
const { byTestId, byText, t } = require('../helpers/selectors');
const {
  tapTestId,
  tapI18n,
  navigateToTab,
  waitForTestId,
  dismissPermissionDialogs,
} = require('../helpers/actions');

describe('Calendar Navigation', () => {
  let driver;

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

  test('should navigate to Calendar tab', async () => {
    await navigateToTab(driver, 'calendar');

    // Verify we're on calendar screen by checking for FAB
    const fab = await byTestId(driver, 'calendar-fab');
    expect(await fab.isDisplayed()).toBe(true);
  });

  test('should open FAB menu', async () => {
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(500);

    // Check FAB menu options are visible
    const shiftsOption = await byTestId(driver, 'fab-shifts-option');
    expect(await shiftsOption.isDisplayed()).toBe(true);

    // Close FAB menu
    await tapTestId(driver, 'calendar-fab');
    await driver.pause(300);
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
    // Find and tap Month toggle
    const monthText = driver.isIOS ? 'Monat' : 'Month';
    const monthToggle = await byText(driver, monthText);
    await monthToggle.click();
    await driver.pause(500);

    // Verify month view is displayed (FAB should still be visible)
    const fab = await byTestId(driver, 'calendar-fab');
    expect(await fab.isDisplayed()).toBe(true);
  });

  test('should switch back to Week view', async () => {
    // Find and tap Week toggle
    const weekText = driver.isIOS ? 'Woche' : 'Week';
    const weekToggle = await byText(driver, weekText);
    await weekToggle.click();
    await driver.pause(500);
  });

  test('should navigate back to Status tab', async () => {
    await navigateToTab(driver, 'status');
    await driver.pause(500);

    // Verify we're on status screen
    const statusText = driver.isIOS ? 'Letzte 14 Tage' : 'Last 14 Days';
    const statusElement = await byText(driver, statusText);
    expect(await statusElement.isDisplayed()).toBe(true);
  });
});
