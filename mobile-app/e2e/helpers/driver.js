/**
 * Appium Driver Setup
 *
 * Creates and configures WebdriverIO remote driver for iOS or Android.
 */

const { remote } = require('webdriverio');

// Device configurations
const devices = {
  ios: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone 15 Pro Max',
    'appium:bundleId': 'com.openworkinghours.mobileapp',
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
  },
  android: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'emulator-5554',
    'appium:appPackage': 'com.openworkinghours.mobileapp',
    'appium:appActivity': '.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
  },
};

/**
 * Create Appium driver for specified platform
 * @param {string} platform - 'ios' or 'android'
 * @param {object} overrides - Capability overrides
 * @returns {Promise<WebdriverIO.Browser>}
 */
async function createDriver(platform = process.env.PLATFORM || 'ios', overrides = {}) {
  const capabilities = {
    ...devices[platform],
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
  devices,
};
