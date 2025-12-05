/**
 * Detox config scaffold for Expo-managed app (iOS simulator).
 * Adjust binary/build commands as the Expo dev client is wired up.
 */
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/jest.config.js',
  specs: 'e2e/**/*.spec.{js,ts}',
  behavior: {
    init: {
      exposeGlobals: true,
    },
  },
  apps: {
    'ios.sim.debug': {
      type: 'ios.simulator',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/mobileapp.app',
      build: 'EXPO_NO_START=1 npx expo run:ios --configuration Debug --device "iPhone 15"',
      device: {
        type: 'iPhone 15',
      },
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.sim.debug',
    },
  },
};
