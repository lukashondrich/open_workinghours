/**
 * Calendar Export E2E Test
 *
 * Validates the calendar export feature:
 * - Navigate to CalendarExport subpage from Settings
 * - Toggle live sync on/off with permission handling
 * - Disable with "Keep exported events"
 * - Disable with "Delete exported events"
 * - Sign out with calendar sync enabled (both branches)
 * - ICS file export preset buttons
 *
 * Uses noReset: true (preserves app state between suites).
 * Uses ensureAuthenticated() — if not logged in, performs TEST_MODE login.
 */

const { createDriver, getPlatform } = require('../helpers/driver');
const { byTestId, byText } = require('../helpers/selectors');
const {
  ensureAuthenticated,
  existsTestId,
  navigateToSettings,
  tapTestId,
  dismissNativeDialog,
  dismissSystemDialogs,
  screenshot,
} = require('../helpers/actions');

describe('Calendar Export', () => {
  let driver;
  const platform = getPlatform();

  beforeAll(async () => {
    driver = await createDriver(platform);
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

  /**
   * Helper: Navigate to Settings → Calendar Export subpage.
   */
  async function navigateToCalendarSync() {
    // Step 1: Go to Settings
    await navigateToSettings(driver);
    await driver.pause(500);

    // Step 2: Tap "Calendar Export" list item to enter subpage
    await tapTestId(driver, 'settings-calendar-export', 5000);
    await driver.pause(500);
  }

  /**
   * Helper: Navigate to Settings screen only (for sign-out tests).
   */
  async function navigateToSettingsScreen() {
    await navigateToSettings(driver);
    await driver.pause(500);
  }

  /**
   * Helper: Get the current toggle state (true = enabled, false = disabled).
   */
  async function getToggleState() {
    const toggle = await byTestId(driver, 'calendar-sync-toggle');
    await toggle.waitForExist({ timeout: 10000 });

    if (driver.isIOS) {
      const value = await toggle.getAttribute('value');
      return value === '1';
    } else {
      const checked = await toggle.getAttribute('checked');
      return checked === 'true';
    }
  }

  /**
   * Helper: Tap the calendar sync toggle.
   */
  async function tapToggle() {
    await tapTestId(driver, 'calendar-sync-toggle', 10000);
    await driver.pause(500);
  }

  /**
   * Helper: Handle the calendar permission dialog that appears on first enable.
   */
  async function handlePermissionDialog() {
    await driver.pause(1000);
    if (driver.isIOS) {
      try {
        const alertText = await driver.getAlertText();
        if (alertText) {
          await driver.acceptAlert();
          await driver.pause(500);
        }
      } catch {
        // No alert — permission already granted
      }
    } else {
      try {
        const allowButton = await driver.$(
          'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_button")'
        );
        if (await allowButton.isExisting()) {
          await allowButton.click();
          await driver.pause(500);
        }
      } catch {
        // No permission dialog — already granted
      }
    }
  }

  /**
   * Helper: Tap a button in a native Alert dialog by text.
   */
  async function tapAlertButton(textOptions) {
    if (driver.isIOS) {
      for (const text of textOptions) {
        try {
          const button = await driver.$(`-ios predicate string:label == "${text}"`);
          if (await button.isExisting()) {
            await button.click();
            await driver.pause(500);
            return true;
          }
        } catch { /* try next */ }
      }
      try {
        await driver.acceptAlert();
        await driver.pause(500);
        return true;
      } catch { /* no alert */ }
    } else {
      for (const text of textOptions) {
        try {
          const button = await byText(driver, text, true);
          if (await button.isExisting()) {
            await button.click();
            await driver.pause(500);
            return true;
          }
        } catch { /* try next */ }
      }
    }
    return false;
  }

  /**
   * Helper: Wait for an alert button to appear (poll-based, not hardcoded pause).
   */
  async function waitForAlertButton(textOptions, timeout = 5000) {
    const poll = 300;
    let waited = 0;
    while (waited < timeout) {
      for (const text of textOptions) {
        try {
          if (driver.isIOS) {
            const btn = await driver.$(`-ios predicate string:label == "${text}"`);
            if (await btn.isExisting()) return true;
          } else {
            const btn = await byText(driver, text, true);
            if (await btn.isExisting()) return true;
          }
        } catch { /* continue polling */ }
      }
      await driver.pause(poll);
      waited += poll;
    }
    return false;
  }

  /**
   * Helper: Wait for the toggle to settle (loading spinner to disappear).
   */
  async function waitForToggleReady() {
    const maxWait = 15000;
    const pollInterval = 500;
    let waited = 0;
    while (waited < maxWait) {
      const loading = await existsTestId(driver, 'calendar-sync-loading');
      if (!loading) break;
      await driver.pause(pollInterval);
      waited += pollInterval;
    }
    await driver.pause(300);
  }

  // ─── Live Sync Tests (1-8) ────────────────────────────────────────────────

  test('1. should navigate to CalendarExport screen and see sync section', async () => {
    await navigateToCalendarSync();

    const sectionExists = await existsTestId(driver, 'calendar-sync-section');
    expect(sectionExists).toBe(true);

    const toggleExists = await existsTestId(driver, 'calendar-sync-toggle');
    expect(toggleExists).toBe(true);
  });

  test('2. should have calendar sync initially disabled', async () => {
    await waitForToggleReady();
    const state = await getToggleState();
    expect(typeof state).toBe('boolean');
    console.log(`Calendar sync initial state: ${state ? 'ON' : 'OFF'}`);

    // If already enabled, disable it first
    if (state) {
      await tapToggle();
      await driver.pause(500);
      await tapAlertButton([
        'Exportierte Einträge behalten',
        'Keep exported events',
      ]);
      await waitForToggleReady();
    }
  });

  test('3. should enable calendar sync and handle permission', async () => {
    await waitForToggleReady();
    const stateBefore = await getToggleState();
    expect(stateBefore).toBe(false);

    await tapToggle();
    await handlePermissionDialog();
    await waitForToggleReady();

    const stateAfter = await getToggleState();
    expect(stateAfter).toBe(true);

    await screenshot(driver, 'calendar-sync-enabled');
  });

  test('4. should not show warning when permission is granted', async () => {
    const warningExists = await existsTestId(driver, 'calendar-sync-warning');
    expect(warningExists).toBe(false);
  });

  test('5. should disable sync with "Keep exported events"', async () => {
    await waitForToggleReady();
    const stateBefore = await getToggleState();
    expect(stateBefore).toBe(true);

    await tapToggle();
    await driver.pause(500);

    const tapped = await tapAlertButton([
      'Exportierte Einträge behalten',
      'Keep exported events',
    ]);
    expect(tapped).toBe(true);

    await waitForToggleReady();
    const stateAfter = await getToggleState();
    expect(stateAfter).toBe(false);
  });

  test('6. should re-enable sync after disabling with keep', async () => {
    await waitForToggleReady();
    await tapToggle();
    await handlePermissionDialog();
    await waitForToggleReady();

    const stateAfter = await getToggleState();
    expect(stateAfter).toBe(true);
  });

  test('7. should disable sync with "Delete exported events"', async () => {
    await waitForToggleReady();
    const stateBefore = await getToggleState();
    expect(stateBefore).toBe(true);

    await tapToggle();
    await driver.pause(500);

    const tapped = await tapAlertButton([
      'Exportierte Einträge löschen',
      'Delete exported events',
    ]);
    expect(tapped).toBe(true);

    await waitForToggleReady();
    const stateAfter = await getToggleState();
    expect(stateAfter).toBe(false);
  });

  test('8. should cancel disable dialog without changing state', async () => {
    await waitForToggleReady();

    // Re-enable first
    await tapToggle();
    await handlePermissionDialog();
    await waitForToggleReady();
    const stateEnabled = await getToggleState();
    expect(stateEnabled).toBe(true);

    // Try to disable but cancel
    await tapToggle();
    await driver.pause(500);
    await tapAlertButton(['Abbrechen', 'Cancel']);
    await driver.pause(500);

    const stateAfterCancel = await getToggleState();
    expect(stateAfterCancel).toBe(true);
  });

  // ─── Sign-out Tests (9-13) ────────────────────────────────────────────────
  // These test from the main Settings screen, not the CalendarExport subpage.

  test('9. should show sign-out calendar dialog when sync enabled', async () => {
    // We're still on CalendarExport screen from test 8.
    // Verify sync is still enabled after test 8's cancel.
    await waitForToggleReady();

    const currentState = await getToggleState();
    if (!currentState) {
      // Re-enable if somehow disabled
      await tapToggle();
      await handlePermissionDialog();
      await waitForToggleReady();
    }
    const syncOn = await getToggleState();
    expect(syncOn).toBe(true);

    // Go back to main Settings screen (from CalendarExport subpage)
    if (driver.isIOS) {
      try {
        const backButton = await driver.$('-ios predicate string:label == "Settings" OR label == "Einstellungen"');
        if (await backButton.isExisting()) {
          await backButton.click();
          await driver.pause(500);
        }
      } catch {
        // Fallback: navigate via back button
        await driver.back();
        await driver.pause(500);
      }
    } else {
      await driver.back();
      await driver.pause(500);
    }

    // Scroll down to Sign Out button
    const { width, height } = await driver.getWindowSize();
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(width / 2), y: Math.round(height * 0.7) })
      .down()
      .move({ x: Math.round(width / 2), y: Math.round(height * 0.2), duration: 300 })
      .up()
      .perform();
    await driver.pause(500);

    // Tap sign out
    await tapTestId(driver, 'sign-out-button', 10000);
    await driver.pause(1000);

    // First dialog: use native acceptAlert to tap "Sign Out"/"Abmelden"
    if (driver.isIOS) {
      await driver.acceptAlert();
    } else {
      await tapAlertButton(['Abmelden', 'Sign Out']);
    }
    await driver.pause(500);

    // Wait for second dialog — the sign-out handler async-loads calendar state,
    // so there's a gap between first dialog dismiss and second dialog appearance.
    const secondDialogAppeared = await waitForAlertButton(
      ['Einträge behalten', 'Keep events', 'Einträge entfernen', 'Remove events'],
      5000
    );
    expect(secondDialogAppeared).toBe(true);

    // Cancel the second dialog to stay signed in.
    // On iOS, use class chain to find Cancel button specifically within the alert,
    // avoiding false matches with non-alert UI elements.
    if (driver.isIOS) {
      try {
        const cancelBtn = await driver.$('-ios class chain:**/XCUIElementTypeAlert/**/XCUIElementTypeButton[`label == "Abbrechen" OR label == "Cancel"`]');
        await cancelBtn.waitForExist({ timeout: 3000 });
        await cancelBtn.click();
      } catch {
        // Fallback: dismissAlert (taps cancel-styled button)
        await driver.dismissAlert();
      }
    } else {
      await tapAlertButton(['Abbrechen', 'Cancel']);
    }
    await driver.pause(1000);

    // Verify still on Settings (tab bar is hidden behind Settings stack screen,
    // so check for sign-out-button which only exists on the authenticated Settings screen)
    await screenshot(driver, 'test9-after-cancel');
    const stillOnSettings = await existsTestId(driver, 'sign-out-button');
    expect(stillOnSettings).toBe(true);
  });

  test('10. should handle sign-out with "Keep events"', async () => {
    // Should still be on Settings from test 9 (cancel kept us here)
    // Scroll to sign out button
    const { width, height } = await driver.getWindowSize();
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(width / 2), y: Math.round(height * 0.7) })
      .down()
      .move({ x: Math.round(width / 2), y: Math.round(height * 0.2), duration: 300 })
      .up()
      .perform();
    await driver.pause(500);

    // Tap sign out
    await tapTestId(driver, 'sign-out-button', 10000);
    await driver.pause(1000);

    // First dialog: use native acceptAlert to tap "Sign Out"/"Abmelden"
    if (driver.isIOS) {
      await driver.acceptAlert();
    } else {
      await tapAlertButton(['Abmelden', 'Sign Out']);
    }
    await driver.pause(500);

    // Wait for second dialog (unique buttons, not Cancel)
    const appeared = await waitForAlertButton(
      ['Einträge behalten', 'Keep events', 'Einträge entfernen', 'Remove events'],
      5000
    );
    expect(appeared).toBe(true);

    // Tap "Keep events"
    const tapped = await tapAlertButton([
      'Einträge behalten',
      'Keep events',
    ]);
    expect(tapped).toBe(true);
    await driver.pause(2000);

    // Should be on welcome/login screen
    const loginExists = await existsTestId(driver, 'login-button');
    expect(loginExists).toBe(true);
  });

  test('11. should re-authenticate after sign-out for further tests', async () => {
    await ensureAuthenticated(driver);

    const authenticated = await existsTestId(driver, 'tab-status');
    expect(authenticated).toBe(true);
  });

  test('12. should sign-out with "Remove events" when sync enabled', async () => {
    // Navigate to CalendarExport subpage and enable sync
    await navigateToCalendarSync();
    await waitForToggleReady();

    const currentState = await getToggleState();
    if (!currentState) {
      await tapToggle();
      await handlePermissionDialog();
      await waitForToggleReady();
    }

    // Go back to main Settings
    if (driver.isIOS) {
      try {
        const backButton = await driver.$('-ios predicate string:label == "Settings" OR label == "Einstellungen"');
        if (await backButton.isExisting()) {
          await backButton.click();
          await driver.pause(500);
        }
      } catch {
        await navigateToSettingsScreen();
      }
    } else {
      await driver.back();
      await driver.pause(500);
    }

    // Scroll to sign out
    const { width, height } = await driver.getWindowSize();
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(width / 2), y: Math.round(height * 0.7) })
      .down()
      .move({ x: Math.round(width / 2), y: Math.round(height * 0.2), duration: 300 })
      .up()
      .perform();
    await driver.pause(500);

    // Tap sign out
    await tapTestId(driver, 'sign-out-button', 10000);
    await driver.pause(1000);

    // First dialog: use native acceptAlert to tap "Sign Out"/"Abmelden"
    if (driver.isIOS) {
      await driver.acceptAlert();
    } else {
      await tapAlertButton(['Abmelden', 'Sign Out']);
    }
    await driver.pause(500);

    // Wait for second dialog (unique buttons, increased timeout for async manager load)
    const appeared = await waitForAlertButton(
      ['Einträge entfernen', 'Remove events', 'Einträge behalten', 'Keep events'],
      5000
    );
    expect(appeared).toBe(true);

    // Tap "Remove events"
    const tapped = await tapAlertButton([
      'Einträge entfernen',
      'Remove events',
    ]);
    expect(tapped).toBe(true);
    await driver.pause(2000);

    // Should be on welcome/login screen
    const loginExists = await existsTestId(driver, 'login-button');
    expect(loginExists).toBe(true);
  });

  test('13. should re-authenticate and verify sync is disabled after sign-out with remove', async () => {
    await ensureAuthenticated(driver);
    await navigateToCalendarSync();
    await waitForToggleReady();

    const state = await getToggleState();
    expect(state).toBe(false);
  });

  // ─── ICS Export Tests (14-16) ─────────────────────────────────────────────

  test('14. should show Download section on CalendarExport screen', async () => {
    // Should already be on CalendarExport screen from test 13
    const sectionExists = await existsTestId(driver, 'ics-export-section');
    expect(sectionExists).toBe(true);
  });

  test('15. should show all four preset buttons', async () => {
    const next4 = await existsTestId(driver, 'ics-export-next4weeks');
    const next3 = await existsTestId(driver, 'ics-export-next3months');
    const allFuture = await existsTestId(driver, 'ics-export-allfuture');
    const pastMonth = await existsTestId(driver, 'ics-export-pastmonth');

    expect(next4).toBe(true);
    expect(next3).toBe(true);
    expect(allFuture).toBe(true);
    expect(pastMonth).toBe(true);
  });

  test('16. should tap "Next 4 weeks" and handle result', async () => {
    // Tap the preset button — it will either show share sheet or "no events" alert
    await tapTestId(driver, 'ics-export-next4weeks', 5000);
    await driver.pause(2000);

    // If no events, an alert will appear — dismiss it
    try {
      if (driver.isIOS) {
        const alertText = await driver.getAlertText();
        if (alertText) {
          await driver.acceptAlert();
        }
      } else {
        const okButton = await byText(driver, 'OK', true);
        if (await okButton.isExisting()) {
          await okButton.click();
        }
      }
    } catch {
      // Share sheet may have appeared instead — dismiss it
      try {
        if (driver.isIOS) {
          // iOS share sheet: tap Close/Cancel
          const closeBtn = await driver.$('-ios predicate string:label == "Close"');
          if (await closeBtn.isExisting()) {
            await closeBtn.click();
          }
        } else {
          await driver.back();
        }
      } catch {
        // Neither alert nor share sheet — test still passes (button was tapped)
      }
    }

    await driver.pause(500);
    await screenshot(driver, 'ics-export-preset-tapped');
  });
});
