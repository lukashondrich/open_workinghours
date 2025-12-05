module.exports = {
  testTimeout: 120000,
  reporters: ['detox/runners/jest/streamlineReporter'],
  setupFilesAfterEnv: ['detox/runners/jest/requireDetox'],
};
