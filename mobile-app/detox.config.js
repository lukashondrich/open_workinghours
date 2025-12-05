/**
 * Detox config for Expo-managed app (iOS simulator).
 */
module.exports = {
  testRunner: {
    type: 'jest',
    jest: {
      config: 'e2e/jest.config.js',
    },
  },
  behavior: {
    init: {
      exposeGlobals: true,
    },
  },
  apps: {
    'ios.sim.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/mobileapp.app',
      build: 'EXPO_NO_START=1 npx expo run:ios --configuration Debug --device "iPhone 15"',
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
