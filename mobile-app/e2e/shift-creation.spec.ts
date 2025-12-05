// @ts-nocheck
/**
 * UI-driven shift creation flow (no pre-seeded data).
 * Requires a dev client with GPS/location prompts handled by the simulator config.
 */

import { device, expect, element, by } from 'detox';
import { startBackend } from './utils/startBackend';
import { listWeeklySubmissions } from './utils/backendClient';

function currentWeekStartKey(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

describe('Shift creation flow (UI)', () => {
  let backend;

  beforeAll(async () => {
    backend = await startBackend();
    await device.launchApp({
      newInstance: true,
      delete: true,
      launchArgs: {
        TEST_DB_SEED: 'false',
        TEST_PRIVACY_NOISE_SEED: '12345',
      },
    });
  });

  afterAll(async () => {
    if (backend) {
      await backend.stop();
    }
  });

  it('creates a location, adds a shift template, places a shift, confirms a day, and submits', async () => {
    // Setup location
    await expect(element(by.id('input-location-name'))).toBeVisible();
    await element(by.id('input-location-name')).replaceText('Test Hospital');
    await element(by.id('radius-increase')).tap();
    await element(by.id('save-location-button')).tap();

    // Navigate to Calendar
    await element(by.id('tab-calendar')).tap();

    // Open templates and add a new one
    await element(by.id('toggle-templates')).tap();
    await element(by.id('template-add')).tap();
    await element(by.id('template-save')).tap();

    // Arm the first template
    await element(by.id('template-arm-0')).tap();

    // Tap on first day column to place shift (defaults to Monday)
    const weekStart = currentWeekStartKey();
    await element(by.id(`week-day-column-${weekStart}`)).tap();

    // Enter review mode and confirm the day
    await element(by.id('toggle-review')).tap();
    await element(by.id(`confirm-day-${weekStart}`)).tap();

    // Submit week
    await element(by.id('submit-week-button')).tap();
    await expect(element(by.id('toast-week-sent'))).toBeVisible();

    // Backend assertion
    const submissions = await listWeeklySubmissions(1);
    expect(submissions.length).toBeGreaterThan(0);
  });
});
