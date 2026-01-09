/**
 * Consent types for GDPR compliance
 * Tracks user acceptance of Terms of Service and Privacy Policy
 */

export interface ConsentRecord {
  termsVersion: string;      // e.g., "2026-01"
  privacyVersion: string;    // e.g., "2026-01"
  acceptedAt: string;        // ISO 8601 timestamp
}

// Current versions - increment when policies are updated
export const CURRENT_TERMS_VERSION = '2026-01';
export const CURRENT_PRIVACY_VERSION = '2026-01';

/**
 * Check if user needs to provide consent (new user or policy update)
 */
export function needsConsent(record: ConsentRecord | null): boolean {
  if (!record) return true;
  return (
    record.termsVersion !== CURRENT_TERMS_VERSION ||
    record.privacyVersion !== CURRENT_PRIVACY_VERSION
  );
}

/**
 * Check if this is a policy update (user had previous consent but versions changed)
 */
export function isPolicyUpdate(record: ConsentRecord | null): boolean {
  if (!record) return false;
  return (
    record.termsVersion !== CURRENT_TERMS_VERSION ||
    record.privacyVersion !== CURRENT_PRIVACY_VERSION
  );
}

/**
 * Create a new consent record with current timestamp
 */
export function createConsentRecord(): ConsentRecord {
  return {
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedAt: new Date().toISOString(),
  };
}
