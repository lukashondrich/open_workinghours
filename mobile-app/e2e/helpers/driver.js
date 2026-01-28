/**
 * Appium Driver Setup
 *
 * Creates and configures WebdriverIO remote driver for iOS or Android.
 * Auto-detects running simulators/emulators for easier setup.
 */

const { remote } = require('webdriverio');
const { execSync } = require('child_process');

/**
 * Auto-detect the UDID of a booted iOS simulator
 * @returns {string|null} UDID of first booted simulator, or null if none
 */
function getBootedIOSSimulator() {
  try {
    const result = execSync(
      'xcrun simctl list devices booted -j 2>/dev/null',
      { encoding: 'utf8' }
    );
    const data = JSON.parse(result);

    // Find first booted device across all runtimes
    for (const runtime of Object.values(data.devices)) {
      for (const device of runtime) {
        if (device.state === 'Booted') {
          return device.udid;
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Auto-detect a running Android emulator
 * @returns {string|null} Device ID like 'emulator-5554', or null if none
 */
function getRunningAndroidEmulator() {
  try {
    const result = execSync(
      'adb devices 2>/dev/null | grep emulator | head -1 | cut -f1',
      { encoding: 'utf8' }
    ).trim();
    return result || null;
  } catch (e) {
    return null;
  }
}

/**
 * Get device capabilities for platform, auto-detecting device IDs
 * @param {string} platform - 'ios' or 'android'
 * @returns {object} Appium capabilities
 */
function getDeviceCapabilities(platform) {
  if (platform === 'ios') {
    const udid = process.env.IOS_UDID || getBootedIOSSimulator();
    if (!udid) {
      throw new Error(
        'No booted iOS simulator found. Start one with: open -a Simulator'
      );
    }
    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone',
      'appium:udid': udid,
      'appium:bundleId': 'com.openworkinghours.mobileapp',
      'appium:noReset': true,
      'appium:newCommandTimeout': 300,
    };
  } else {
    const deviceId = process.env.ANDROID_DEVICE || getRunningAndroidEmulator();
    if (!deviceId) {
      throw new Error(
        'No running Android emulator found. Start one with: emulator -avd <name>'
      );
    }
    return {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': deviceId,
      'appium:udid': deviceId,
      'appium:appPackage': 'com.openworkinghours.mobileapp',
      'appium:appActivity': '.MainActivity',
      'appium:noReset': true,
      'appium:newCommandTimeout': 300,
      // Increase snapshot depth for complex React Native views
      'appium:settings[snapshotMaxDepth]': 62,
      'appium:settings[enableMultiWindows]': true,
    };
  }
}

/**
 * Create Appium driver for specified platform
 * @param {string} platform - 'ios' or 'android'
 * @param {object} overrides - Capability overrides
 * @returns {Promise<WebdriverIO.Browser>}
 */
async function createDriver(platform = process.env.PLATFORM || 'ios', overrides = {}) {
  const capabilities = {
    ...getDeviceCapabilities(platform),
    ...overrides,
  };

  const driver = await remote({
    hostname: process.env.APPIUM_HOST || '127.0.0.1',
    port: parseInt(process.env.APPIUM_PORT || '4723'),
    path: '/',
    capabilities,
    logLevel: process.env.DEBUG ? 'info' : 'warn',
  });

  // Add platform helper
  driver.isIOS = platform === 'ios';
  driver.isAndroid = platform === 'android';
  driver.platform = platform;

  return driver;
}

/**
 * Get current platform from environment
 */
function getPlatform() {
  return process.env.PLATFORM || 'ios';
}

module.exports = {
  createDriver,
  getPlatform,
  getBootedIOSSimulator,
  getRunningAndroidEmulator,
};
