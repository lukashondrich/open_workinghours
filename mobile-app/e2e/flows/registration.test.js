/**
 * Registration Flow E2E Test
 *
 * Tests the picker-based registration form (v2 taxonomy):
 * - Email verification → RegisterScreen with State/Hospital/Profession/Seniority pickers
 * - Picker interactions (open, select, conditional display)
 * - GDPR consent acceptance
 * - Full registration completes and user reaches main app
 *
 * This test requires a FRESH app state (uninstall before running).
 * Run standalone: PLATFORM=android npm run test -- --testPathPattern=registration
 */

const { createDriver, getPlatform } = require('../helpers/driver');
const {
  existsTestId,
  tapTestId,
  typeTestId,
  selectPickerOption,
  isAuthenticated,
  dismissKeyboard,
  dismissNativeDialog,
  dismissPermissionDialogs,
  dismissSystemDialogs,
  screenshot,
} = require('../helpers/actions');
const { byTestId } = require('../helpers/selectors');

describe('Registration Flow', () => {
  let driver;

  beforeAll(async () => {
    driver = await createDriver(getPlatform());
    await driver.pause(2000);

    // Activate app and dismiss any startup dialogs
    try {
      await driver.activateApp('com.openworkinghours.mobileapp');
    } catch { /* already in foreground */ }

    await dismissSystemDialogs(driver);

    // Wait for app to be ready (welcome screen or tab bar)
    const maxWait = driver.isAndroid ? 15000 : 8000;
    let waited = 0;
    while (waited < maxWait) {
      const hasTabBar = await existsTestId(driver, 'tab-status');
      const hasWelcome = await existsTestId(driver, 'login-button');
      if (hasTabBar || hasWelcome) break;
      await driver.pause(1000);
      waited += 1000;
    }
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

  test('should show Welcome screen with Create Account button', async () => {
    // Skip if already authenticated (app state from previous run)
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping Welcome screen check');
      return;
    }

    const hasRegister = await existsTestId(driver, 'register-button');
    expect(hasRegister).toBe(true);

    const hasLogin = await existsTestId(driver, 'login-button');
    expect(hasLogin).toBe(true);
  });

  test('should navigate to email verification on Create Account tap', async () => {
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping');
      return;
    }

    await tapTestId(driver, 'register-button');
    await driver.pause(1000);

    // Email verification screen should show email input and send code button
    const hasEmailInput = await existsTestId(driver, 'email-input');
    expect(hasEmailInput).toBe(true);

    const hasSendCode = await existsTestId(driver, 'send-code-button');
    expect(hasSendCode).toBe(true);
  });

  test('should complete email verification with TEST_MODE code', async () => {
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping');
      return;
    }

    // Enter email
    await typeTestId(driver, 'email-input', 'test@example.com');
    await dismissKeyboard(driver);

    // Send code
    await tapTestId(driver, 'send-code-button');
    await driver.pause(1500);

    // Dismiss "Code sent" dialog
    await dismissNativeDialog(driver, ['OK']);
    await driver.pause(500);

    // Enter verification code
    await typeTestId(driver, 'code-input', '123456');
    await dismissKeyboard(driver);

    // Verify code
    await tapTestId(driver, 'verify-code-button');
    await driver.pause(2000);

    // Should now be on RegisterScreen — state picker should be visible
    const hasStatePicker = await existsTestId(driver, 'state-picker');
    expect(hasStatePicker).toBe(true);
  });

  test('should show registration form with required pickers', async () => {
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping');
      return;
    }

    // State picker — always visible
    const hasStatePicker = await existsTestId(driver, 'state-picker');
    expect(hasStatePicker).toBe(true);

    // Profession picker — always visible
    const hasProfessionPicker = await existsTestId(driver, 'profession-picker');
    expect(hasProfessionPicker).toBe(true);

    // Department picker — always visible (optional field)
    const hasDepartmentPicker = await existsTestId(driver, 'department-picker');
    expect(hasDepartmentPicker).toBe(true);

    // Hospital picker — hidden until state is selected
    const hasHospitalPicker = await existsTestId(driver, 'hospital-picker');
    expect(hasHospitalPicker).toBe(false);

    // Seniority picker — hidden until profession is selected
    const hasSeniorityPicker = await existsTestId(driver, 'seniority-picker');
    expect(hasSeniorityPicker).toBe(false);
  });

  test('should show hospital picker after selecting state', async () => {
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping');
      return;
    }

    // Select Berlin
    await selectPickerOption(driver, 'state-picker', 'BE');

    // Hospital picker should now be visible
    const hasHospitalPicker = await existsTestId(driver, 'hospital-picker');
    expect(hasHospitalPicker).toBe(true);
  });

  test('should show seniority picker after selecting profession', async () => {
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping');
      return;
    }

    // Select Physician
    await selectPickerOption(driver, 'profession-picker', 'physician');

    // Seniority picker should now be visible
    const hasSeniorityPicker = await existsTestId(driver, 'seniority-picker');
    expect(hasSeniorityPicker).toBe(true);
  });

  test('should complete registration with all required fields', async () => {
    const authenticated = await isAuthenticated(driver);
    if (authenticated) {
      console.log('Already authenticated — skipping');
      return;
    }

    // State and profession already selected from previous tests.
    // Select hospital (Other — pinned, visible without search)
    await selectPickerOption(driver, 'hospital-picker', 'other');

    // Select seniority (Assistenzarzt)
    await selectPickerOption(driver, 'seniority-picker', 'assistenzarzt');

    // Scroll to register button if needed (form may be long)
    if (driver.isAndroid) {
      try {
        const regBtn = await byTestId(driver, 'register-button');
        const displayed = await regBtn.isDisplayed();
        if (!displayed) {
          const { width, height } = await driver.getWindowSize();
          await driver.action('pointer', { parameters: { pointerType: 'touch' } })
            .move({ x: Math.round(width / 2), y: Math.round(height * 0.7) })
            .down()
            .move({ x: Math.round(width / 2), y: Math.round(height * 0.3), duration: 300 })
            .up()
            .perform();
          await driver.pause(500);
        }
      } catch { /* continue */ }
    }

    // Tap register
    await tapTestId(driver, 'register-button');
    await driver.pause(1500);

    // Accept GDPR consent
    try {
      await tapTestId(driver, 'consent-checkbox', 8000);
      await driver.pause(300);
      await tapTestId(driver, 'consent-accept-button');
    } catch (e) {
      console.log('Consent testID failed, trying screenshot for debug');
      try { await screenshot(driver, 'consent-fallback'); } catch { /* ignore */ }
      throw e;
    }

    await driver.pause(3000);

    // Dismiss any permission dialogs
    await dismissPermissionDialogs(driver);

    // Should now be on main app with tab bar
    const nowAuthenticated = await isAuthenticated(driver);
    expect(nowAuthenticated).toBe(true);
  });
});
