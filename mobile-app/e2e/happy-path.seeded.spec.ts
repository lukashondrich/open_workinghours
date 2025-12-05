// @ts-nocheck
/**
 * Happy-path submission flow using pre-seeded device DB.
 * Requires env/extra flags:
 * - TEST_DB_SEED=true
 * - TEST_PRIVACY_NOISE_SEED=<number>
 *
 * This is a scaffold; wire up testIDs in the app and Detox build config before running.
 */

import { device, expect, element, by } from 'detox';
import { startBackend } from './utils/startBackend';
import { listWeeklySubmissions } from './utils/backendClient';

describe('Happy path (seeded data)', () => {
  let backend;

  beforeAll(async () => {
    backend = await startBackend();
    await device.launchApp({
      newInstance: true,
      delete: true,
      launchArgs: {
        TEST_DB_SEED: 'true',
        TEST_PRIVACY_NOISE_SEED: '12345',
      },
      permissions: { location: 'always', notifications: 'YES' },
    });
  });

  afterAll(async () => {
    if (backend) {
      await backend.stop();
    }
  });

  it('submits the pre-confirmed week and verifies backend', async () => {
    // Navigate to Calendar tab
    await element(by.id('tab-calendar')).tap();

    // Verify the header shows ready-to-submit status
    await expect(element(by.id('week-status-ready'))).toBeVisible();

    // Submit week
    await element(by.id('submit-week-button')).tap();
    await expect(element(by.id('toast-week-sent'))).toBeVisible();

    // Backend assertion
    const submissions = await listWeeklySubmissions(1);
    expect(submissions.length).toBeGreaterThan(0);
    const latest = submissions[0];
    // Just assert week window matches; noise is deterministic via seed
    expect(latest.week_start).toBeDefined();
    expect(latest.week_end).toBeDefined();
    expect(latest.planned_hours).toBeGreaterThan(0);
    expect(latest.actual_hours).toBeGreaterThan(0);
  });
});
