const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: [path.join(__dirname, 'flows/**/*.test.js')],
  testTimeout: 120000, // 2 minutes per test
  verbose: true,
};
