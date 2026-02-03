/**
 * Auth Flow E2E Test
 *
 * Verifies the app is authenticated and the main UI is accessible:
 * - Tab bar visible (Status, Calendar, Settings)
 * - Navigation between tabs works
 *
 * Uses noReset: true (like all other suites) so it never wipes app state.
 * Uses ensureAuthenticated() — if not logged in, performs TEST_MODE login.
 */

const { createDriver, getPlatform } = require('../helpers/driver');
const {
  ensureAuthenticated,
  existsTestId,
  isAuthenticated,
  navigateToTab,
} = require('../helpers/actions');

describe('Auth Flow', () => {
  let driver;

  beforeAll(async () => {
    driver = await createDriver(getPlatform());
    await driver.pause(2000);

    // ensureAuthenticated handles activateApp, app-ready wait, and login
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

  test('should have access to the main app (tab bar visible)', async () => {
    const authenticated = await isAuthenticated(driver);
    expect(authenticated).toBe(true);
  });

  test('should display Status tab', async () => {
    const exists = await existsTestId(driver, 'tab-status');
    expect(exists).toBe(true);
  });

  test('should display Calendar tab', async () => {
    const exists = await existsTestId(driver, 'tab-calendar');
    expect(exists).toBe(true);
  });

  test('should display Settings tab', async () => {
    const exists = await existsTestId(driver, 'tab-settings');
    expect(exists).toBe(true);
  });

  test('should be able to navigate between tabs', async () => {
    await navigateToTab(driver, 'settings');
    await driver.pause(500);
    const settingsVisible = await existsTestId(driver, 'tab-settings');
    expect(settingsVisible).toBe(true);

    await navigateToTab(driver, 'status');
    await driver.pause(500);
    const statusVisible = await existsTestId(driver, 'tab-status');
    expect(statusVisible).toBe(true);
  });
});
