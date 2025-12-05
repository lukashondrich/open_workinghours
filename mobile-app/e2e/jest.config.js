module.exports = {
  testTimeout: 180000,
  reporters: ['detox/runners/jest/streamlineReporter'],
  setupFilesAfterEnv: ['detox/runners/jest/requireDetox'],
};
