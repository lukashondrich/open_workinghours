import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  createConsentRecord,
  needsConsent,
  userNeedsConsentUpdate,
} from '../consent-types';

describe('consent version helpers', () => {
  it('uses the consolidated May 2026 policy versions', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-05');
    expect(CURRENT_PRIVACY_VERSION).toBe('2026-05');
  });

  it('creates local records with the current policy versions', () => {
    const record = createConsentRecord();

    expect(record.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(record.privacyVersion).toBe(CURRENT_PRIVACY_VERSION);
    expect(new Date(record.acceptedAt).toString()).not.toBe('Invalid Date');
    expect(needsConsent(record)).toBe(false);
  });

  it('requires authenticated users to re-accept missing, stale, or unauditable consent', () => {
    expect(userNeedsConsentUpdate(null)).toBe(true);
    expect(userNeedsConsentUpdate({})).toBe(true);
    expect(userNeedsConsentUpdate({
      termsAcceptedVersion: '2026-01',
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
      consentAcceptedAt: '2026-05-22T00:00:00.000Z',
    })).toBe(true);
    expect(userNeedsConsentUpdate({
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
    })).toBe(true);
  });

  it('accepts authenticated users with current versions and an audit timestamp', () => {
    expect(userNeedsConsentUpdate({
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
      consentAcceptedAt: '2026-05-22T00:00:00.000Z',
    })).toBe(false);
  });
});
