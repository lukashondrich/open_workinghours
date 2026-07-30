/**
 * Deterministic suite order.
 *
 * Jest's default sequencer orders by cache (failed-first) then file size,
 * which is non-deterministic across runs and broke the implicit dependency
 * that location.test.js (which leaves a location configured) runs before
 * manual-session.test.js. Pin the order explicitly instead.
 */
const Sequencer = require('@jest/test-sequencer').default;
const path = require('path');

const ORDER = [
  'auth',
  'registration',
  'calendar',
  'location',
  'shifts',
  'absences',
  'manual-session',
  'calendar-export',
];

function rank(testPath) {
  const name = path.basename(testPath).replace(/\.test\.js$/, '');
  const idx = ORDER.indexOf(name);
  return idx === -1 ? ORDER.length : idx;
}

class FixedOrderSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort(
      (a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path)
    );
  }
}

module.exports = FixedOrderSequencer;
